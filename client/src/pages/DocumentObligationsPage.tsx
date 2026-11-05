import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, Clock, Calendar, Check, X, Filter, CalendarPlus } from 'lucide-react';
import ApiService from '../services/api.js';
import { InsightsApi } from '../services/insightsApi.js';
import { ReminderControl } from '../components/insights/ReminderControl.js';
import type { ObligationReminder } from '../types/insights.js';
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
      const [docRes, obRes] = await Promise.all([ApiService.getDocumentById(id), ApiService.getObligations(id)]);
      setDocument(docRes.document);
      setObligations(obRes.obligations);
    } catch (err) {
      console.error('Failed to load obligations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // Obligation reminders and calendar export
  const [reminders, setReminders] = useState<Record<string, ObligationReminder>>({});
  const [calendarNote, setCalendarNote] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    InsightsApi.reminders(id).then(r => setReminders(Object.fromEntries(r.reminders.map(x => [x.obligationId, x])))).catch(() => undefined);
  }, [id]);
  const updateReminder = (obligationId: string, reminder: ObligationReminder | null) => setReminders(prev => {
    const next = { ...prev };
    if (reminder) next[obligationId] = reminder; else delete next[obligationId];
    return next;
  });
  const downloadCalendar = async () => {
    if (!id) return;
    try {
      const count = await InsightsApi.downloadCalendar(id);
      setCalendarNote(count
        ? `Downloaded ${count} calendar ${count === 1 ? 'event' : 'events'}. Open the .ics file to add them to Google Calendar, Outlook or your phone.`
        : 'No obligation in this contract has an exact calendar date yet. Set "Remind me" dates and download again.');
    } catch (e: any) {
      setCalendarNote(e.message);
    }
  };

  const handleUpdateStatus = async (obId: string, newStatus: string) => {
    if (!id) return;
    setUpdatingId(obId);
    try {
      const res = await ApiService.updateObligationStatus(id, obId, newStatus);
      setObligations((prev) => prev.map((o) => (o.id === obId ? { ...o, reviewStatus: res.obligation.reviewStatus } : o)));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const categories = ['ALL', 'Payment Deadlines', 'Termination Notice Periods', 'Renewal & Expiry Dates', 'Delivery / Performance Obligations'];
  const filteredObligations = obligations.filter((o) => categoryFilter === 'ALL' || o.category === categoryFilter);

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      <DocumentNavHeader document={document} />

      {/* Header */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <div>
            <h2>Dates & Obligations</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Deadlines, notice windows, covenants, and party assignments
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-default">{obligations.length} identified</span>
            <button type="button" className="btn btn-sm btn-secondary" onClick={downloadCalendar} title="Calendar file with dated obligations and your reminders">
              <CalendarPlus size={13} /> Add to calendar (.ics)
            </button>
          </div>
        </div>
        {calendarNote && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 10 }}>{calendarNote}</p>}

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
            <Filter size={12} /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : ''}`}
              style={{ fontWeight: 500, fontSize: '0.75rem' }}
            >
              {cat === 'ALL' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      ) : filteredObligations.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><CalendarClock size={20} /></div>
            <h3>No obligations found</h3>
            <p>No results for the selected filter.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '12px' }}>
          {filteredObligations.map((ob) => {
            const isAcknowledged = ob.reviewStatus === 'ACKNOWLEDGED';
            const isDismissed = ob.reviewStatus === 'DISMISSED';

            return (
              <div
                key={ob.id}
                style={{
                  background: isAcknowledged ? 'var(--success-bg)' : isDismissed ? 'var(--surface)' : 'var(--white)',
                  border: `1px solid ${isAcknowledged ? '#a8d5b9' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  opacity: isDismissed ? 0.65 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span className="badge badge-default">{ob.category}</span>
                  <span className={`badge ${ob.isCalendarDate ? 'badge-success' : 'badge-info'}`}>
                    {ob.isCalendarDate
                      ? <><Calendar size={10} /> Fixed Date</>
                      : <><Clock size={10} /> Notice Window</>
                    }
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {ob.description}
                </p>

                {/* Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Due / Window</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ob.dueDateOrPeriod || 'Notice-based'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Responsible Party</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ob.responsibleParty || 'Specified'}</span>
                  </div>
                  {ob.pageNumber && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Source Page</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Page {ob.pageNumber}</span>
                    </div>
                  )}
                </div>

                {/* Excerpt */}
                {ob.excerpt && (
                  <div style={{
                    padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)',
                    fontStyle: 'italic', lineHeight: 1.5,
                  }}>
                    "{ob.excerpt.slice(0, 160)}{ob.excerpt.length > 160 ? '…' : ''}"
                  </div>
                )}

                {/* Reminder (in-app notification + calendar export) */}
                {id && <ReminderControl documentId={id} obligationId={ob.id} reminder={reminders[ob.id]} onChange={updateReminder} />}

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {ob.reviewStatus || 'PENDING'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleUpdateStatus(ob.id, 'ACKNOWLEDGED')}
                      disabled={updatingId === ob.id}
                      className={`btn btn-sm ${isAcknowledged ? 'btn-primary' : ''}`}
                    >
                      <Check size={12} />
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(ob.id, 'DISMISSED')}
                      disabled={updatingId === ob.id}
                      className="btn btn-sm"
                      style={{ color: 'var(--danger)' }}
                    >
                      <X size={12} />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
