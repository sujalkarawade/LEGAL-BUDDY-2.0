import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Users,
  Calendar,
  CreditCard,
  Briefcase,
  AlertOctagon,
  Shield,
  Clock,
  RotateCw,
  HelpCircle,
  CheckCircle,
  ExternalLink,
  Scale,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, ContractSummary } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentSummaryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [docRes, sumRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getSummary(id),
      ]);
      setDocument(docRes.document);
      setSummary(sumRes.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load contract summary.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleReanalyze = async () => {
    if (!id) return;
    setIsReanalyzing(true);
    try {
      const res = await ApiService.reanalyzeSummary(id);
      setSummary(res.summary);
    } catch (err: any) {
      alert(`Re-analysis failed: ${err.message}`);
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin border-3 border-[#0a0a0a] border-t-transparent"></div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="border-[3px] border-[#0a0a0a] bg-white p-8 text-center max-w-lg mx-auto mt-12 shadow-[6px_6px_0_#0a0a0a]">
        <AlertOctagon className="h-10 w-10 text-[#c0392b] mx-auto mb-3" />
        <h3 className="text-base font-black uppercase tracking-wider text-[#0a0a0a]">Summary Unavailable</h3>
        <p className="text-xs font-mono text-[#666666] mt-1">{error || 'Could not find summary for this document.'}</p>
      </div>
    );
  }

  const renderValueOrNotFound = (val: string | null | undefined) => {
    if (!val || val.toLowerCase().includes('not found') || val.trim() === '') {
      return (
        <span className="italic text-[#888888] font-mono text-xs">
          Not found in document
        </span>
      );
    }
    return <p className="text-[#0a0a0a] text-xs leading-relaxed font-mono">{val}</p>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      {/* Top Overview & Re-analyze Toolbar */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#0a0a0a]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a]">Executive Contract Summary</h2>
              <p className="text-[11px] text-gray-600 font-medium uppercase tracking-wider">
                Ground-truth extraction of key covenants, consideration, and obligations
              </p>
            </div>
          </div>

          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="btn btn-sm btn-primary"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
            <span>{isReanalyzing ? 'Re-analyzing...' : 'Refresh Summary'}</span>
          </button>
        </div>

        {/* High-level Narrative Overview */}
        {summary.rawSummary && (
          <div className="mt-5 border-2 border-[#0a0a0a] bg-[#f9f9f9] p-4 text-xs text-[#0a0a0a] font-medium leading-relaxed shadow-[2px_2px_0_#0a0a0a]">
            <p className="font-black uppercase tracking-wider text-xs text-[#0a0a0a] mb-1 font-mono">Overview Synthesis:</p>
            {summary.rawSummary}
          </div>
        )}

        {/* Quick Facts Strip */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_#0a0a0a] hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-2 text-[#0a0a0a] mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Contract Type</span>
            </div>
            <p className="text-xs font-black uppercase text-[#0a0a0a]">{summary.contractType}</p>
          </div>

          <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_#0a0a0a] hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-2 text-[#0a0a0a] mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Effective Date</span>
            </div>
            <p className="text-xs font-bold font-mono text-[#0a0a0a]">
              {summary.effectiveDate || 'Not found'}
            </p>
          </div>

          <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_#0a0a0a] hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-2 text-[#0a0a0a] mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Term / Expiration</span>
            </div>
            <p className="text-xs font-bold font-mono text-[#0a0a0a]">
              {summary.endDate || 'Notice / Term-based'}
            </p>
          </div>

          <div className="border-2 border-[#0a0a0a] bg-white p-4 shadow-[3px_3px_0_#0a0a0a] hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-2 text-[#0a0a0a] mb-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Payment Terms</span>
            </div>
            <p className="text-xs font-bold text-[#0a0a0a] truncate">
              {summary.paymentTerms && !summary.paymentTerms.includes('Not found')
                ? summary.paymentTerms.slice(0, 35) + '...'
                : 'Not specified'}
            </p>
          </div>
        </div>
      </div>

      {/* Structured Core Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Identified Contracting Parties */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <Users className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Contracting Parties
            </h3>
          </div>
          {renderValueOrNotFound(summary.parties)}
        </div>

        {/* Business Purpose / Scope */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <Briefcase className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Operative Purpose & Recitals
            </h3>
          </div>
          {renderValueOrNotFound(summary.purpose)}
        </div>

        {/* Payment & Financial Terms */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <CreditCard className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Consideration & Payment Terms
            </h3>
          </div>
          {renderValueOrNotFound(summary.paymentTerms)}
        </div>

        {/* Main Responsibilities */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <CheckCircle className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Primary Responsibilities
            </h3>
          </div>
          {renderValueOrNotFound(summary.responsibilities)}
        </div>

        {/* Termination & Breach */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <AlertOctagon className="h-4 w-4 text-[#c0392b]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Termination Conditions & Notice
            </h3>
          </div>
          {renderValueOrNotFound(summary.terminationConditions)}
        </div>

        {/* Confidentiality & Liability */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <Shield className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Confidentiality & Liability Terms
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase font-mono">Confidentiality:</p>
              {renderValueOrNotFound(summary.confidentialityTerms)}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase font-mono">Liability Cap:</p>
              {renderValueOrNotFound(summary.liabilityTerms)}
            </div>
          </div>
        </div>

        {/* Renewal & Deadlines */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a] mb-3">
            <Clock className="h-4 w-4 text-[#0a0a0a]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">
              Renewal & Critical Deadlines
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase font-mono">Renewal Provisions:</p>
              {renderValueOrNotFound(summary.renewalProvisions)}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase font-mono">Deadlines:</p>
              {renderValueOrNotFound(summary.importantDeadlines)}
            </div>
          </div>
        </div>

        {/* Missing or Unclear Information Banner */}
        <div className="border-2 border-[#b7950b] bg-[#fefdf0] p-5 shadow-[4px_4px_0_#b7950b] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#b7950b] mb-3">
            <HelpCircle className="h-4 w-4 text-[#b7950b]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#b7950b]">
              Missing or Unclear Terms
            </h3>
          </div>
          <p className="text-xs text-[#0a0a0a] leading-relaxed font-medium">
            {summary.missingInfo || 'No structural deficiencies detected.'}
          </p>
        </div>
      </div>
    </div>
  );
};
