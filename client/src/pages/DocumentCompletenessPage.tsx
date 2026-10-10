import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileCheck,
  ShieldCheck,
  Info,
  Check,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, CompletenessCheck } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentCompletenessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [checks, setChecks] = useState<CompletenessCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, compRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getCompleteness(id),
      ]);
      setDocument(docRes.document);
      setChecks(compRes.checks);
    } catch (err) {
      console.error('Failed to load completeness checks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleToggleReview = async (checkId: string, currentStatus: boolean) => {
    if (!id) return;
    setUpdatingId(checkId);
    try {
      const res = await ApiService.toggleCompletenessReview(id, checkId, !currentStatus);
      setChecks((prev) =>
        prev.map((c) => (c.id === checkId ? { ...c, isReviewed: res.check.isReviewed } : c))
      );
    } catch (err: any) {
      alert(`Failed to update review status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const foundCount = checks.filter((c) => c.status === 'FOUND').length;
  const needsReviewCount = checks.filter((c) => c.status === 'NEEDS_REVIEW').length;
  const notFoundCount = checks.filter((c) => c.status === 'NOT_FOUND').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      {/* Header & Overview Stats */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#0a0a0a]">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a]">Contract Completeness Checker</h2>
            <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
              Checklist comparison against standard commercial contract governance requirements
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="severity-badge severity-low">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {foundCount} FOUND
            </span>
            <span className="severity-badge severity-high">
              <AlertTriangle className="h-3.5 w-3.5" />
              {needsReviewCount} NEEDS REVIEW
            </span>
            <span className="severity-badge severity-critical">
              <XCircle className="h-3.5 w-3.5" />
              {notFoundCount} NOT FOUND
            </span>
          </div>
        </div>

        {/* Legal Safeguard Notice */}
        <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 text-xs text-gray-700 flex items-start gap-3 shadow-[2px_2px_0_#0a0a0a]">
          <Info className="h-4 w-4 text-[#0a0a0a] shrink-0 mt-0.5" />
          <p className="font-medium">
            <span className="font-black uppercase text-[#0a0a0a] font-mono">Notice on Missing Clauses:</span> An item marked as "Not Found" indicates that standard boilerplate language was not identified in the document scan. A missing section does not automatically invalidate the contract or render it unenforceable.
          </p>
        </div>
      </div>

      {/* Checklist Items */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="spinner"></div>
        </div>
      ) : checks.length === 0 ? (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-12 text-center shadow-[6px_6px_0_#0a0a0a]">
          <FileCheck className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-sm font-black uppercase text-[#0a0a0a]">No checklist items generated</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {checks.map((item) => {
            const isFound = item.status === 'FOUND';
            const isReview = item.status === 'NEEDS_REVIEW';

            return (
              <div
                key={item.id}
                className={`border-2 border-[#0a0a0a] p-5 transition-all shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] ${
                  item.isReviewed
                    ? 'bg-[#f4fbf7]'
                    : isFound
                    ? 'bg-white'
                    : isReview
                    ? 'bg-[#fefdf0]'
                    : 'bg-[#fdf0ef]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isFound ? (
                        <div className="flex h-7 w-7 items-center justify-center border-2 border-[#27ae60] bg-[#eafaf1] text-[#27ae60]">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : isReview ? (
                        <div className="flex h-7 w-7 items-center justify-center border-2 border-[#d35400] bg-[#fef5ec] text-[#d35400]">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center border-2 border-[#c0392b] bg-[#fdf0ef] text-[#c0392b]">
                          <XCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black uppercase tracking-wide text-[#0a0a0a]">{item.expectedSection}</h4>
                        {item.pageNumber && (
                          <span className="border border-gray-300 bg-white px-1.5 py-0.2 text-[10px] font-mono font-bold text-gray-600 uppercase">
                            PAGE {item.pageNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#0a0a0a] mt-1.5 leading-relaxed font-medium">{item.reason}</p>
                    </div>
                  </div>

                  {/* Review Checkbox Action */}
                  <button
                    onClick={() => handleToggleReview(item.id, item.isReviewed)}
                    disabled={updatingId === item.id}
                    className={`btn btn-sm shrink-0 ${
                      item.isReviewed
                        ? 'btn-primary'
                        : ''
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{item.isReviewed ? 'REVIEWED' : 'MARK REVIEWED'}</span>
                  </button>
                </div>

                {/* Excerpt if Found */}
                {item.excerpt && (
                  <div className="mt-4 pt-3 border-t-2 border-[#0a0a0a]">
                    <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3 font-mono text-[11px] text-[#0a0a0a] leading-relaxed">
                      "{item.excerpt}"
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
