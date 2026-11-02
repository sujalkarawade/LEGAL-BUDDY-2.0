import React from 'react';
import ApiService from '../../services/api.js';
import { NavLink, Link, useParams } from 'react-router-dom';
import {
  FileText,
  SearchCode,
  MessageSquareQuote,
  CheckCircle2,
  CalendarClock,
  Download,
  ArrowLeft,
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
    { name: 'Summary',             path: `/documents/${id}/summary`,      icon: FileText },
    { name: 'OCR Preview',         path: `/documents/${id}/ocr-preview`,  icon: ScanText },
    { name: 'Clause Analysis',     path: `/documents/${id}/clauses`,      icon: SearchCode },
    { name: 'Ask Legal Buddy',     path: `/documents/${id}/chat`,         icon: MessageSquareQuote },
    { name: 'Completeness',        path: `/documents/${id}/completeness`, icon: CheckCircle2 },
    { name: 'Obligations',         path: `/documents/${id}/obligations`,  icon: CalendarClock },
  ];

  const ocrLabel =
    document.ocrStatus === 'PENDING_REVIEW' ? { text: 'OCR Review Pending', cls: 'badge-warning' } :
    document.ocrStatus === 'OCR_COMPLETED'  ? { text: 'OCR Processed',       cls: 'badge-success' } :
    document.ocrStatus === 'VERIFIED'       ? { text: 'Text Verified',        cls: 'badge-info'    } :
    null;

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Document banner */}
      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '1px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Link
            to="/documents"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              background: 'var(--white)',
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'background var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
            title="Back to Documents"
          >
            <ArrowLeft size={15} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '420px',
                }}
              >
                {document.originalName}
              </h1>
              {document.summary?.contractType && (
                <span className="badge badge-default">{document.summary.contractType}</span>
              )}
              {ocrLabel && (
                <span className={`badge ${ocrLabel.cls}`}>{ocrLabel.text}</span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'} &bull; Uploaded {new Date(document.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <button
          onClick={() => id && ApiService.openDocumentPage(id, 1).catch(err => alert(err.message))}
          className="btn btn-sm"
          style={{ flexShrink: 0 }}
        >
          <Download size={13} />
          Open PDF
        </button>
      </div>

      {/* Module Tabs */}
      <div
        style={{
          background: 'var(--white)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '0 0 var(--radius) var(--radius)',
        }}
      >
        <div className="tab-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
              >
                <Icon size={14} />
                <span>{tab.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};
