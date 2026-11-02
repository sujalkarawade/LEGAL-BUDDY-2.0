import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Search, Trash2, Download, MessageSquareQuote,
  SearchCode, CheckCircle2, CalendarClock, Plus, ScanText,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord } from '../types/index.js';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const res = await ApiService.getDocuments();
      setDocuments(res.documents);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const timer = setInterval(fetchDocuments, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await ApiService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.summary?.contractType && doc.summary.contractType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.summary?.parties && doc.summary.parties.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'COMPLETED' ? ['READY', 'KEYWORD_READY'].includes(doc.ragStatus || '') : doc.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'var(--white)',
    color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'none',
    transition: 'background var(--transition), color var(--transition)',
  };

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-text">
          <h1>My Documents</h1>
          <p>Searchable contract repository with full analysis history</p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          <Plus size={14} />
          Upload Contract
        </Link>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        marginBottom: '16px',
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, type, or party…"
            className="input"
            style={{ paddingLeft: '34px' }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="ALL">All statuses</option>
          <option value="COMPLETED">Ready / Completed</option>
          <option value="PROCESSING">Processing</option>
          <option value="FAILED">Failed</option>
        </select>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filteredDocs.length} {filteredDocs.length === 1 ? 'contract' : 'contracts'}
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={20} /></div>
            <h3>No contracts found</h3>
            <p>
              {documents.length === 0
                ? 'Upload your first contract to begin clause analysis and risk review.'
                : 'No documents match your search or filter.'}
            </p>
            {documents.length === 0 && (
              <Link to="/upload" className="btn btn-primary" style={{ marginTop: '4px' }}>Upload PDF</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Pages</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Modules</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: 'var(--radius)',
                        background: 'var(--surface-alt)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={15} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          to={`/documents/${doc.id}/summary`}
                          style={{
                            fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)',
                            textDecoration: 'none', display: 'block',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: '420px',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {doc.originalName}
                        </Link>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {(doc.fileSize / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="badge badge-default">{doc.summary?.contractType || 'General'}</span>
                  </td>

                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {doc.pageCount || 1}
                  </td>

                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>

                  <td>
                    {doc.ocrStatus === 'PENDING_REVIEW' ? (
                      <span className="badge badge-warning">
                        <span className="status-dot status-dot-warning" /> OCR Review
                      </span>
                    ) : ['READY', 'KEYWORD_READY'].includes(doc.ragStatus || '') ? (
                      <span className="badge badge-success">
                        <span className="status-dot status-dot-success" />
                        {doc.ragStatus === 'READY' ? 'Ready' : 'Keyword ready'}
                      </span>
                    ) : doc.status === 'PROCESSING' ? (
                      <span className="badge badge-warning">
                        <span className="status-dot status-dot-warning" />
                        {doc.ragStatus === 'INDEXING' ? 'Indexing' : 'Extracting'}
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        {doc.ragStatus === 'UPLOADED' ? 'Index required' : 'Failed'}
                      </span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      {[
                        { to: `/documents/${doc.id}/summary`,      icon: FileText,         title: 'Summary' },
                        { to: `/documents/${doc.id}/ocr-preview`,  icon: ScanText,         title: 'OCR Preview' },
                        { to: `/documents/${doc.id}/clauses`,      icon: SearchCode,       title: 'Clause Analysis' },
                        { to: `/documents/${doc.id}/chat`,         icon: MessageSquareQuote, title: 'Chat' },
                        { to: `/documents/${doc.id}/completeness`, icon: CheckCircle2,     title: 'Completeness' },
                        { to: `/documents/${doc.id}/obligations`,  icon: CalendarClock,    title: 'Obligations' },
                      ].map(({ to, icon: Icon, title }) => (
                        <Link
                          key={to}
                          to={to}
                          title={title}
                          style={iconBtn}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-alt)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--white)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                        >
                          <Icon size={13} />
                        </Link>
                      ))}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => ApiService.openDocumentPage(doc.id, 1).catch(err => alert(err.message))}
                        title="Download PDF"
                        style={iconBtn}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-alt)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--white)'; }}
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(doc.id)}
                        title="Delete"
                        style={{ ...iconBtn, color: 'var(--danger)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--white)'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Trash2 size={18} style={{ color: 'var(--danger)' }} />
              </div>
              <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>Delete this contract?</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                This will permanently remove the PDF, extracted chunks, summaries, and all analysis records. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirmId(null)} className="btn">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="btn btn-danger">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
