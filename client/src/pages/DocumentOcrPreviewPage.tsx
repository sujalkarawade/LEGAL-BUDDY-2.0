import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, DocumentOcrResult, PageOcrMetadata } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentOcrPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
      const pageIndex = ocrRes.ocrMetadata?.pages.findIndex(
        (p) => p.pageNumber === Number(searchParams.get('page'))
      );
      if (pageIndex !== undefined && pageIndex >= 0) setSelectedPageIndex(pageIndex);

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

  const waitForJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 1800; attempt++) {
      const job = await ApiService.getJobStatus(jobId);
      setSuccessMessage(job.progress?.currentStage || 'Processing document...');
      if (job.status === 'FAILED') throw new Error(job.error || 'Processing failed.');
      if (job.status === 'COMPLETED') return job;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Processing continues in the background. Return later to check the document.');
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
      await waitForJob(res.jobId);
      setSuccessMessage('Text verified and analysis completed.');
      await fetchOcrData();

      setTimeout(() => {
        navigate(`/documents/${id}/summary`);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify text and trigger analysis.');
      setIsSaving(false);
    }
  };

  const handleReOcr = async (onlyCurrentPage = false) => {
    if (!id) return;
    if (!confirm('Re-run local OCR on this contract? Existing text extractions will be refreshed.')) {
      return;
    }

    setIsReScanning(true);
    setError(null);
    try {
      const result = await ApiService.reOcrDocument(
        id,
        onlyCurrentPage && ocrData ? [ocrData.pages[selectedPageIndex].pageNumber] : undefined
      );
      await waitForJob(result.jobId);
      await fetchOcrData();
      setSuccessMessage('OCR re-scan completed successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to re-run OCR.');
    } finally {
      setIsReScanning(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '320px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const currentPage = ocrData?.pages[selectedPageIndex];
  const currentText = currentPage ? (editedPages[currentPage.pageNumber] ?? currentPage.text) : '';
  const isCurrentModified = currentPage && currentText !== currentPage.text;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <DocumentNavHeader document={document} />

      {/* OCR Overview & Metrics */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '16px', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.0625rem' }}>OCR Extraction & Text Verification</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Review extracted page text, verify scanned sections, and run contract analysis
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleReOcr()}
              disabled={isReScanning || isSaving}
              className="btn btn-secondary btn-sm"
            >
              <RotateCw size={13} style={{ animation: isReScanning ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isReScanning ? 'Running OCR…' : 'Re-run OCR'}</span>
            </button>

            <button
              onClick={handleVerifyAndAnalyze}
              disabled={isSaving || isReScanning}
              className="btn btn-primary btn-sm"
            >
              <Sparkles size={13} />
              <span>{isSaving ? 'Analyzing…' : 'Confirm & Run Analysis'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          {[
            { label: 'Total Pages', value: ocrData?.totalPages || document?.pageCount || 1 },
            { label: 'Scanned Pages', value: ocrData?.scannedPagesCount || 0 },
            { label: 'Selectable Pages', value: ocrData?.selectablePagesCount || 0 },
            {
              label: 'Avg Confidence',
              value: `${Math.round((ocrData?.overallConfidence || 1) * 100)}%`,
              highlight: (ocrData?.overallConfidence || 1) < 0.7 ? 'var(--warning)' : undefined,
            },
            {
              label: 'Languages',
              value: ocrData?.detectedLanguages?.join(', ').toUpperCase() || 'EN',
            },
            {
              label: 'OCR Engine',
              value: ocrData?.ocrEngineUsed === 'paddle_ocr' ? 'PaddleOCR' : 'Text Stream',
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
              <p
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: stat.highlight || 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {ocrData?.hasLowConfidencePages && (
          <div className="alert alert-warning" style={{ marginTop: '14px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600 }}>Low Confidence Extraction Alert</p>
              <p style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
                Certain pages were extracted with lower confidence. Review and correct any critical dates, names, or amounts before launching analysis.
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" style={{ marginTop: '14px' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '14px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Split Pane */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 2.5fr)', gap: '20px' }}>
        {/* Left: Page Navigator */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '620px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Pages ({ocrData?.pages?.length || 0})</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ocrData?.pages?.map((p, idx) => {
              const isSelected = idx === selectedPageIndex;
              const isModified = (editedPages[p.pageNumber] ?? p.text) !== p.text;

              return (
                <button
                  key={p.pageNumber}
                  onClick={() => setSelectedPageIndex(idx)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--black)' : 'var(--border)',
                    background: isSelected ? 'var(--black)' : 'var(--white)',
                    color: isSelected ? 'var(--white)' : 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      Page {p.pageNumber}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isModified && (
                        <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                          Edited
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: isSelected ? 'var(--white)' : p.confidence < 0.7 ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {Math.round(p.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.6875rem',
                      color: isSelected ? 'var(--border)' : 'var(--text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    <span>{p.isScanned ? 'Scanned' : 'Direct'}</span>
                    <span>{p.wordCount} words</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Text Canvas & Verification */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '620px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                Page {currentPage?.pageNumber || 1}
              </h3>
              <span className="badge badge-default">
                {currentPage?.isScanned ? 'PaddleOCR' : 'Text Stream'}
              </span>
              {currentPage?.languages?.includes('mr') && (
                <span className="badge badge-default">मराठी</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={handleCopyText} className="btn btn-secondary btn-sm">
                {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {isCurrentModified && (
                <button onClick={handleResetCurrentPage} className="btn btn-ghost btn-sm">
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Text Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <textarea
              value={currentText}
              onChange={(e) => currentPage && handleTextChange(currentPage.pageNumber, e.target.value)}
              className="textarea"
              style={{
                flex: 1,
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                padding: '14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                resize: 'none',
              }}
              placeholder="Extracted legal text will appear here..."
            />
          </div>

          {/* Footer Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              marginTop: '12px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              {currentText.length} characters · {currentText.split(/\s+/).filter(Boolean).length} words
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
              Preserved with verbatim page boundaries
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
