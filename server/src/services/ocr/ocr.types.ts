export interface PageOcrMetadata {
  pageNumber: number;
  isScanned: boolean;
  extractionType: 'selectable' | 'paddle_ocr' | 'fallback' | 'failed';
  text: string;
  wordCount: number;
  confidence: number; // 0.0 to 1.0 (1.0 for clean selectable text)
  skewAngle?: number; // Detected page skew angle in degrees
  languages: string[]; // e.g., ['en', 'mr'] for English, Marathi
  hasLowConfidence: boolean; // Flagged if confidence < 0.70
  uncertainWordCount: number;
  flagged: boolean;
  flaggedReason?: string;
  lineCount?: number;
}

export interface DocumentOcrResult {
  totalPages: number;
  scannedPagesCount: number;
  selectablePagesCount: number;
  overallConfidence: number;
  detectedLanguages: string[];
  pages: PageOcrMetadata[];
  fullText: string;
  hasLowConfidencePages: boolean;
  hasSkewedPages: boolean;
  ocrEngineUsed: 'paddle_ocr' | 'selectable_direct' | 'none';
  warningMessage?: string;
  isConfigured: boolean;
}
