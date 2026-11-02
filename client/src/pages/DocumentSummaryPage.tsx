import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, Users, Calendar, CreditCard, Briefcase,
  AlertOctagon, Shield, Clock, RotateCw, HelpCircle, CheckCircle,
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

  useEffect(() => { fetchData(); }, [id]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '320px' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="empty-state card" style={{ marginTop: '40px', maxWidth: '480px', margin: '40px auto' }}>
        <div className="empty-state-icon"><AlertOctagon size={20} /></div>
        <h3>Summary Unavailable</h3>
        <p>{error || 'Could not find a summary for this document.'}</p>
      </div>
    );
  }

  const renderValue = (val: string | null | undefined) => {
    const isEmpty = !val || val.toLowerCase().includes('not found') ||
      val.toLowerCase().includes('not explicitly specified') || val.trim() === '';
    if (isEmpty) {
      return <span className="field-empty">Not found in document</span>;
    }
    const lines = val.split(/\n+/).map(l => l.trim()).filter(Boolean);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {lines.map((line, i) => (
          <p key={i} style={{ color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {line.replace(/^[-•·*]\s*/, '')}
          </p>
        ))}
      </div>
    );
  };

  const sections = [
    { icon: Users,       label: 'Contracting Parties',          value: summary.parties },
    { icon: Briefcase,   label: 'Purpose & Scope',              value: summary.purpose },
    { icon: CreditCard,  label: 'Consideration & Payment',      value: summary.paymentTerms },
    { icon: CheckCircle, label: 'Primary Responsibilities',     value: summary.responsibilities },
    { icon: AlertOctagon,label: 'Termination & Notice',         value: summary.terminationConditions },
    { icon: Shield,      label: 'Confidentiality',              value: summary.confidentialityTerms },
    { icon: Shield,      label: 'Liability Terms',              value: summary.liabilityTerms },
    { icon: Clock,       label: 'Renewal Provisions',           value: summary.renewalProvisions },
    { icon: Calendar,    label: 'Key Deadlines',                value: summary.importantDeadlines },
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }} className="animate-fade-in">
      <DocumentNavHeader document={document} />

      {/* Overview card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <div>
            <h2>Executive Summary</h2>
            {summary.analysisProvider && (
              <span className="badge badge-default" style={{ marginTop: '4px' }}>
                {summary.analysisProvider.includes('groq') || summary.analysisProvider.includes('openrouter')
                  ? 'AI Generated' : 'Rule Engine'}
              </span>
            )}
          </div>
          <button
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="btn btn-sm"
          >
            <RotateCw size={13} style={{ animation: isReanalyzing ? 'spin 0.7s linear infinite' : 'none' }} />
            {isReanalyzing ? 'Re-analyzing…' : 'Refresh Summary'}
          </button>
        </div>

        {/* Quick facts strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { icon: FileText,   label: 'Contract Type',  value: summary.contractType },
            { icon: Calendar,   label: 'Effective Date', value: summary.effectiveDate || 'Not found' },
            { icon: Clock,      label: 'Term / Expiry',  value: summary.endDate || 'Notice-based' },
            { icon: CreditCard, label: 'Payment',        value: summary.paymentTerms && !summary.paymentTerms.includes('Not found') ? summary.paymentTerms.slice(0, 40) + '…' : 'Not specified' },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              style={{
                padding: '14px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              </div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Narrative overview */}
        {summary.rawSummary && (
          <div
            style={{
              padding: '16px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              borderLeft: '3px solid var(--black)',
            }}
          >
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Overview
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {summary.rawSummary.split(/\n+/).filter(Boolean).map((para, i) => (
                <p key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>{para}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detailed sections */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.9375rem' }}>Clause Details</h2>
        </div>
        <div style={{ padding: '4px 20px 8px' }}>
          {sections.map(({ icon: Icon, label, value }) => (
            <div key={label} className="field-row">
              <div className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {label}
              </div>
              <div className="field-value">{renderValue(value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing terms */}
      {summary.missingInfo && (
        <div className="alert alert-warning" style={{ marginTop: '16px' }}>
          <HelpCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: '3px', color: 'var(--warning)' }}>Missing or Unclear Terms</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{summary.missingInfo}</p>
          </div>
        </div>
      )}
    </div>
  );
};
