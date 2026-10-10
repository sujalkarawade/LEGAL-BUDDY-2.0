# Local OCR — PaddleOCR (English + Marathi)

Legal Buddy's OCR pipeline runs **100% locally** using
[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR). It uses the
**PP-OCRv5 Devanagari multilingual recognition model**, which recognises
**both Marathi (मराठी) and English** (as well as Hindi, Nepali, and other
Devanagari scripts). Because it is local, **no API keys or credentials are
required** and it works fully offline after the models are downloaded once.

This replaces the previous Azure AI Document Intelligence dependency.

## How it works

1. `PdfService` inspects every page of the uploaded PDF.
2. Pages that already contain **selectable digital text** are extracted
   directly (fast, lossless, confidence = 1.0).
3. Only **scanned / image-only pages** are rendered to PNG images (via PyMuPDF)
   and sent to the PaddleOCR worker.
4. The Node server shells out to `paddle_ocr_worker.py`, which runs PaddleOCR and
   returns per-page text + an average confidence score.
5. Page numbers, page boundaries (`--- PAGE_n ---` markers), and confidence
   scores are preserved, then the merged text is passed unchanged into the
   existing Groq/Gemini analysis + RAG pipeline.

### Performance: one persistent, pre-warmed worker

The Node server starts **one long-lived** Python worker process at startup and
reuses it for every upload (newline-delimited JSON over stdin/stdout). This
means the heavy PaddleOCR model is **loaded exactly once** and kept in memory —
instead of re-loading it on every request.

- On `npm run dev` / server start, the model is **warmed up in the background**
  (see the `[PaddleOcrService] Worker warm-up complete` log). The first run may
  still be downloading/caching models.
- Once warm, a typical 3-page scanned upload takes ~10–15s on CPU (no GPU)
  instead of ~35s+ when the model had to be re-loaded each time.
- If the worker ever crashes or times out, it is transparently restarted on the
  next request, and the page still falls back gracefully.

## 1. Install Python dependencies

From the **repository root** (the `server/` directory is where the server runs):

```powershell
# Windows (use the same Python the server can reach; defaults to `python` on PATH)
python -m pip install -r server/ocr/requirements.txt
```

That installs:

- `paddleocr>=3.0` — the OCR engine (pulls in `paddlepaddle`, `opencv`, etc.)
- `pymupdf>=1.24` — renders scanned PDF pages to images

> **First run downloads models.** The first OCR job downloads the PP-OCRv5
> detection + Devanagari recognition models (a few hundred MB) and caches them
> in `~/.paddleocr`. Subsequent runs are offline and fast.

### Choosing the Python interpreter

The server launches `python` by default (Windows) via the `OCR_PYTHON` env var.
If your Python lives elsewhere, set it in `server/.env`:

```env
OCR_PYTHON=C:\Python312\python.exe
# or a venv interpreter:
OCR_PYTHON=D:\DON\LEGAL BUDDY 2.0\server\ocr\.venv\Scripts\python.exe
```

### Optional: dedicated virtual environment (recommended)

```powershell
cd server/ocr
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# then set OCR_PYTHON to server/ocr/.venv/Scripts/python.exe in server/.env
```

## 2. Configuration (`server/.env`)

All OCR settings are optional — sensible defaults are used if unset:

| Variable         | Default     | Meaning                                             |
| ---------------- | ----------- | --------------------------------------------------- |
| `OCR_LANG`       | `devanagari`| Recognition model. `devanagari` = English + Marathi. |
| `OCR_PYTHON`     | `python`    | Python interpreter path/name used by the worker.    |
| `OCR_DPI`        | `200`       | Render resolution for scanned pages.                |
| `OCR_MAX_PAGES`  | `300`       | Max scanned pages OCR'd per document (oversized guard). |
| `OCR_TIMEOUT_MS` | `900000`    | Hard worker timeout in ms (15 min).                 |

## 3. Verify the installation

```powershell
# 1) Confirm PaddleOCR imports and prints its version
python -c "import paddleocr; print('PaddleOCR', paddleocr.__version__)"

# 2) Run the end-to-end OCR test on sample PDFs (selectable + scanned Marathi)
cd server
npm run test:ocr
```

## Graceful behaviour

- **Poor scans / empty pages:** reported with low/zero confidence and flagged
  for review in the OCR Preview page; never crash the pipeline.
- **OCR failures:** each page is handled independently; a failed page yields
  empty text + an error note while other pages still succeed. If the whole
  worker/engine fails, `PdfService` falls back to the selectable text and marks
  scanned pages as "verify manually".
- **Oversized PDFs:** scanned-page count is capped at `OCR_MAX_PAGES`; pages
  beyond the cap are marked as skipped for manual review.
- **Missing Python / PaddleOCR:** the server degrades gracefully with a clear
  warning instead of throwing.

## Files

- `paddle_ocr_worker.py` — the OCR worker (stdin JSON job → stdout JSON result).
- `requirements.txt` — Python dependencies.
- Node side: `server/src/services/ocr/paddle-ocr.service.ts` (spawns the worker),
  `server/src/services/pdf-service.ts` (page detection + merge).
