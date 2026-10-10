import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Shield,
  FileCheck,
  Sparkles,
  ArrowRight,
  Info,
  ScanText,
  Languages,
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
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    setWarning(null);

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid format: Only PDF documents (.pdf) are supported.');
      setSelectedFile(null);
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setError(`File exceeds maximum size limit of 15MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    setWarning(null);
    setIsProcessing(true);

    try {
      setProcessingStage('Securely uploading PDF file to storage...');
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStage('Auditing page streams & running local PaddleOCR on scanned pages (English & Marathi)...');
      const response = await ApiService.uploadDocument(selectedFile);

      setProcessingStage('Preserving English & Marathi page boundaries and structuring contract chunks...');
      await new Promise((r) => setTimeout(r, 600));

      // If document was scanned or user requested verification, navigate to OCR Preview
      const doc = response.document;
      const isScannedOrFlagged =
        doc.ocrStatus === 'PENDING_REVIEW' ||
        doc.ocrStatus === 'OCR_COMPLETED' ||
        (doc.ocrResult && doc.ocrResult.scannedPagesCount > 0) ||
        !!doc.errorMessage;

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
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeUp">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#0a0a0a] sm:text-3xl">
          Upload Contract for Intelligence Scan
        </h1>
        <p className="text-xs text-gray-600 font-medium mt-1 uppercase tracking-wide">
          Upload commercial agreements, NDAs, or employment contracts for automated clause breakdown and risk identification.
        </p>
      </div>

      {/* Main Upload Zone */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-8 shadow-[6px_6px_0_#0a0a0a]">
        <form
          onDragEnter={handleDrag}
          onSubmit={(e) => e.preventDefault()}
          className="relative"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`group flex flex-col items-center justify-center border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-[#0a0a0a] bg-[#f0f0f0]'
                : 'border-gray-300 bg-[#f9f9f9] hover:border-[#0a0a0a] hover:bg-white'
            }`}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex h-16 w-16 items-center justify-center border-[3px] border-[#0a0a0a] bg-white text-[#0a0a0a] group-hover:bg-[#0a0a0a] group-hover:text-white transition-all transform group-hover:-translate-y-1 mb-4 shadow-[2px_2px_0_#0a0a0a]">
              <UploadCloud className="h-8 w-8" />
            </div>

            <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">
              Drag and drop your PDF contract here, or{' '}
              <span className="underline decoration-2">browse files</span>
            </h3>
            <p className="text-xs text-gray-500 font-mono font-medium mt-2">
              Supports searchable PDFs, scanned paper contracts, mobile photos, and mixed English-Marathi legal deeds
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-wider text-gray-600">
              <span className="flex items-center gap-1.5">
                <ScanText className="h-4 w-4 text-[#0a0a0a]" />
                PaddleOCR Engine
              </span>
              <span className="flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-[#0a0a0a]" />
                English & मराठी Support
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#27ae60]" />
                Page Boundary Citations
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#0a0a0a]" />
                Secure Processing
              </span>
            </div>
          </div>
        </form>

        {/* Selected File Details */}
        {selectedFile && !isProcessing && (
          <div className="mt-6 border-2 border-[#0a0a0a] bg-[#f9f9f9] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[3px_3px_0_#0a0a0a] animate-fadeUp">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#0a0a0a]">{selectedFile.name}</p>
                <p className="text-[11px] font-mono text-gray-500 font-semibold">
                  {(selectedFile.size / 1024).toFixed(1)} KB • PDF Document
                </p>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-mono text-[#0a0a0a] font-bold mt-1 select-none">
                  <input
                    type="checkbox"
                    checked={previewOcrFirst}
                    onChange={(e) => setPreviewOcrFirst(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#0a0a0a] rounded-none cursor-pointer"
                  />
                  <span>Review OCR text preview before AI analysis</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleUpload}
              className="btn btn-primary"
            >
              <span>{previewOcrFirst ? 'Process & Preview OCR' : 'Start Instant Analysis'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Processing State with Live Steps */}
        {isProcessing && (
          <div className="mt-6 border-2 border-[#0a0a0a] bg-[#f9f9f9] p-8 text-center space-y-4 animate-fadeUp">
            <div className="spinner mx-auto"></div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#0a0a0a]">{processingStage}</p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-1">
                Please wait while Legal Buddy ingests and indexes the contractual provisions...
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-5 flex items-start gap-3 border-2 border-[#c0392b] bg-[#fdf0ef] p-4 text-xs text-[#c0392b] font-medium">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#c0392b]" />
            <div>
              <p className="font-black uppercase tracking-wider text-[#c0392b]">Upload / Processing Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Warning Alert (e.g. Scanned PDF) */}
        {warning && (
          <div className="mt-5 flex items-start gap-3 border-2 border-[#b7950b] bg-[#fefdf0] p-4 text-xs text-[#0a0a0a]">
            <Info className="h-5 w-5 shrink-0 text-[#b7950b]" />
            <div>
              <p className="font-black uppercase tracking-wider text-[#b7950b]">Scanned / Image Document Notice</p>
              <p className="mt-0.5 text-gray-700">{warning}</p>
            </div>
          </div>
        )}
      </div>

      {/* Contract Categories Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <p className="font-black uppercase tracking-wider text-xs text-[#0a0a0a]">NDAs & Confidentiality</p>
          <p className="text-gray-600 mt-2 text-[11px] leading-relaxed font-medium">
            Identifies mutual vs unilateral definitions, disclosure exclusions, return of materials, and sunset periods.
          </p>
        </div>
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <p className="font-black uppercase tracking-wider text-xs text-[#0a0a0a]">Master Services & SOWs</p>
          <p className="text-gray-600 mt-2 text-[11px] leading-relaxed font-medium">
            Detects liability caps, indemnification allocations, payment Net terms, and IP ownership transfers.
          </p>
        </div>
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <p className="font-black uppercase tracking-wider text-xs text-[#0a0a0a]">Employment Agreements</p>
          <p className="text-gray-600 mt-2 text-[11px] leading-relaxed font-medium">
            Highlights probation clauses, termination notice periods, non-compete covenants, and IP assignment.
          </p>
        </div>
      </div>
    </div>
  );
};
