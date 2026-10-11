"""PaddleOCR worker for Legal Buddy.

Reads a JSON job specification from stdin and writes JSON responses to stdout.

Job shape:
{
  "id": 1,
  "pdfPath": "absolute/path/to/document.pdf",
  "pages": [ { "pageNumber": 1, "imagePath": "optional/page_1.png" } ],
  "dpi": 150,
  "lang": "devanagari",
  "renderDir": "optional/fallback/dir"
}

Progress event emitted to stdout:
{
  "type": "progress", "id": 1, "pageNumber": 1,
  "completedPages": 1, "totalPages": 34,
  "confidence": 0.93, "wordCount": 123
}

Final result emitted to stdout:
{
  "type": "result", "id": 1,
  "engine": "paddleocr", "model": "devanagari", "paddleVersion": "3.3.3",
  "error": null,
  "pages": [ { "pageNumber": 1, "text": "...", "confidence": 0.93, "wordCount": 123, "renderMs": 85, "ocrMs": 3200 } ]
}

Notes:
- The Devanagari PP-OCRv5 recognition model supports Marathi AND English, so a
  single engine handles mixed English-Marathi scanned legal documents.
- The model is instantiated ONCE and cached for the lifetime of the persistent worker.
- Renders pages directly in memory via PyMuPDF (no disk PNG write/read overhead).
- Emits real-time progress events per page for the background job pipeline.
- Handles failures safely per page without failing the entire job.
"""

import os
import sys
import time
import json
import statistics
import numpy as np

# Ensure UTF-8 I/O on Windows
if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Bypass model hoster connectivity check to prevent hangs
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"


def _log(msg: str) -> None:
    # Progress/diagnostics go to stderr so stdout stays a clean JSON channel.
    print(f"[paddle_ocr_worker] {msg}", file=sys.stderr, flush=True)


def _average(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return 0.0
    return round(float(statistics.fmean(vals)), 4)


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


# --- Lazy, process-cached PaddleOCR engine -----------------------------------
_engine = None
_engine_meta = {"engine": "paddleocr", "model": "devanagari", "paddleVersion": None}


def get_engine(lang: str = "devanagari"):
    global _engine
    if _engine is not None and _engine_meta["model"] == lang:
        return _engine

    try:
        from paddleocr import PaddleOCR
        import paddleocr as _paddleocr_mod
    except Exception as exc:
        raise RuntimeError(
            "PaddleOCR is not installed for the OCR Python environment. "
            "Install it with: pip install \"paddleocr>=3.0\" "
            "(see server/ocr/requirements.txt). Original error: " + str(exc)
        ) from exc

    _engine_meta["paddleVersion"] = getattr(_paddleocr_mod, "__version__", None)
    cpu_cores = min(os.cpu_count() or 4, 6)
    _log(f"Loading PaddleOCR engine (lang={lang}, version={_engine_meta['paddleVersion']}, cpu_threads={cpu_cores}) ...")

    # PP-OCRv5 Devanagari model handles Marathi + English
    _engine = PaddleOCR(
        ocr_version="PP-OCRv5",
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name=f"{lang}_PP-OCRv5_mobile_rec" if lang != "en" else "PP-OCRv5_mobile_rec",
        text_recognition_batch_size=8,
        cpu_threads=cpu_cores,
        enable_mkldnn=True,
        device="cpu",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    _engine_meta["model"] = lang
    _log("PaddleOCR engine ready (batch_size=8, oneDNN/MKLDNN enabled).")
    return _engine


def _preprocess_image_if_needed(img_bgr: np.ndarray) -> np.ndarray:
    """Apply light image enhancement only when necessary (e.g. low-contrast scans)."""
    # Fast check on downsampled thumbnail
    thumb = img_bgr[::4, ::4]
    gray = np.dot(thumb[..., :3], [0.114, 0.587, 0.299])  # BGR to Gray
    std_dev = np.std(gray)
    
    # If contrast is extremely washed out (std_dev < 20), apply contrast stretching
    if std_dev < 20:
        min_v = np.min(img_bgr)
        max_v = np.max(img_bgr)
        if max_v > min_v:
            img_bgr = np.clip((img_bgr.astype(np.float32) - min_v) * (255.0 / (max_v - min_v)), 0, 255).astype(np.uint8)
    return img_bgr


def _render_page_in_memory(doc, page_number: int, dpi: int) -> np.ndarray:
    """Render a 1-based PDF page directly to a BGR numpy array in memory (no disk I/O)."""
    import fitz  # PyMuPDF

    if page_number < 1 or page_number > doc.page_count:
        raise IndexError(f"page {page_number} out of range (1..{doc.page_count})")
    
    page = doc.load_page(page_number - 1)
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Samples buffer is RGB bytes -> reshape and convert to BGR for PaddleOCR
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    bgr = arr[:, :, ::-1].copy()
    return _preprocess_image_if_needed(bgr)


def _load_image_from_disk(image_path: str) -> np.ndarray:
    """Load an image from disk into a BGR numpy array using PyMuPDF or PIL."""
    import fitz
    pix = fitz.Pixmap(image_path)
    if pix.n >= 4:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    bgr = arr[:, :, ::-1].copy()
    return _preprocess_image_if_needed(bgr)


def _run_ocr(engine, img_input):
    """Run PaddleOCR on an in-memory numpy array or file path and return (text, confidence)."""
    scores = []
    texts = []

    def _consume(res) -> None:
        if res is None:
            return
        rec_texts = None
        rec_scores = None
        # PaddleOCR 3.x exposes .rec_texts/.rec_scores
        if hasattr(res, "rec_texts"):
            rec_texts = res.rec_texts
            rec_scores = res.rec_scores
        elif isinstance(res, dict):
            rec_texts = res.get("rec_texts") or res.get("texts")
            rec_scores = res.get("rec_scores") or res.get("scores")

        if rec_texts:
            for t in rec_texts:
                if t is not None and str(t).strip():
                    texts.append(str(t).strip())
            if rec_scores:
                for s in rec_scores:
                    try:
                        scores.append(float(s))
                    except (TypeError, ValueError):
                        pass
            return

        # Fallback: PaddleOCR 2.x list-of-lines format [[box, (text, score)], ...]
        for line in res:
            try:
                txt = line[1][0]
                conf = line[1][1]
                if txt is not None and str(txt).strip():
                    texts.append(str(txt).strip())
                scores.append(float(conf))
            except (TypeError, ValueError, IndexError):
                continue

    try:
        result = engine.predict(img_input)
        if result is not None:
            for r in result:
                _consume(r)
    except AttributeError:
        for page_result in engine.ocr(img_input) or []:
            _consume(page_result)
    except Exception as exc:
        raise RuntimeError(f"PaddleOCR inference failed: {exc}") from exc

    text = "\n".join(texts).strip()
    confidence = _average(scores) if scores else 0.0
    return text, confidence


def process_job(job: dict) -> dict:
    import fitz

    job_id = job.get("id")
    pdf_path = job.get("pdfPath")
    pages = job.get("pages") or []
    lang = job.get("lang") or "devanagari"
    dpi = int(job.get("dpi") or 150)

    out = {
        "id": job_id,
        "type": "result",
        "engine": "paddleocr",
        "model": lang,
        "paddleVersion": None,
        "error": None,
        "pages": [],
    }

    if not pdf_path and not any(p.get("imagePath") for p in pages):
        out["error"] = "Missing pdfPath or imagePath in job."
        return out
    if not pages:
        out["error"] = "No scanned pages requested for OCR."
        return out

    try:
        engine = get_engine(lang)
        out["paddleVersion"] = _engine_meta["paddleVersion"]
    except Exception as exc:
        out["error"] = str(exc)
        _log(f"Engine init failed: {exc}")
        return out

    # Open PDF document once for the whole job to eliminate redundant opens
    doc = None
    if pdf_path and os.path.exists(pdf_path):
        try:
            doc = fitz.open(pdf_path)
        except Exception as exc:
            out["error"] = f"Failed to open PDF at {pdf_path}: {exc}"
            return out

    total_pages_count = len(pages)

    try:
        for idx, p in enumerate(pages):
            page_number = int(p.get("pageNumber"))
            image_path = p.get("imagePath")
            
            t_render_start = time.perf_counter()
            try:
                if image_path and os.path.exists(image_path):
                    img_arr = _load_image_from_disk(image_path)
                elif doc is not None:
                    img_arr = _render_page_in_memory(doc, page_number, dpi)
                else:
                    raise FileNotFoundError(f"Neither valid doc nor imagePath for page {page_number}")
                render_ms = round((time.perf_counter() - t_render_start) * 1000, 1)

                t_ocr_start = time.perf_counter()
                text, confidence = _run_ocr(engine, img_arr)
                ocr_ms = round((time.perf_counter() - t_ocr_start) * 1000, 1)
                w_count = _word_count(text)

                page_res = {
                    "pageNumber": page_number,
                    "text": text,
                    "confidence": confidence,
                    "wordCount": w_count,
                    "renderMs": render_ms,
                    "ocrMs": ocr_ms,
                }
                out["pages"].append(page_res)

                # Emit real-time progress line to stdout so persistent Node listener can track progress
                progress_event = {
                    "type": "progress",
                    "id": job_id,
                    "pageNumber": page_number,
                    "completedPages": idx + 1,
                    "totalPages": total_pages_count,
                    "confidence": confidence,
                    "wordCount": w_count,
                }
                sys.stdout.write(json.dumps(progress_event) + "\n")
                sys.stdout.flush()

            except Exception as exc:  # Per-page error resilience
                render_ms = round((time.perf_counter() - t_render_start) * 1000, 1)
                _log(f"OCR failed for page {page_number}: {exc}")
                failed_res = {
                    "pageNumber": page_number,
                    "text": "",
                    "confidence": 0.0,
                    "wordCount": 0,
                    "renderMs": render_ms,
                    "ocrMs": 0.0,
                    "error": str(exc),
                }
                out["pages"].append(failed_res)
                # Emit progress even on failed page so counter advances
                progress_event = {
                    "type": "progress",
                    "id": job_id,
                    "pageNumber": page_number,
                    "completedPages": idx + 1,
                    "totalPages": total_pages_count,
                    "confidence": 0.0,
                    "wordCount": 0,
                    "error": str(exc),
                }
                sys.stdout.write(json.dumps(progress_event) + "\n")
                sys.stdout.flush()
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass

    return out


def main() -> int:
    """Persistent worker loop.

    Reads newline-delimited JSON jobs from stdin and writes JSON progress
    and result objects to stdout.
    """
    _log("persistent worker ready; awaiting newline-delimited JSON jobs")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError as exc:
            sys.stdout.write(
                json.dumps({"id": None, "type": "result", "error": f"Invalid job JSON: {exc}", "pages": []}) + "\n"
            )
            sys.stdout.flush()
            continue

        # Warmup job: pre-load the engine and return version
        if job.get("action") == "warmup":
            try:
                get_engine(job.get("lang") or "devanagari")
                out = {
                    "id": job.get("id"),
                    "type": "result",
                    "engine": "paddleocr",
                    "model": _engine_meta["model"],
                    "paddleVersion": _engine_meta["paddleVersion"],
                    "error": None,
                    "pages": [],
                }
                _log("warmup complete")
            except Exception as exc:
                _log(f"warmup failed: {exc}")
                out = {
                    "id": job.get("id"),
                    "type": "result",
                    "engine": "paddleocr",
                    "error": str(exc),
                    "pages": [],
                }
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
            continue

        result = process_job(job)
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()

    _log("stdin closed; exiting")
    return 0


if __name__ == "__main__":
    sys.exit(main())
