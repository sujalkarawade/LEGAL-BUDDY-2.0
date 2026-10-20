import fs from 'fs';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import { PaddleOcrService, type PaddlePageResult } from './ocr/paddle-ocr.service.js';
import { DocumentOcrResult, PageOcrMetadata } from './ocr/ocr.types.js';
import { RAG_CHUNK_OVERLAP, RAG_CHUNK_SIZE } from '../config/index.js';

export interface ExtractedPageChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  extractionMethod: string;
  clauseHeading?: string;
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  chunks: ExtractedPageChunk[];
  isScannedOrEmpty: boolean;
  warningMessage?: string;
  ocrResult: DocumentOcrResult;
}

export class PdfService {
  /**
   * Evaluates if extracted text for a single page represents substantive selectable text
   * or merely page numbers / image noise.
   */
  private static isSubstantiveText(text: string): boolean {
    const clean = text.replace(/---PAGE_\d+---/g, '').trim();
    // Exclude bare numbers, dashes, whitespace
    const nonDigitText = clean.replace(/[\d\s\-_.,/\\()]/g, '');
    const words = clean.split(/\s+/).filter((w) => w.length > 1);
    return nonDigitText.length >= 8 && words.length >= 2;
  }

  /**
   * Chunks page text cleanly into paragraphs without crossing page boundaries.
   */
  static chunkPages(pages: Array<{ pageNumber: number; text: string; extractionType?: string }>): ExtractedPageChunk[] {
    const chunks: ExtractedPageChunk[] = [];
    for (const page of pages) {
      // Keep source substrings intact, including decimal amounts, clause numbers and Marathi marks.
      if (page.extractionType === 'failed' || (page.text.match(/\p{L}/gu)?.length || 0) < 2) continue;
      const text = page.text.replace(/\r\n/g, '\n').trim();
      let start = 0;
      while (start < text.length) {
        const hardEnd = Math.min(start + RAG_CHUNK_SIZE, text.length);
        let end = hardEnd;
        if (hardEnd < text.length) {
          const window = text.slice(start, hardEnd);
          // Prefer paragraph/clause boundaries, then sentences, then whitespace.
          const patterns = [/\n\s*\n|\n(?=\d+(?:\.\d+)*[.)]?\s)/g, /[.!?।](?=\s)/g, /\s/g];
          for (const pattern of patterns) {
            const candidates = [...window.matchAll(pattern)].filter(m => m.index! >= RAG_CHUNK_SIZE / 2);
            if (candidates.length) {
              const last = candidates[candidates.length - 1];
              end = start + last.index! + last[0].length;
              break;
            }
          }
        }
        const content = text.slice(start, end).trim();
        if (content) {
          const heading = content.split('\n')[0].match(/^(?:(?:section|clause|article)\s+)?\d+(?:\.\d+)*[.)]?\s+.{1,100}$/i)?.[0];
          chunks.push({ chunkIndex: chunks.length, pageNumber: page.pageNumber, content,
            extractionMethod: page.extractionType || 'selectable', clauseHeading: heading });
        }
        if (end === text.length) break;
        let next = Math.max(start + 1, end - RAG_CHUNK_OVERLAP);
        // Start overlap at a whole word, never inside a Devanagari grapheme.
        while (next < end && next > 0 && !/\s/.test(text[next - 1])) next++;
        start = next;
      }
    }
    return chunks;
  }

  /**
   * Upgraded PDF extraction pipeline:
   * 1. Detects whether each page contains selectable text or is image-based / scanned.
   * 2. Extracts selectable text directly; renders only scanned pages to images and
   *    runs local PaddleOCR (PP-OCRv5 Devanagari model - English + Marathi) on them.
   * 3. Preserves exact page boundaries and page numbers for Marathi & English legal documents.
   * 4. Flags low-confidence extractions for user preview.
   * 5. Handles poor scans, empty pages, OCR failures, and oversized PDFs gracefully.
   */
  static async extractText(
    filePath: string,
    onProgress?: (progress: {
      completedPages: number;
      totalPages: number;
      stage: string;
      scannedCount?: number;
      selectableCount?: number;
    }) => void,
    options?: {
      bypassCache?: boolean;
      forcePageNumbers?: number[];
      preservedPages?: PageOcrMetadata[];
      dpi?: number;
    }
  ): Promise<PdfExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }

    onProgress?.({
      completedPages: 0,
      totalPages: 1,
      stage: 'Validating PDF signatures and stream layout...',
    });

    const dataBuffer = fs.readFileSync(filePath);

    // Validate PDF magic bytes (%PDF)
    const magicBytes = dataBuffer.subarray(0, 5).toString('ascii');
    if (!magicBytes.startsWith('%PDF')) {
      throw new Error('Invalid file format. The uploaded file does not have valid PDF header signatures.');
    }

    // Step 1: Inspect selectable text page-by-page using pdf-parse
    const rawPageTexts: { pageNumber: number; text: string }[] = [];
    let parsedTotalPages = (await PDFDocument.load(dataBuffer)).getPageCount();

    try {
      const parseOptions = {
        pagerender: (pageData: any) => {
          return pageData.getTextContent().then((textContent: any) => {
            let lastY: number | undefined;
            let text = '';
            for (const item of textContent.items) {
              if (lastY === undefined || lastY === item.transform[5]) {
                text += (text.length > 0 && !text.endsWith(' ') ? ' ' : '') + item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            const cleanText = text.trim();
            rawPageTexts.push({
              pageNumber: pageData.pageIndex + 1,
              text: cleanText,
            });
            return `\n---PAGE_${pageData.pageIndex + 1}---\n` + cleanText;
          });
        },
      };

      const parsed = await pdfParse(dataBuffer, parseOptions);
      parsedTotalPages = parsed.numpages || (rawPageTexts.length > 0 ? rawPageTexts.length : 1);
    } catch (parseErr: any) {
      console.warn('[PdfService] Selectable text parsing failed; attempting page OCR.');
    }

    const totalPages = Math.max(parsedTotalPages, rawPageTexts.length, 1);

    // Step 2: Per-page detection (selectable vs image-based/scanned)
    const scannedPageNumbers: number[] = [];
    const selectablePageNumbers: number[] = [];
    const reusedPageNumbers: number[] = [];
    const perPageSelectableMap = new Map<number, string>();
    const preservedPageMap = new Map((options?.preservedPages || []).map((page) => [page.pageNumber, page]));

    for (let p = 1; p <= totalPages; p++) {
      const found = rawPageTexts.find((item) => item.pageNumber === p);
      const text = found ? found.text : '';
      perPageSelectableMap.set(p, text);

      if (options?.forcePageNumbers && options.forcePageNumbers.includes(p)) {
        scannedPageNumbers.push(p);
      } else if (preservedPageMap.has(p)) {
        reusedPageNumbers.push(p);
      } else if (this.isSubstantiveText(text)) {
        selectablePageNumbers.push(p);
      } else {
        scannedPageNumbers.push(p);
      }
    }

    const reusedScannedCount = reusedPageNumbers.filter(p => preservedPageMap.get(p)!.isScanned).length;
    console.log(
      `[PdfService] Document page scan audit: Total ${totalPages} pages | ` +
      `Selectable: ${selectablePageNumbers.length} | Scanned/Image: ${scannedPageNumbers.length} | Reused OCR pages: ${reusedPageNumbers.length}`
    );

    onProgress?.({
      completedPages: selectablePageNumbers.length + reusedPageNumbers.length,
      totalPages,
      stage: `Page audit complete: ${selectablePageNumbers.length} digital selectable, ${scannedPageNumbers.length} scanned/image page(s)`,
      scannedCount: scannedPageNumbers.length + reusedScannedCount,
      selectableCount: selectablePageNumbers.length + reusedPageNumbers.length - reusedScannedCount,
    });

    const isAllSelectable = scannedPageNumbers.length === 0 && reusedPageNumbers.length === 0;
    const isOcrConfigured = PaddleOcrService.isConfigured();

    // Case A: Entire document has selectable digital text -> No OCR needed
    if (isAllSelectable) {
      onProgress?.({
        completedPages: totalPages,
        totalPages,
        stage: 'All pages have selectable text. Skipped OCR entirely.',
      });

      const pagesMeta: PageOcrMetadata[] = [];
      const globalLanguages = new Set<string>(['en']);

      for (let p = 1; p <= totalPages; p++) {
        const text = perPageSelectableMap.get(p) || '';
        const hasDevanagari = /[\u0900-\u097F]/.test(text);
        const langs = hasDevanagari ? ['en', 'mr'] : ['en'];
        langs.forEach((l) => globalLanguages.add(l));

        const words = text.split(/\s+/).filter(Boolean);
        pagesMeta.push({
          pageNumber: p,
          isScanned: false,
          extractionType: 'selectable',
          text,
          wordCount: words.length,
          confidence: 1.0,
          skewAngle: 0,
          languages: langs,
          hasLowConfidence: false,
          uncertainWordCount: 0,
          flagged: false,
        });
      }

      const fullText = pagesMeta.map((p) => `--- PAGE_${p.pageNumber} ---\n${p.text}`).join('\n\n');
      const chunks = this.chunkPages(pagesMeta);

      const ocrResult: DocumentOcrResult = {
        totalPages,
        scannedPagesCount: 0,
        selectablePagesCount: totalPages,
        overallConfidence: 1.0,
        detectedLanguages: Array.from(globalLanguages),
        pages: pagesMeta,
        fullText,
        hasLowConfidencePages: false,
        hasSkewedPages: false,
        ocrEngineUsed: 'selectable_direct',
        isConfigured: isOcrConfigured,
      };

      return {
        text: fullText,
        pageCount: totalPages,
        chunks,
        isScannedOrEmpty: chunks.length === 0,
        ocrResult,
      };
    }

    // Case B: Document contains scanned pages -> Run local PaddleOCR on them
    if (isOcrConfigured || scannedPageNumbers.length === 0) {
      try {
        console.log(
          `[PdfService] Running local PaddleOCR on ${scannedPageNumbers.length} scanned page(s)...`
        );

        const ocrResult = scannedPageNumbers.length === 0
          ? { pages: new Map<number, PaddlePageResult>(), capped: false }
          : await PaddleOcrService.analyzeScannedPages(
          filePath,
          scannedPageNumbers,
          (ocrEvent) => {
            const completedTotal = selectablePageNumbers.length + reusedPageNumbers.length + ocrEvent.completedPages;
            onProgress?.({
              completedPages: completedTotal,
              totalPages,
              stage: `Extracting scanned page ${ocrEvent.pageNumber} (${ocrEvent.completedPages}/${scannedPageNumbers.length} scanned) with PaddleOCR...`,
              scannedCount: scannedPageNumbers.length + reusedScannedCount,
              selectableCount: selectablePageNumbers.length + reusedPageNumbers.length - reusedScannedCount,
            });
          },
          options
        );

        // Merge selectable (direct) and PaddleOCR results, preserving page order.
        const finalPagesMeta: PageOcrMetadata[] = [];
        const globalLanguages = new Set<string>(['en']);

        for (let p = 1; p <= totalPages; p++) {
          if (selectablePageNumbers.includes(p)) {
            const text = perPageSelectableMap.get(p) || '';
            const hasDevanagari = /[\u0900-\u097F]/.test(text);
            const langs = hasDevanagari ? ['en', 'mr'] : ['en'];
            langs.forEach((l) => globalLanguages.add(l));
            const words = text.split(/\s+/).filter(Boolean);

            finalPagesMeta.push({
              pageNumber: p,
              isScanned: false,
              extractionType: 'selectable',
              text,
              wordCount: words.length,
              confidence: 1.0,
              skewAngle: 0,
              languages: langs,
              hasLowConfidence: false,
              uncertainWordCount: 0,
              flagged: false,
            });
          } else if (reusedPageNumbers.includes(p)) {
            const preserved = preservedPageMap.get(p)!;
            finalPagesMeta.push(preserved);
            preserved.languages.forEach((language) => globalLanguages.add(language));
          } else {
            const ocrPage: PaddlePageResult | undefined = ocrResult.pages.get(p);

            // Empty page: OCR ran but produced no text (blank or illegible image).
            if (ocrPage && ocrPage.text.trim().length === 0) {
              finalPagesMeta.push({
                pageNumber: p,
                isScanned: true,
                extractionType: 'paddle_ocr',
                text: '',
                wordCount: 0,
                confidence: 0,
                skewAngle: 0,
                languages: ['en'],
                hasLowConfidence: true,
                uncertainWordCount: 0,
                flagged: true,
                flaggedReason:
                  'No readable text detected on this scanned page (blank or illegible image).',
              });
              continue;
            }

            // OCR produced text for this scanned page.
            if (ocrPage) {
              const text = ocrPage.text;
              const hasDevanagari = /[\u0900-\u097F]/.test(text);
              const langs = hasDevanagari ? ['en', 'mr'] : ['en'];
              langs.forEach((l) => globalLanguages.add(l));
              const lowConfidence = ocrPage.confidence < 0.7 || Boolean(ocrPage.error);

              finalPagesMeta.push({
                pageNumber: p,
                isScanned: true,
                extractionType: 'paddle_ocr',
                text,
                wordCount: ocrPage.wordCount,
                confidence: ocrPage.confidence,
                skewAngle: 0,
                languages: langs,
                hasLowConfidence: lowConfidence,
                uncertainWordCount: 0,
                lineCount: ocrPage.lineCount,
                flagged: lowConfidence,
                flaggedReason: lowConfidence
                  ? `Low OCR confidence (${(ocrPage.confidence * 100).toFixed(0)}%). Please verify this page.`
                  : ocrPage.error || undefined,
              });
              continue;
            }

            // No OCR entry for this scanned page (e.g. skipped due to oversized cap).
            finalPagesMeta.push({
              pageNumber: p,
              isScanned: true,
              extractionType: 'failed',
              text: '',
              wordCount: 0,
              confidence: 0,
              skewAngle: 0,
              languages: ['en', 'mr'],
              hasLowConfidence: true,
              uncertainWordCount: 0,
              flagged: true,
              flaggedReason: ocrResult.capped
                ? 'This page was skipped because the document exceeded the OCR page limit. Review manually.'
                : 'OCR did not return a result for this page.',
            });
          }
        }

        const fullText = finalPagesMeta.map((p) => `--- PAGE_${p.pageNumber} ---\n${p.text}`).join('\n\n');
        const chunks = this.chunkPages(finalPagesMeta);

        const totalConfidenceSum = finalPagesMeta.reduce((sum, p) => sum + p.confidence, 0);
        const overallConfidence =
          finalPagesMeta.length > 0 ? Math.round((totalConfidenceSum / finalPagesMeta.length) * 1000) / 1000 : 0.9;

        const mergedOcrResult: DocumentOcrResult = {
          totalPages,
          scannedPagesCount: scannedPageNumbers.length + reusedScannedCount,
          selectablePagesCount: selectablePageNumbers.length + reusedPageNumbers.length - reusedScannedCount,
          overallConfidence,
          detectedLanguages: Array.from(globalLanguages),
          pages: finalPagesMeta,
          fullText,
          hasLowConfidencePages: finalPagesMeta.some((p) => p.hasLowConfidence),
          hasSkewedPages: finalPagesMeta.some((p) => Math.abs(p.skewAngle || 0) > 2.5),
          ocrEngineUsed: 'paddle_ocr',
          isConfigured: true,
        };

        const isScannedOrEmpty = chunks.length === 0;

        return {
          text: fullText,
          pageCount: totalPages,
          chunks,
          isScannedOrEmpty,
          warningMessage: mergedOcrResult.hasLowConfidencePages
            ? 'Some scanned pages have low OCR confidence or skew. Please review in the OCR Preview.'
            : undefined,
          ocrResult: mergedOcrResult,
        };
      } catch (ocrErr: any) {
        console.warn('[PdfService] Local PaddleOCR failed; preserving available pages for review.');
        // Fallback gracefully without crashing
        return this.buildFallbackResult(
          totalPages,
          scannedPageNumbers,
          selectablePageNumbers,
          perPageSelectableMap,
          'Local OCR failed. Check the OCR installation and retry unreadable pages.',
          Array.from(preservedPageMap.values())
        );
      }
    }

    // Case C: Local OCR is unavailable (worker/interpreter missing)
    console.warn('[PdfService] Scanned pages detected, but local PaddleOCR is not available.');
    return this.buildFallbackResult(
      totalPages,
      scannedPageNumbers,
      selectablePageNumbers,
      perPageSelectableMap,
      'Scanned / photographed legal document detected. Local PaddleOCR (English & Marathi) could not run. Ensure Python and PaddleOCR are installed (see server/ocr/README.md), or verify text manually in OCR Preview.',
      Array.from(preservedPageMap.values())
    );
  }

  /**
   * Helper to construct a graceful response when OCR is unavailable or fails
   */
  private static buildFallbackResult(
    totalPages: number,
    scannedPages: number[],
    selectablePages: number[],
    perPageSelectableMap: Map<number, string>,
    warningMessage: string,
    preservedPages: PageOcrMetadata[] = []
  ): PdfExtractionResult {
    const pagesMeta: PageOcrMetadata[] = [];
    const globalLanguages = new Set<string>(['en', 'mr']);
    const preservedMap = new Map(preservedPages.map((page) => [page.pageNumber, page]));

    for (let p = 1; p <= totalPages; p++) {
      const isSelectable = selectablePages.includes(p);
      const text = perPageSelectableMap.get(p) || '';

      if (isSelectable) {
        const words = text.split(/\s+/).filter(Boolean);
        pagesMeta.push({
          pageNumber: p,
          isScanned: false,
          extractionType: 'selectable',
          text,
          wordCount: words.length,
          confidence: 1.0,
          skewAngle: 0,
          languages: ['en'],
          hasLowConfidence: false,
          uncertainWordCount: 0,
          flagged: false,
        });
      } else if (preservedMap.has(p)) {
        pagesMeta.push(preservedMap.get(p)!);
      } else {
        pagesMeta.push({
          pageNumber: p,
          isScanned: true,
          extractionType: 'failed',
          text: '',
          wordCount: 0,
          confidence: 0.1,
          skewAngle: 0,
          languages: ['en', 'mr'],
          hasLowConfidence: true,
          uncertainWordCount: 0,
          flagged: true,
          flaggedReason: warningMessage,
        });
      }
    }

    const fullText = pagesMeta.map((p) => `--- PAGE_${p.pageNumber} ---\n${p.text}`).join('\n\n');
    const chunks = this.chunkPages(pagesMeta);

    const ocrResult: DocumentOcrResult = {
      totalPages,
      scannedPagesCount: scannedPages.length + preservedPages.filter((page) => page.isScanned).length,
      selectablePagesCount: selectablePages.length,
      overallConfidence: selectablePages.length > 0 ? 0.5 : 0.0,
      detectedLanguages: Array.from(globalLanguages),
      pages: pagesMeta,
      fullText,
      hasLowConfidencePages: true,
      hasSkewedPages: false,
      ocrEngineUsed: 'none',
      warningMessage,
      isConfigured: PaddleOcrService.isConfigured(),
    };

    return {
      text: fullText,
      pageCount: totalPages,
      chunks,
      isScannedOrEmpty: chunks.length === 0,
      warningMessage,
      ocrResult,
    };
  }
}
