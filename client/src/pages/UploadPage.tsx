import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, AlertCircle, CheckCircle2,
  Shield, ArrowRight, Info, ScanText, Languages,
} from 'lucide-react';
import ApiService from '../services/api.js';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [previewOcrFirst, setPreviewOcrFirst] = useState(true);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    setWarning(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid format: Only PDF documents (.pdf) are supported.');
      setSelectedFile(null);
      return;
    }
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File exceeds the 15 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError(null);
    setWarning(null);
    setIsProcessing(true);

    try {
      setProcessingStage('Uploading PDF…');
      const response = await ApiService.uploadDocument(selectedFile);
      let doc = response.document;

      if (response.jobId && response.status === 'PROCESSING') {
        const pollInterval = 600;
        let jobDone = false;
        for (let attempt = 0; !jobDone && attempt < 1800; attempt++) {
          await new Promise((r) => setTimeout(r, pollInterval));
          const jobStatus = await ApiService.getJobStatus(response.jobId);
          if (jobStatus.progress) {
            const p = jobStatus.progress;
            setProcessingStage(`${p.currentStage} (${p.completedPages}/${p.totalPages} pages; ${p.percent}%)`);
          }
          if (jobStatus.status === 'COMPLETED') {
            jobDone = true;
            if (jobStatus.document) doc = jobStatus.document;
          } else if (jobStatus.status === 'FAILED') {
            navigate(`/documents/${doc.id}/ocr-preview`);
            return;
          }
        }
        if (!jobDone) throw new Error('Processing continues in the background. Check the document list for progress.');
      }

      setProcessingStage('Structuring contract chunks…');
      await new Promise((r) => setTimeout(r, 400));

      const isScannedOrFlagged =
        doc.ocrStatus === 'PENDING_REVIEW' || doc.ocrStatus === 'OCR_COMPLETED' ||
        (doc.ocrResult && doc.ocrResult.scannedPagesCount > 0) || !!doc.errorMessage;

      if (previewOcrFirst || isScannedOrFlagged) {
        navigate(`/documents/${doc.id}/ocr-preview`);
      } else {
        navigate(`/documents/${doc.id}/summary`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process document.');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }} className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Upload Contract</h1>
          <p>Upload a PDF agreement for automated clause analysis and risk identification</p>
        </div>
      </div>

      {/* Drop zone */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            border: `2px dashed ${dragActive ? 'var(--black)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius)',
            background: dragActive ? 'var(--surface-alt)' : 'var(--surface)',
            cursor: isProcessing ? 'default' : 'pointer',
            textAlign: 'center',
            transition: 'border-color var(--transition), background var(--transition)',
          }}
          onMouseEnter={e => { if (!isProcessing) (e.currentTarget as HTMLElement).style.borderColor = 'var(--black)'; }}
          onMouseLeave={e => { if (!dragActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
        >
          <div
            style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: 'var(--surface-alt)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px',
            }}
          >
            <UploadCloud size={24} style={{ color: 'var(--text-muted)' }} />
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Drag & drop your PDF, or <span style={{ textDecoration: 'underline', textDecorationStyle: 'dashed' }}>browse</span>
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.6 }}>
            Supports searchable PDFs, scanned contracts, and mixed English-Marathi legal documents. Max 15 MB.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '20px', justifyContent: 'center' }}>
            {[
              { icon: ScanText, text: 'PaddleOCR Engine' },
              { icon: Languages, text: 'English & मराठी' },
              { icon: CheckCircle2, text: 'Page Citations' },
              { icon: Shield, text: 'Secure Processing' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Selected file */}
        {selectedFile && !isProcessing && (
          <div
            style={{
              marginTop: '12px', padding: '14px 16px',
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
            }}
            className="animate-fade-in"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius)', background: 'var(--white)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{selectedFile.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB &bull; PDF Document
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={previewOcrFirst}
                    onChange={(e) => setPreviewOcrFirst(e.target.checked)}
                    style={{ accentColor: 'var(--black)' }}
                  />
                  Review OCR text before analysis
                </label>
              </div>
            </div>

            <button onClick={handleUpload} className="btn btn-primary" style={{ flexShrink: 0 }}>
              {previewOcrFirst ? 'Process & Preview OCR' : 'Analyse Now'}
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div
            style={{
              marginTop: '12px', padding: '24px', textAlign: 'center',
              background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            }}
          >
            <div className="spinner" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {processingStage || 'Processing…'}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Please wait while Legal Buddy ingests and indexes the contract.
            </p>
          </div>
        )}

        {/* Errors / warnings */}
        {error && (
          <div className="alert alert-error" style={{ marginTop: '12px' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p style={{ fontWeight: 600 }}>Upload Error</p>
              <p style={{ marginTop: '2px', lineHeight: 1.5 }}>{error}</p>
            </div>
          </div>
        )}

        {warning && (
          <div className="alert alert-warning" style={{ marginTop: '12px' }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <p style={{ fontWeight: 600 }}>Scanned Document Notice</p>
              <p style={{ marginTop: '2px', lineHeight: 1.5, color: 'var(--text-primary)' }}>{warning}</p>
            </div>
          </div>
        )}
      </div>

      {/* Supported types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          { title: 'NDAs & Confidentiality', desc: 'Identifies mutual vs unilateral definitions, disclosure exclusions, and sunset periods.' },
          { title: 'Master Services & SOWs', desc: 'Detects liability caps, indemnification, payment terms, and IP ownership transfers.' },
          { title: 'Employment Agreements', desc: 'Highlights probation, termination notice, non-compete covenants, and IP assignment.' },
        ].map(({ title, desc }) => (
          <div key={title} className="card" style={{ padding: '16px' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
