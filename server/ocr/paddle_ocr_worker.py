"""PaddleOCR worker for Legal Buddy.

Reads a JSON job specification from stdin and writes a JSON result to stdout.

Job shape:
{
  "pdfPath": "absolute/path/to/document.pdf",
  "pages": [ { "pageNumber": 1, "imagePath": "C:/.../page_1.png" } ],
  "dpi": 220,
  "lang": "devanagari",
  "renderDir": "C:/absolute/path/to/render"
}

Result shape:
{
  "engine": "paddleocr", "model": "devanagari", "paddleVersion": "...",
  "error": null | "message",
  "pages": [ { "pageNumber": 1, "text": "...", "confidence": 0.93, "wordCount": 123 } ]
}

Notes:
- The Devanagari PP-OCRv5 recognition model supports Marathi AND English, so a
  single engine handles mixed English-Marathi scanned legal documents.
- Detection/recognition confidence scores are averaged per page so the pipeline
  can flag low-quality scans exactly as before.
- Every failure is captured per-page (never crashes the whole job); pages that
  could not be OCR'd are reported with empty text and 0.0 confidence.
- The PaddleOCR model is instantiated lazily on first use and cached for the
  life of the process. Node.js reuses one long-lived worker, so model loading
  happens only once.
"""

import sys
import json
import statistics


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


def get_engine(lang: str):
    global _engine
    if _engine is not None and _engine_meta["model"] == lang:
        return _engine

    try:
        from paddleocr import PaddleOCR  # noqa: F401
        import paddleocr as _paddleocr_mod
    except Exception as exc:  # ImportError or native-load failure
        raise RuntimeError(
            "PaddleOCR is not installed for the OCR Python environment. "
            "Install it with:  pip install \"paddleocr>=3.0\" "
            "(see server/ocr/requirements.txt). Original error: " + str(exc)
        ) from exc

    _engine_meta["paddleVersion"] = getattr(_paddleocr_mod, "__version__", None)
    _log(f"Loading PaddleOCR engine (lang={lang}, version={_engine_meta['paddleVersion']}) ...")

    _engine = PaddleOCR(
        lang=lang,
        ocr_version="PP-OCRv5",
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name=f"{lang}_PP-OCRv5_mobile_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    _engine_meta["model"] = lang
    _log("PaddleOCR engine ready.")
    return _engine


def _render_page(pdf_path: str, page_number: int, render_dir: str, dpi: int):
    """Render a single 1-based PDF page to a PNG using PyMuPDF and return its path."""
    import os
    import fitz  # PyMuPDF

    os.makedirs(render_dir, exist_ok=True)
    out_path = os.path.join(render_dir, f"paddle_page_{page_number}.png")

    doc = fitz.open(pdf_path)
    try:
        if page_number < 1 or page_number > doc.page_count:
            raise IndexError(f"page {page_number} out of range (1..{doc.page_count})")
        page = doc.load_page(page_number - 1)
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(out_path)
    finally:
        doc.close()
    return out_path


def _run_ocr(engine, image_path: str):
    """Run PaddleOCR on an image and return (text, confidence)."""
    scores = []
    texts = []

    def _consume(res) -> None:
        if res is None:
            return
        rec_texts = None
        rec_scores = None
        # PaddleOCR 3.x exposes .rec_texts/.rec_scores on the result object.
        if hasattr(res, "rec_texts"):
            rec_texts = res.rec_texts
            rec_scores = res.rec_scores
        elif isinstance(res, dict):
            rec_texts = res.get("rec_texts") or res.get("texts")
            rec_scores = res.get("rec_scores") or res.get("scores")

        if rec_texts:
            for t in rec_texts:
                if t is not None and str(t).strip():
                    texts.append(str(t))
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
                    texts.append(str(txt))
                scores.append(float(conf))
            except (TypeError, ValueError, IndexError):
                continue

    try:
        # Preferred 3.x API returns a result object (iterable of predictions).
        result = engine.predict(image_path)
        if result is not None:
            for r in result:
                _consume(r)
    except AttributeError:
        # Older API returns a list of pages.
        for page_result in engine.ocr(image_path) or []:
            _consume(page_result)
    except Exception as exc:  # report per-page, keep going
        raise RuntimeError(f"PaddleOCR inference failed: {exc}") from exc

    text = "\n".join(texts).strip()
    confidence = _average(scores) if scores else 0.0
    return text, confidence


def process_job(job: dict) -> dict:
    pdf_path = job.get("pdfPath")
    pages = job.get("pages") or []
    lang = job.get("lang") or "devanagari"
    dpi = int(job.get("dpi") or 220)
    render_dir = job.get("renderDir")

    out = {
        "engine": "paddleocr",
        "model": lang,
        "paddleVersion": None,
        "error": None,
        "pages": [],
    }

    if not pdf_path:
        out["error"] = "Missing pdfPath in job."
        return out
    if not pages:
        out["error"] = "No scanned pages requested for OCR."
        return out

    try:
        engine = get_engine(lang)
        out["paddleVersion"] = _engine_meta["paddleVersion"]
    except Exception as exc:  # engine init failure -> fail the whole job clearly
        out["error"] = str(exc)
        _log(f"Engine init failed: {exc}")
        return out

    for p in pages:
        page_number = int(p.get("pageNumber"))
        image_path = p.get("imagePath")
        try:
            if not image_path:
                image_path = _render_page(pdf_path, page_number, render_dir, dpi)
            text, confidence = _run_ocr(engine, image_path)
            out["pages"].append(
                {
                    "pageNumber": page_number,
                    "text": text,
                    "confidence": confidence,
                    "wordCount": _word_count(text),
                }
            )
        except Exception as exc:  # per-page resilience
            _log(f"OCR failed for page {page_number}: {exc}")
            out["pages"].append(
                {
                    "pageNumber": page_number,
                    "text": "",
                    "confidence": 0.0,
                    "wordCount": 0,
                    "error": str(exc),
                }
            )
    return out


def main() -> int:
    """Persistent worker loop.

    Reads newline-delimited JSON jobs from stdin and writes one JSON result
    object per line to stdout. The PaddleOCR engine is loaded ONCE (lazily on
    the first real job) and cached for the life of the process, so repeated
    uploads no longer pay the multi-second model-load cost. This is the key
    performance optimization vs. spawning a fresh interpreter per job.
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
                json.dumps({"id": None, "error": f"Invalid job JSON: {exc}", "pages": []}) + "\n"
            )
            sys.stdout.flush()
            continue

        # Warmup job: only load the engine, return its version.
        if job.get("action") == "warmup":
            try:
                get_engine(job.get("lang") or "devanagari")
                out = {
                    "id": job.get("id"),
                    "engine": "paddleocr",
                    "model": _engine_meta["model"],
                    "paddleVersion": _engine_meta["paddleVersion"],
                    "error": None,
                    "pages": [],
                }
                _log("warmup complete")
            except Exception as exc:  # engine init failure
                _log(f"warmup failed: {exc}")
                out = {
                    "id": job.get("id"),
                    "engine": "paddleocr",
                    "error": str(exc),
                    "pages": [],
                }
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
            continue

        result = process_job(job)
        # Echo the job id back so Node can match responses to requests.
        result["id"] = job.get("id")
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()

    _log("stdin closed; exiting")
    return 0


if __name__ == "__main__":
    sys.exit(main())


