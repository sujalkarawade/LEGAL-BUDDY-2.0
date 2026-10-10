import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ScanText,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  RotateCw,
  Copy,
  Check,
  ShieldCheck,
  Languages,
  Eye,
  Edit3,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, DocumentOcrResult, PageOcrMetadata } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentOcrPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [ocrData, setOcrData] = useState<DocumentOcrResult | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [editedPages, setEditedPages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isReScanning, setIsReScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchOcrData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [docRes, ocrRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getOcrPreview(id),
      ]);
      setDocument(docRes.document);
      setOcrData(ocrRes.ocrMetadata);

      // Initialize edited pages map
      const initialMap: Record<number, string> = {};
      if (ocrRes.ocrMetadata?.pages) {
        ocrRes.ocrMetadata.pages.forEach((p) => {
          initialMap[p.pageNumber] = p.text;
        });
      }
      setEditedPages(initialMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load OCR extraction data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOcrData();
  }, [id]);

  const handleTextChange = (pageNum: number, newText: string) => {
    setEditedPages((prev) => ({
      ...prev,
      [pageNum]: newText,
    }));
  };

  const handleResetCurrentPage = () => {
    if (!ocrData || !ocrData.pages[selectedPageIndex]) return;
    const current = ocrData.pages[selectedPageIndex];
    setEditedPages((prev) => ({
      ...prev,
      [current.pageNumber]: current.text,
    }));
  };

  const handleCopyText = () => {
    if (!ocrData || !ocrData.pages[selectedPageIndex]) return;
    const current = ocrData.pages[selectedPageIndex];
    const textToCopy = editedPages[current.pageNumber] ?? current.text;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyAndAnalyze = async () => {
    if (!id || !ocrData) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const pagesPayload = ocrData.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: editedPages[p.pageNumber] ?? p.text,
      }));

      const res = await ApiService.verifyOcrAndAnalyze(id, pagesPayload);
      setSuccessMessage('Text verified successfully! AI analysis pipeline completed.');
      setDocument(res.document);

      // Briefly show success before navigating to summary
      setTimeout(() => {
        navigate(`/documents/${id}/summary`);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to verify text and trigger analysis.');
      setIsSaving(false);
    }
  };

  const handleReOcr = async () => {
    if (!id) return;
    if (!confirm('Re-run local PaddleOCR on this contract? Existing extractions will be refreshed.')) {
      return;
    }

    setIsReScanning(true);
    setError(null);
    try {
      await ApiService.reOcrDocument(id);
      await fetchOcrData();
      setSuccessMessage('PaddleOCR re-scan completed successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to re-run OCR.');
    } finally {
      setIsReScanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin border-3 border-[#0a0a0a] border-t-transparent"></div>
      </div>
    );
  }

  const currentPage = ocrData?.pages[selectedPageIndex];
  const currentText = currentPage ? (editedPages[currentPage.pageNumber] ?? currentPage.text) : '';
  const isCurrentModified = currentPage && currentText !== currentPage.text;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      {/* OCR Intelligence Overview Banner */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#0a0a0a]">
          <div>
            <div className="flex items-center gap-2">
              <ScanText className="h-5 w-5 text-[#0a0a0a]" />
              <h2 className="text-base font-black uppercase tracking-wider text-[#0a0a0a]">
                OCR Extraction & Document Text Verification
              </h2>
            </div>
            <p className="text-xs text-gray-600 font-mono mt-1">
              Inspect selectable text streams, PaddleOCR transcription, confidence scores, and Marathi-English page boundaries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReOcr}
              disabled={isReScanning || isSaving}
              className="btn btn-sm btn-secondary flex items-center gap-1.5"
              title="Re-run local PaddleOCR"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isReScanning ? 'animate-spin' : ''}`} />
              <span>{isReScanning ? 'Running OCR...' : 'Re-run OCR'}</span>
            </button>

            <button
              onClick={handleVerifyAndAnalyze}
              disabled={isSaving || isReScanning}
              className="btn btn-sm btn-primary flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#f1c40f]" />
              <span>{isSaving ? 'Analyzing Contract...' : 'Confirm & Run Analysis'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* OCR Audit Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 text-xs font-mono">
          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Total Pages</span>
            <span className="text-base font-black text-[#0a0a0a]">{ocrData?.totalPages || document?.pageCount || 1}</span>
          </div>

          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Scanned / Photo</span>
            <span className="text-base font-black text-[#c0392b]">{ocrData?.scannedPagesCount || 0}</span>
          </div>

          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Selectable Pages</span>
            <span className="text-base font-black text-[#27ae60]">{ocrData?.selectablePagesCount || 0}</span>
          </div>

          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Average Confidence</span>
            <span className={`text-base font-black ${
              (ocrData?.overallConfidence || 1) < 0.70 ? 'text-[#c0392b]' : 'text-[#27ae60]'
            }`}>
              {Math.round((ocrData?.overallConfidence || 1) * 100)}%
            </span>
          </div>

          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Detected Languages</span>
            <div className="flex items-center gap-1 mt-0.5">
              {ocrData?.detectedLanguages?.includes('mr') && (
                <span className="bg-[#0a0a0a] text-white px-1.5 py-0.5 text-[10px] font-bold">मराठी</span>
              )}
              {ocrData?.detectedLanguages?.includes('en') && (
                <span className="bg-[#0a0a0a] text-white px-1.5 py-0.5 text-[10px] font-bold">EN</span>
              )}
              {(!ocrData?.detectedLanguages || ocrData.detectedLanguages.length === 0) && (
                <span className="text-gray-500 text-xs">EN</span>
              )}
            </div>
          </div>

          <div className="border-2 border-[#0a0a0a] p-3 bg-[#f9f9f9]">
            <span className="text-[10px] text-gray-500 font-bold uppercase block">Engine Active</span>
            <span className="text-[11px] font-black text-[#0a0a0a] truncate block" title={ocrData?.ocrEngineUsed}>
              {ocrData?.ocrEngineUsed === 'paddle_ocr'
                ? 'PADDLEOCR (LOCAL)'
                : ocrData?.ocrEngineUsed === 'selectable_direct'
                ? 'DIGITAL TEXT STREAM'
                : 'OFFLINE / FALLBACK'}
            </span>
          </div>
        </div>

        {/* Flagged Alert Banner if Low Confidence or Skew */}
        {ocrData?.hasLowConfidencePages && (
          <div className="mt-4 border-2 border-[#b7950b] bg-[#fefdf0] p-3.5 flex items-start gap-3 text-xs">
            <AlertTriangle className="h-5 w-5 text-[#b7950b] shrink-0 mt-0.5" />
            <div>
              <p className="font-black uppercase tracking-wider text-[#b7950b]">
                Low Confidence / Photographed Page Quality Alert
              </p>
              <p className="text-gray-700 mt-0.5 font-sans">
                Certain scanned pages have OCR confidence scores below 70% or skewed camera angles. Legal Buddy will
                never invent or guess unreadable terms. Please verify the extracted text below and correct any critical
                party names, dates, or amounts before launching full AI legal analysis.
              </p>
            </div>
          </div>
        )}

        {/* Local PaddleOCR notice if scanned pages could not be transcribed */}
        {ocrData?.pages?.some((p) => p.extractionType === 'failed' && p.isScanned)
          ? (
          <div className="mt-4 border-2 border-[#c0392b] bg-[#fdf0ef] p-3.5 flex items-start gap-3 text-xs">
            <Info className="h-5 w-5 text-[#c0392b] shrink-0 mt-0.5" />
            <div>
              <p className="font-black uppercase tracking-wider text-[#c0392b]">
                Local PaddleOCR Could Not Transcribe Some Pages
              </p>
              <p className="text-gray-700 mt-0.5 font-sans">
                This document contains photographed or scanned pages that local PaddleOCR (English &amp; Marathi)
                could not read. Legal Buddy runs OCR entirely offline — ensure Python and the packages in{' '}
                <code className="font-mono bg-white px-1 border border-gray-300">server/ocr/requirements.txt</code> are
                installed (see <code className="font-mono bg-white px-1 border border-gray-300">server/ocr/README.md</code>),
                then try <span className="font-semibold">Re-run PaddleOCR</span>. You can also type the missing text
                directly into the page editor below.
              </p>
            </div>
          </div>
        ) : null}

        {/* Success or Error banners */}
        {successMessage && (
          <div className="mt-4 border-2 border-[#27ae60] bg-[#eafaf1] p-3 flex items-center gap-2 text-xs text-[#27ae60] font-black uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 border-2 border-[#c0392b] bg-[#fdf0ef] p-3 flex items-center gap-2 text-xs text-[#c0392b] font-black uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main OCR Split Pane: Page List + Live Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Page Sidebar */}
        <div className="lg:col-span-4 border-[3px] border-[#0a0a0a] bg-white p-4 shadow-[6px_6px_0_#0a0a0a] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0a0a0a]">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a] flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span>Document Pages ({ocrData?.pages?.length || 0})</span>
            </h3>
            <span className="text-[10px] font-mono text-gray-500 font-bold">Select page to review</span>
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {ocrData?.pages?.map((p, idx) => {
              const isSelected = idx === selectedPageIndex;
              const isModified = (editedPages[p.pageNumber] ?? p.text) !== p.text;

              return (
                <div
                  key={p.pageNumber}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={`border-2 p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[2px_2px_0_#b7950b]'
                      : 'border-gray-200 bg-white hover:border-[#0a0a0a] hover:bg-[#f9f9f9] text-[#0a0a0a]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-black ${isSelected ? 'text-white' : 'text-[#0a0a0a]'}`}>
                        PAGE {p.pageNumber}
                      </span>
                      {isModified && (
                        <span className="text-[9px] font-bold px-1 py-0.2 bg-[#f39c12] text-white uppercase">
                          Edited
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.flagged ? (
                        <span
                          title={p.flaggedReason || 'Low confidence / skewed'}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#e74c3c]"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>{Math.round(p.confidence * 100)}%</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            isSelected ? 'text-green-300' : 'text-[#27ae60]'
                          }`}
                        >
                          {Math.round(p.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono opacity-80">
                    <span>
                      {p.isScanned ? '📷 Scanned' : '📄 Selectable'}
                      {p.skewAngle && Math.abs(p.skewAngle) > 1 ? ` • ${p.skewAngle}° skew` : ''}
                    </span>
                    <span>{p.wordCount} words</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Editor & Verification Workspace */}
        <div className="lg:col-span-8 border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] flex flex-col justify-between">
          <div>
            {/* Page Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#0a0a0a]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">
                    Page {currentPage?.pageNumber || 1} Extracted Text
                  </h3>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border-2 ${
                    currentPage?.isScanned
                      ? 'border-[#0a0a0a] bg-[#fefdf0] text-[#0a0a0a]'
                      : 'border-[#27ae60] bg-[#eafaf1] text-[#27ae60]'
                  }`}>
                    {currentPage?.isScanned ? 'PADDLEOCR LAYER' : 'DIGITAL TEXT STREAM'}
                  </span>
                  {currentPage?.languages?.includes('mr') && (
                    <span className="text-[10px] font-bold px-2 py-0.5 border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white">
                      मराठी (Devanagari)
                    </span>
                  )}
                </div>

                {currentPage?.flaggedReason && (
                  <p className="text-[11px] font-mono text-[#c0392b] font-bold mt-1">
                    ⚠️ {currentPage.flaggedReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="btn btn-sm btn-secondary flex items-center gap-1"
                  title="Copy extracted text"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {isCurrentModified && (
                  <button
                    onClick={handleResetCurrentPage}
                    className="btn btn-sm btn-secondary text-xs"
                    title="Reset to original OCR extraction"
                  >
                    Reset Page
                  </button>
                )}
              </div>
            </div>

            {/* Editable Monospace Canvas */}
            <div className="mt-4">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 font-mono mb-1.5 flex items-center justify-between">
                <span>Raw Text Content (Editable for Correction)</span>
                <span>{currentText.length} characters • {currentText.split(/\s+/).filter(Boolean).length} words</span>
              </label>

              <textarea
                value={currentText}
                onChange={(e) => currentPage && handleTextChange(currentPage.pageNumber, e.target.value)}
                rows={18}
                className="w-full border-2 border-[#0a0a0a] bg-[#fbfbfb] p-4 font-mono text-xs text-[#0a0a0a] leading-relaxed resize-y focus:outline-none focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] transition-all"
                placeholder="Extracted legal text will appear here..."
              />
            </div>
          </div>

          {/* Bottom Verification Footer */}
          <div className="mt-6 pt-4 border-t-2 border-[#0a0a0a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
              <ShieldCheck className="h-4 w-4 text-[#27ae60]" />
              <span>Exact page boundaries and line citations are preserved for Q&A and clause audit.</span>
            </div>

            <button
              onClick={handleVerifyAndAnalyze}
              disabled={isSaving || isReScanning}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-[#f1c40f]" />
              <span>{isSaving ? 'Processing Full Legal Analysis...' : 'Confirm & Run Legal Analysis'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
