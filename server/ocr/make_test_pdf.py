"""Generate a mixed English-Marathi SCANNED test PDF (image-only, no text layer).

Page 1: pure English legal text.
Page 2: mixed English + Marathi (Devanagari) legal text.
Page 3: blank (to exercise empty-page handling).

The pages are rasterised to images and embedded, so pdf-parse sees NO
selectable text and every page is treated as "scanned" -> routed to PaddleOCR.
Run:  python server/ocr/make_test_pdf.py
"""

import os
import io
import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont

FONT_REG = "NotoSansDevanagari-Regular.ttf"
# A proper Latin font for English-only pages. Noto Sans Devanagari contains
# Latin glyphs but in a Devanagari-matched style that the recognition model
# handles poorly for dense English; real scanned English uses Latin fonts.
FONT_LATIN_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\calibri.ttf",
]


def pick_latin_font() -> str:
    for candidate in FONT_LATIN_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    # Fall back to Noto if no Latin font is available (still renders, weaker OCR).
    return FONT_REG


ENGLISH = (
    "THIS SERVICE AGREEMENT (the Agreement) is entered into on the 1st day of "
    "January 2026 by and between Acme Corporation, a company incorporated in "
    "Maharashtra (Provider), and Beta Limited (Client).\n\n"
    "1. SERVICES. Provider shall deliver software maintenance and support.\n"
    "2. PAYMENT. Client shall pay Rs. 50,000 per month within 30 days of invoice.\n"
    "3. CONFIDENTIALITY. Each party shall keep the other's information secret.\n"
    "4. TERM. This Agreement continues for 12 months unless terminated early.\n"
    "5. TERMINATION. Either party may terminate on 30 days written notice.\n"
)

MIXED = (
    "नमस्कार. This agreement is between दोन पक्ष (two parties).\n"
    "पक्ष एक: Acme Corporation. पक्ष दोन: Beta Limited.\n\n"
    "१. सेवा. Provider shall deliver support services. (सेवा पुरवठा)\n"
    "२. पेमेंट. Client shall pay Rs. 50,000 within 30 days. (थेट पेमेंट)\n"
    "३. गोपनीयता. Confidentiality shall be maintained. (गोपनीयता राखावी)\n"
    "४. कालावधी. Term is 12 months. (बारा महिने)\n"
    "५. समाप्ती. Either party may terminate with 30 days notice.\n\n"
    "महाराष्ट्र, भारत. Page two of the scanned mixed document ends here."
)


def render_text_page(text: str, font_path: str, width: int = 1654, height: int = 2339):
    """Render wrapped text to a white A4-ish grayscale RGB image at ~200 DPI."""
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, 34)
    margin = 90
    line_height = 52
    y = margin
    max_w = width - 2 * margin
    for para in text.split("\n"):
        if not para.strip():
            y += line_height // 2
            continue
        words = para.split(" ")
        line = ""
        for w in words:
            trial = (line + " " + w).strip()
            bbox = draw.textbbox((0, 0), trial, font=font)
            if bbox[2] - bbox[0] > max_w and line:
                draw.text((margin, y), line, fill="black", font=font)
                y += line_height
                line = w
            else:
                line = trial
        if line:
            draw.text((margin, y), line, fill="black", font=font)
            y += line_height
    return img


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    font = os.path.join(here, FONT_REG)
    out_dir = os.path.join(here, "..", "sample_contracts")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "sample_marathi_en_scanned.pdf")

    doc = fitz.open()
    pages = [ENGLISH, MIXED, ""]  # third page blank
    for text in pages:
        img = render_text_page(text, font)
        img = img.convert("L")
        # Use Image.save (registers the PNG plugin) rather than tobytes('png'),
        # which can fail if the PNG encoder isn't preloaded in some Pillow builds.
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_bytes = buf.getvalue()
        # Embed as an image-only page (no text layer -> scanned by pipeline)
        rect = fitz.paper_rect("a4")
        page = doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(rect, stream=img_bytes)
    doc.save(out_path, deflate=True)
    doc.close()

    # Verify: pdf-parse / PyMuPDF text layer must be EMPTY (proves scanned).
    verify = fitz.open(out_path)
    extracted = "".join(p.get_text() for p in verify).strip()
    print(f"Created: {os.path.abspath(out_path)}")
    print(f"Pages: {verify.page_count}")
    print(f"Selectable text length (should be 0): {len(extracted)}")
    verify.close()


if __name__ == "__main__":
    main()
