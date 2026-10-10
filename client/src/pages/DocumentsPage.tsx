import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  Trash2,
  Download,
  ExternalLink,
  MessageSquareQuote,
  SearchCode,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Plus,
  AlertCircle,
  ScanText,
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

    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeUp">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-[#0a0a0a]">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#0a0a0a] sm:text-3xl">
            My Legal Documents
          </h1>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">
            Searchable contract repository with page-level indexing and analysis history
          </p>
        </div>

        <Link
          to="/upload"
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Contract</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[4px_4px_0_#0a0a0a] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by contract name, type, or party..."
            className="w-full border-2 border-[#0a0a0a] bg-white pl-10 pr-4 py-2 text-xs font-medium text-[#0a0a0a] placeholder-gray-400 focus:outline-none focus:shadow-[3px_3px_0_#0a0a0a] transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 font-mono">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 border-[#0a0a0a] bg-white px-3 py-2 text-xs font-bold uppercase text-[#0a0a0a] font-mono focus:outline-none focus:shadow-[3px_3px_0_#0a0a0a]"
          >
            <option value="ALL">ALL CONTRACTS</option>
            <option value="COMPLETED">READY / COMPLETED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {/* Documents Table / Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="spinner"></div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-12 text-center shadow-[6px_6px_0_#0a0a0a]">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-sm font-black uppercase text-[#0a0a0a]">No contracts found</h3>
          <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto font-medium leading-relaxed">
            {documents.length === 0
              ? 'Upload your first contract to start extracting intelligence and reviewing clauses.'
              : 'No documents match your current search or filter criteria.'}
          </p>
          {documents.length === 0 && (
            <Link
              to="/upload"
              className="btn btn-primary mt-6"
            >
              Upload PDF
            </Link>
          )}
        </div>
      ) : (
        <div className="border-[3px] border-[#0a0a0a] bg-white shadow-[6px_6px_0_#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f0f0f0] border-b-2 border-[#0a0a0a] text-[10px] uppercase font-black text-[#0a0a0a] font-mono">
                <tr>
                  <th className="py-3.5 px-4">Contract Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Pages</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Modules</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[#0a0a0a]">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#f9f9f9] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a] shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="truncate max-w-[220px]">
                          <Link
                            to={`/documents/${doc.id}/summary`}
                            className="font-black uppercase text-xs text-[#0a0a0a] hover:underline truncate block"
                          >
                            {doc.originalName}
                          </Link>
                          <span className="text-[10px] font-mono text-gray-500 font-semibold">
                            {(doc.fileSize / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-black uppercase font-mono">
                        {doc.summary?.contractType || 'General Contract'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-gray-700">
                      {doc.pageCount || 1} {doc.pageCount === 1 ? 'PAGE' : 'PAGES'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-gray-500 font-semibold">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      {doc.ocrStatus === 'PENDING_REVIEW' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#b7950b] font-mono animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-[#b7950b]"></span>
                          OCR Review
                        </span>
                      ) : doc.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#27ae60] font-mono">
                          <span className="h-2 w-2 rounded-full bg-[#27ae60]"></span>
                          Completed
                        </span>
                      ) : doc.status === 'PROCESSING' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#d35400] font-mono animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-[#d35400]"></span>
                          Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#c0392b] font-mono">
                          Failed
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/documents/${doc.id}/summary`}
                          title="View Executive Summary"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/documents/${doc.id}/ocr-preview`}
                          title="OCR Extraction & Text Preview"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <ScanText className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/documents/${doc.id}/clauses`}
                          title="Clause Risk Analysis"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <SearchCode className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/documents/${doc.id}/chat`}
                          title="Ask Legal Buddy"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <MessageSquareQuote className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/documents/${doc.id}/completeness`}
                          title="Completeness Checklist"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          to={`/documents/${doc.id}/obligations`}
                          title="Dates & Obligations"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download Original PDF"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          title="Delete Contract"
                          className="border border-[#0a0a0a] bg-white p-1.5 text-[#c0392b] hover:bg-[#c0392b] hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="border-[3px] border-[#0a0a0a] bg-white w-full max-w-sm p-6 shadow-[8px_8px_0_#0a0a0a] text-center animate-fadeUp text-[#0a0a0a]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-[#c0392b] bg-[#fdf0ef] text-[#c0392b] mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black uppercase text-[#0a0a0a]">Delete Contract?</h3>
            <p className="text-xs text-gray-600 mt-2 font-medium leading-relaxed">
              This will permanently remove the contract PDF, extracted chunks, AI summaries, and all clause analysis records.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="btn"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="btn bg-[#c0392b] text-white border-2 border-[#c0392b] hover:bg-black hover:border-black"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
