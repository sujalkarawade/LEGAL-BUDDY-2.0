import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  SearchCode,
  AlertTriangle,
  CheckCircle,
  Flag,
  Filter,
  Shield,
  HelpCircle,
  FileText,
  ChevronDown,
  Info,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, ClauseFinding } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentClausesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [clauses, setClauses] = useState<ClauseFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [updatingClauseId, setUpdatingClauseId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, clauseRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getClauses(id, categoryFilter, riskFilter),
      ]);
      setDocument(docRes.document);
      setClauses(clauseRes.clauses);
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, categoryFilter, riskFilter]);

  const handleStatusUpdate = async (clauseId: string, newStatus: string) => {
    if (!id) return;
    setUpdatingClauseId(clauseId);
    try {
      const res = await ApiService.updateClauseStatus(id, clauseId, newStatus);
      setClauses((prev) =>
        prev.map((c) => (c.id === clauseId ? { ...c, reviewStatus: res.clause.reviewStatus } : c))
      );
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingClauseId(null);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-red-400">
            <AlertTriangle className="h-3 w-3" />
            High Risk
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            Medium Risk
          </span>
        );
      case 'Needs Review':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300">
            <HelpCircle className="h-3 w-3" />
            Needs Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            Standard / Low Risk
          </span>
        );
    }
  };

  const categories = [
    'ALL',
    'Payment',
    'Termination',
    'Confidentiality',
    'Liability',
    'Intellectual Property',
    'Governing Law',
    'Dispute Resolution',
    'Renewal',
    'Penalties',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      {/* Filter and Disclaimer Strip */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[#0a0a0a]">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a]">Clause Analysis & Risk Assessment</h2>
            <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
              Categorized clause provisions, plain-language translation, and counsel review checkpoints
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="border-2 border-[#27ae60] bg-[#eafaf1] text-[#27ae60] px-2 py-1 text-[11px] font-black uppercase font-mono">
              Neural AI (Llama 3.3 70B)
            </span>
            <span className="border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white px-2.5 py-1 text-xs font-black uppercase font-mono">
              {clauses.length} {clauses.length === 1 ? 'CLAUSE' : 'CLAUSES'} IDENTIFIED
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-500 font-mono">
            <Filter className="h-3.5 w-3.5 text-[#0a0a0a]" />
            <span>Category:</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`border-2 border-[#0a0a0a] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono ${
                  categoryFilter === cat
                    ? 'bg-[#0a0a0a] text-white shadow-[2px_2px_0_#888]'
                    : 'bg-white text-[#0a0a0a] hover:bg-[#f0f0f0]'
                }`}
              >
                {cat === 'ALL' ? 'ALL CATEGORIES' : cat}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-gray-500 font-mono">Risk Level:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="border-2 border-[#0a0a0a] bg-white px-2.5 py-1 text-xs font-black uppercase text-[#0a0a0a] font-mono focus:outline-none focus:shadow-[2px_2px_0_#0a0a0a]"
            >
              <option value="ALL">ALL RISK LEVELS</option>
              <option value="High">HIGH RISK</option>
              <option value="Medium">MEDIUM RISK</option>
              <option value="Low">LOW RISK</option>
              <option value="Needs Review">NEEDS REVIEW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Safeguard Notice */}
      <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 flex items-start gap-3 text-xs text-gray-700 shadow-[2px_2px_0_#0a0a0a]">
        <Info className="h-4 w-4 text-[#0a0a0a] shrink-0 mt-0.5" />
        <p className="font-medium">
          <span className="font-black uppercase text-[#0a0a0a] font-mono">Legal Safeguard:</span> Risk ratings are heuristic and semantic analytical indicators to assist human contract review. They do not constitute formal legal determinations of enforceability or statutory validity.
        </p>
      </div>

      {/* Clauses List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="spinner"></div>
        </div>
      ) : clauses.length === 0 ? (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-12 text-center shadow-[6px_6px_0_#0a0a0a]">
          <SearchCode className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-sm font-black uppercase text-[#0a0a0a]">No clauses matching criteria</h3>
          <p className="text-xs text-gray-500 mt-1 uppercase font-mono">
            Try adjusting your category or risk level filters.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {clauses.map((clause) => (
            <div
              key={clause.id}
              className="border-2 border-[#0a0a0a] bg-white p-5 space-y-4 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] shadow-[4px_4px_0_#0a0a0a] transition-all"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[#0a0a0a]">
                <div className="flex items-center gap-2.5">
                  <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-black uppercase font-mono text-[#0a0a0a]">
                    {clause.category}
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-wide text-[#0a0a0a]">{clause.title}</h3>
                  {clause.pageNumber && (
                    <span className="border border-gray-300 bg-white px-1.5 py-0.2 text-[10px] font-mono font-bold text-gray-600 uppercase">
                      PAGE {clause.pageNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {getRiskBadge(clause.riskLevel)}

                  {/* Review Status Pill / Selector */}
                  <div className="flex items-center border-2 border-[#0a0a0a] bg-white p-0.5">
                    <button
                      onClick={() => handleStatusUpdate(clause.id, 'APPROVED')}
                      disabled={updatingClauseId === clause.id}
                      className={`px-2 py-0.5 text-[10px] font-black uppercase font-mono transition-colors cursor-pointer ${
                        clause.reviewStatus === 'APPROVED'
                          ? 'bg-[#27ae60] text-white'
                          : 'text-[#0a0a0a] hover:bg-gray-100'
                      }`}
                      title="Approve Clause"
                    >
                      Approved
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(clause.id, 'FLAGGED')}
                      disabled={updatingClauseId === clause.id}
                      className={`px-2 py-0.5 text-[10px] font-black uppercase font-mono transition-colors cursor-pointer ${
                        clause.reviewStatus === 'FLAGGED'
                          ? 'bg-[#c0392b] text-white'
                          : 'text-[#0a0a0a] hover:bg-gray-100'
                      }`}
                      title="Flag Clause"
                    >
                      Flagged
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(clause.id, 'PENDING')}
                      disabled={updatingClauseId === clause.id}
                      className={`px-2 py-0.5 text-[10px] font-black uppercase font-mono transition-colors cursor-pointer ${
                        clause.reviewStatus === 'PENDING'
                          ? 'bg-[#0a0a0a] text-white'
                          : 'text-[#0a0a0a] hover:bg-gray-100'
                      }`}
                      title="Pending Review"
                    >
                      Pending
                    </button>
                  </div>
                </div>
              </div>

              {/* Original Excerpt Quote */}
              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 text-xs">
                <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase font-black font-mono mb-1.5">
                  <span>Contract Verbatim Excerpt</span>
                  {clause.pageNumber && <span>SOURCE PAGE: {clause.pageNumber}</span>}
                </div>
                <blockquote className="font-mono text-[#0a0a0a] text-[11px] leading-relaxed border-l-[3px] border-[#0a0a0a] pl-3 py-0.5">
                  "{clause.excerpt}"
                </blockquote>
              </div>

              {/* Plain Language & Potential Concern */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border-2 border-gray-200 bg-white p-3.5 border-l-4 border-l-[#0a0a0a]">
                  <p className="font-black uppercase tracking-wider text-xs text-[#0a0a0a] mb-1 font-mono">Plain Language Translation</p>
                  <p className="text-[#0a0a0a] leading-relaxed font-medium">
                    {clause.plainLanguageExplanation}
                  </p>
                </div>

                <div className="border-2 border-gray-200 bg-[#fefdf0] p-3.5 border-l-4 border-l-[#d35400]">
                  <p className="font-black uppercase tracking-wider text-xs text-[#d35400] mb-1 font-mono">Potential Concern / Ambiguity</p>
                  <p className="text-[#0a0a0a] leading-relaxed font-medium">
                    {clause.potentialConcern || 'No abnormal risk patterns detected in this clause.'}
                  </p>
                </div>
              </div>

              {/* Suggested Question for Legal Counsel */}
              {clause.reviewQuestion && (
                <div className="border-2 border-[#1a5276] bg-[#eaf4fb] p-3.5 text-xs flex items-start gap-2.5">
                  <HelpCircle className="h-4 w-4 text-[#1a5276] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black uppercase tracking-wider text-[11px] text-[#1a5276] font-mono">Suggested Review Question:</span>
                    <p className="text-[#0a0a0a] mt-0.5 font-medium leading-relaxed">{clause.reviewQuestion}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
