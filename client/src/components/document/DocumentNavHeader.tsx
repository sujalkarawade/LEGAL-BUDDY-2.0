import React from 'react';
import { NavLink, Link, useParams } from 'react-router-dom';
import {
  FileText,
  SearchCode,
  MessageSquareQuote,
  CheckCircle2,
  CalendarClock,
  Download,
  ArrowLeft,
  Shield,
  Layers,
  ScanText,
} from 'lucide-react';
import { DocumentRecord } from '../../types/index.js';

interface DocumentNavHeaderProps {
  document: DocumentRecord | null;
}

export const DocumentNavHeader: React.FC<DocumentNavHeaderProps> = ({ document }) => {
  const { id } = useParams<{ id: string }>();

  if (!document) return null;

  const tabs = [
    { name: 'Summary', path: `/documents/${id}/summary`, icon: FileText },
    { name: 'OCR & Text Preview', path: `/documents/${id}/ocr-preview`, icon: ScanText },
    { name: 'Clause Analysis', path: `/documents/${id}/clauses`, icon: SearchCode },
    { name: 'Ask Legal Buddy', path: `/documents/${id}/chat`, icon: MessageSquareQuote },
    { name: 'Completeness Check', path: `/documents/${id}/completeness`, icon: CheckCircle2 },
    { name: 'Dates & Obligations', path: `/documents/${id}/obligations`, icon: CalendarClock },
  ];

  return (
    <div className="space-y-4 mb-6 animate-fadeUp">
      {/* Breadcrumb & Contract Banner */}
      <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[4px_4px_0_#0a0a0a] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/documents"
            className="flex h-9 w-9 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
            title="Back to Contract Repository"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-[#0a0a0a] tracking-tight sm:text-lg uppercase">
                {document.originalName}
              </h1>
              <span className="border-2 border-[#0a0a0a] bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-black uppercase text-white font-mono">
                {document.summary?.contractType || 'Contract'}
              </span>
              {document.ocrStatus === 'PENDING_REVIEW' && (
                <span className="border-2 border-[#b7950b] bg-[#fefdf0] text-[#b7950b] px-2 py-0.5 text-[10px] font-black uppercase font-mono animate-pulse">
                  ⚠️ OCR Review Pending
                </span>
              )}
              {document.ocrStatus === 'OCR_COMPLETED' && (
                <span className="border-2 border-[#27ae60] bg-[#eafaf1] text-[#27ae60] px-2 py-0.5 text-[10px] font-black uppercase font-mono">
                  PaddleOCR Processed
                </span>
              )}
              {document.ocrStatus === 'VERIFIED' && (
                <span className="border-2 border-[#2980b9] bg-[#ebf5fb] text-[#2980b9] px-2 py-0.5 text-[10px] font-black uppercase font-mono">
                  Text Verified
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-gray-600 mt-1 uppercase font-semibold">
              {document.pageCount} {document.pageCount === 1 ? 'PAGE' : 'PAGES'} • UPLOADED{' '}
              {new Date(document.createdAt).toLocaleDateString()} • ENGINE:{' '}
              <span className="text-[#0a0a0a] font-black">
                {document.summary?.analysisProvider?.includes('groq') || document.summary?.analysisProvider?.includes('neural') || document.summary?.analysisProvider?.includes('llama')
                  ? 'NEURAL LEGAL AI (LLAMA 3.3 70B)'
                  : document.summary?.analysisProvider === 'gemini'
                  ? 'GOOGLE GEMINI 1.5'
                  : document.summary?.analysisProvider === 'openai'
                  ? 'OPENAI GPT-4O'
                  : 'DETERMINISTIC LEGAL ENGINE'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/documents/${id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-primary"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {/* Module Tabs Navigation */}
      <div className="flex items-center gap-1 border-b-[3px] border-[#0a0a0a] bg-white px-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border-b-[3px] -mb-[3px] ${
                  isActive
                    ? 'border-[#0a0a0a] text-[#0a0a0a] bg-[#f0f0f0]'
                    : 'border-transparent text-gray-500 hover:text-[#0a0a0a] hover:bg-[#f9f9f9]'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
