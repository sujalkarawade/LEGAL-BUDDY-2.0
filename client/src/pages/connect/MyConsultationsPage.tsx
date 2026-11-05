import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FileLock2, Phone, Mail, Search } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { ConsultationStatusBadge, InlineError, formatDate, formatTime } from '../../components/connect/ConnectUi.js';
import type { UserConsultation } from '../../types/connect.js';
import { ClauseReviewPanel } from '../../components/insights/ClauseReviewPanel.js';

const today = () => new Date().toISOString().slice(0, 10);

export const MyConsultationsPage: React.FC = () => {
  const [items, setItems] = useState<UserConsultation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [slot, setSlot] = useState({ date: '', time: '' });
  const [reviewFor, setReviewFor] = useState<string | null>(null);

  const load = () => ConnectApi.myConsultations().then(r => setItems(r.consultations)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const act = async (c: UserConsultation, action: string, extra: { preferredDate?: string; preferredTime?: string } = {}) => {
    if (action === 'CANCEL' && !window.confirm('Cancel this consultation request?')) return;
    if (action === 'REVOKE_DOCUMENT' && !window.confirm('Stop sharing this document with the lawyer?')) return;
    setBusyId(c.id);
    setError(null);
    try {
      const r = await ConnectApi.actOnMyConsultation(c.id, { action, ...extra });
      setItems(list => list?.map(i => (i.id === c.id ? r.consultation : i)) ?? null);
      setRescheduleFor(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-wrapper animate-fade-in lb-connect" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>My consultation requests</h1>
          <p>Track the requests you have sent to lawyers through Legal Buddy Connect.</p>
        </div>
        <Link to="/connect/find" className="btn btn-primary"><Search size={16} /> Find a lawyer</Link>
      </div>

      <InlineError message={error} />

      {!items ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><CalendarClock size={22} /></div>
          <h3>No requests yet</h3>
          <p>When you request a consultation from a lawyer, you can follow its status here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {items.map(c => {
            const open = ['PENDING', 'ACCEPTED', 'RESCHEDULE_REQUESTED', 'CONFIRMED'].includes(c.status);
            const lawyerProposed = c.status === 'RESCHEDULE_REQUESTED' && c.rescheduleRequestedBy === 'LAWYER';
            return (
              <article key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem' }}>
                      {c.lawyer.isListed ? <Link to={`/connect/lawyers/${c.lawyer.id}`} style={{ color: 'inherit' }}>{c.lawyer.professionalName}</Link> : c.lawyer.professionalName}
                    </h3>
                    <p style={{ fontSize: '0.875rem' }}>
                      {c.specialization?.name || 'General enquiry'} · {c.mode === 'ONLINE' ? 'Online' : 'In-person'}{c.lawyer.city ? ` · ${c.lawyer.city}` : ''}
                    </p>
                  </div>
                  <ConsultationStatusBadge status={c.status} />
                </div>

                <dl className="lb-dl" style={{ marginTop: 12 }}>
                  <dt>Requested for</dt><dd>{formatDate(c.preferredDate)} at {formatTime(c.preferredTime)}</dd>
                  {c.scheduledDate && <><dt>Scheduled</dt><dd><strong style={{ fontWeight: 600 }}>{formatDate(c.scheduledDate)} at {formatTime(c.scheduledTime)}</strong></dd></>}
                  {lawyerProposed && <><dt>Lawyer proposed</dt><dd><strong style={{ fontWeight: 600 }}>{formatDate(c.proposedDate)} at {formatTime(c.proposedTime)}</strong></dd></>}
                  {c.lawyerMessage && <><dt>Message from lawyer</dt><dd style={{ whiteSpace: 'pre-line' }}>{c.lawyerMessage}</dd></>}
                  <dt>Your description</dt><dd style={{ whiteSpace: 'pre-line' }}>{c.description}</dd>
                  {c.sharedDocument && (
                    <>
                      <dt><FileLock2 size={14} /> Shared document</dt>
                      <dd>{c.sharedDocument.originalName} — {c.sharedDocument.revokedAt ? `access revoked ${formatDate(c.sharedDocument.revokedAt)}` : `shared ${formatDate(c.sharedDocument.sharedAt)}`}</dd>
                    </>
                  )}
                  {(c.status === 'ACCEPTED' || c.status === 'CONFIRMED') && (c.lawyer.phone || c.lawyer.email) && (
                    <>
                      <dt>Lawyer contact</dt>
                      <dd style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {c.lawyer.phone && <a href={`tel:${c.lawyer.phone.replace(/[^\d+]/g, '')}`}><Phone size={13} /> {c.lawyer.phone}</a>}
                        {c.lawyer.email && <a href={`mailto:${c.lawyer.email}`}><Mail size={13} /> {c.lawyer.email}</a>}
                      </dd>
                    </>
                  )}
                </dl>

                {open && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    {(c.status === 'ACCEPTED' || lawyerProposed) && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'CONFIRM')}>
                        {lawyerProposed ? 'Accept proposed time' : 'Confirm consultation'}
                      </button>
                    )}
                    {c.status !== 'RESCHEDULE_REQUESTED' || lawyerProposed ? (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === c.id} onClick={() => { setRescheduleFor(c.id); setSlot({ date: '', time: '' }); }}>
                        {lawyerProposed ? 'Suggest another time' : 'Change time'}
                      </button>
                    ) : null}
                    {c.sharedDocument && !c.sharedDocument.revokedAt && (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'REVOKE_DOCUMENT')}>Stop sharing document</button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'CANCEL')}>Cancel request</button>
                  </div>
                )}

                {c.sharedDocument?.analysisShared && (
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewFor(r => (r === c.id ? null : c.id))} aria-expanded={reviewFor === c.id}>
                      {reviewFor === c.id ? 'Hide lawyer feedback' : 'Lawyer feedback on clauses'}
                    </button>
                    {reviewFor === c.id && <ClauseReviewPanel consultationId={c.id} mode="USER" />}
                  </div>
                )}

                {rescheduleFor === c.id && (
                  <div className="lb-inline-form">
                    <div><label className="label" htmlFor={`d-${c.id}`}>New date</label><input id={`d-${c.id}`} className="input" type="date" min={today()} value={slot.date} onChange={e => setSlot(s => ({ ...s, date: e.target.value }))} /></div>
                    <div><label className="label" htmlFor={`t-${c.id}`}>New time</label><input id={`t-${c.id}`} className="input" type="time" value={slot.time} onChange={e => setSlot(s => ({ ...s, time: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <button type="button" className="btn btn-primary btn-sm" disabled={!slot.date || !slot.time || busyId === c.id} onClick={() => act(c, 'REQUEST_RESCHEDULE', { preferredDate: slot.date, preferredTime: slot.time })}>Send</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRescheduleFor(null)}>Close</button>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>Sent {formatDate(c.createdAt)} · Last updated {formatDate(c.updatedAt)}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
