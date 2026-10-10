import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarClock,
  Clock,
  Calendar,
  User,
  CheckCircle,
  FileText,
  AlertCircle,
  Check,
  X,
  Filter,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, ExtractedObligation } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentObligationsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [obligations, setObligations] = useState<ExtractedObligation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, obRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getObligations(id),
      ]);
      setDocument(docRes.document);
      setObligations(obRes.obligations);
    } catch (err) {
      console.error('Failed to load obligations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleUpdateStatus = async (obId: string, newStatus: string) => {
    if (!id) return;
    setUpdatingId(obId);
    try {
      const res = await ApiService.updateObligationStatus(id, obId, newStatus);
      setObligations((prev) =>
        prev.map((o) => (o.id === obId ? { ...o, reviewStatus: res.obligation.reviewStatus } : o))
      );
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredObligations = obligations.filter((o) => {
    return categoryFilter === 'ALL' || o.category === categoryFilter;
  });

  const categories = [
    'ALL',
    'Payment Deadlines',
    'Termination Notice Periods',
    'Renewal & Expiry Dates',
    'Delivery / Performance Obligations',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      {/* Header Strip */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#0a0a0a]">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a]">Extracted Dates & Contractual Obligations</h2>
            <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
              Operative deadlines, notice windows, performance covenants, and responsible party assignments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-black uppercase font-mono">
              {obligations.length} ITEMS IDENTIFIED
            </span>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-black uppercase text-gray-500 font-mono mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-[#0a0a0a]" />
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`border-2 border-[#0a0a0a] px-2.5 py-1 text-[10px] font-black uppercase font-mono tracking-wider transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#0a0a0a] text-white shadow-[2px_2px_0_#888]'
                  : 'bg-white text-[#0a0a0a] hover:bg-[#f0f0f0]'
              }`}
            >
              {cat === 'ALL' ? 'ALL DEADLINES' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Obligations List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="spinner"></div>
        </div>
      ) : filteredObligations.length === 0 ? (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-12 text-center shadow-[6px_6px_0_#0a0a0a]">
          <CalendarClock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-sm font-black uppercase text-[#0a0a0a]">No obligations found for filter</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredObligations.map((ob) => (
            <div
              key={ob.id}
              className={`border-2 border-[#0a0a0a] p-5 flex flex-col justify-between transition-all shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] ${
                ob.reviewStatus === 'ACKNOWLEDGED'
                  ? 'bg-[#f4fbf7]'
                  : ob.reviewStatus === 'DISMISSED'
                  ? 'bg-[#f9f9f9] opacity-70'
                  : 'bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b-2 border-[#0a0a0a]">
                  <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-black uppercase font-mono text-[#0a0a0a]">
                    {ob.category}
                  </span>

                  {/* Calendar Date vs Duration tag */}
                  <span
                    className={`inline-flex items-center gap-1 border border-current px-2 py-0.5 text-[10px] font-black uppercase font-mono ${
                      ob.isCalendarDate
                        ? 'text-[#27ae60] bg-[#eafaf1]'
                        : 'text-[#1a5276] bg-[#eaf4fb]'
                    }`}
                  >
                    {ob.isCalendarDate ? (
                      <>
                        <Calendar className="h-3 w-3" />
                        Fixed Date
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Notice Window
                      </>
                    )}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-[#0a0a0a] mt-3.5 leading-relaxed font-bold">
                  {ob.description}
                </p>

                {/* Metadata tags */}
                <div className="mt-4 space-y-2 text-[11px] font-mono border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-500 uppercase">Due / Window:</span>
                    <span className="font-black text-[#0a0a0a] uppercase">
                      {ob.dueDateOrPeriod || 'Notice-based'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-500 uppercase">Responsible Entity:</span>
                    <span className="font-bold text-[#0a0a0a]">
                      {ob.responsibleParty || 'Specified'}
                    </span>
                  </div>
                  {ob.pageNumber && (
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-500 uppercase">Source Page:</span>
                      <span className="font-bold text-[#0a0a0a]">PAGE {ob.pageNumber}</span>
                    </div>
                  )}
                </div>

                {/* Excerpt */}
                {ob.excerpt && (
                  <div className="mt-3 border border-[#0a0a0a] bg-[#f9f9f9] p-2.5 font-mono text-[10px] text-gray-700 leading-relaxed">
                    "{ob.excerpt.slice(0, 160)}..."
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t-2 border-[#0a0a0a] flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-gray-500 font-mono">
                  STATUS: {ob.reviewStatus}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(ob.id, 'ACKNOWLEDGED')}
                    disabled={updatingId === ob.id}
                    className={`btn btn-sm ${
                      ob.reviewStatus === 'ACKNOWLEDGED'
                        ? 'btn-primary'
                        : ''
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    <span>Acknowledge</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(ob.id, 'DISMISSED')}
                    disabled={updatingId === ob.id}
                    className="btn btn-sm text-[#c0392b] border-[#c0392b] hover:bg-[#c0392b] hover:text-white"
                  >
                    <X className="h-3 w-3" />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
