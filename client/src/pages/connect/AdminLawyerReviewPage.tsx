import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { LawyerAvatar, LawyerStatusBadge, InlineError, formatDate, formatTime } from '../../components/connect/ConnectUi.js';
import { LawyerMap } from '../../components/connect/LawyerMap.js';
import { CREDENTIAL_KIND_LABELS, DAY_NAMES, type AuditEntry, type LawyerStatus, type PublicLawyer } from '../../types/connect.js';

const ACTION_LABELS: Record<string, string> = {
  APPROVE: 'Approve and verify', REJECT: 'Reject', REQUEST_INFO: 'Request more information', SUSPEND: 'Suspend listing', RESTORE: 'Restore listing',
};

export const AdminLawyerReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [lawyer, setLawyer] = useState<any | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    ConnectApi.adminLawyer(id).then(r => { setLawyer(r.lawyer); setHistory(r.history); setAction(''); setReason(''); setReviewed(false); }).catch(e => setError(e.message));
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    let url: string | null = null;
    if (id && lawyer?.hasPhoto) ConnectApi.adminPhoto(id).then(u => { url = u; setPhoto(u); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id, lawyer?.hasPhoto]);

  const decide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !action) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const r = await ConnectApi.adminDecision(id, { action, reason: reason.trim() || undefined, credentialsReviewed: reviewed });
      setMessage(`${r.message} New status: ${r.status.replace(/_/g, ' ').toLowerCase()}.`);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (error && !lawyer) return <div className="page-wrapper"><InlineError message={error} /></div>;
  if (!lawyer) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const office = lawyer.office;
  const mapLawyer = office ? [{ id: lawyer.id, professionalName: lawyer.professionalName, office, legalBuddyVerified: false } as unknown as PublicLawyer] : [];
  const reasonRequired = action && action !== 'APPROVE';

  return (
    <div className="page-wrapper animate-fade-in lb-connect" style={{ maxWidth: 1100 }}>
      <Link to="/connect/admin" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}><ArrowLeft size={15} /> Back to admin</Link>

      <div className="lb-profile-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <LawyerAvatar lawyer={{ id: lawyer.id, hasPhoto: lawyer.hasPhoto, professionalName: lawyer.professionalName }} size={72} src={photo} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ fontSize: '1.4rem' }}>{lawyer.professionalName}</h1>
                {lawyer.professionalTitle && <p>{lawyer.professionalTitle}</p>}
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <LawyerStatusBadge status={lawyer.status as LawyerStatus} />
                  {lawyer.isSynthetic && <span className="badge badge-danger">Synthetic demo record</span>}
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>Account {lawyer.account.email} · registered {formatDate(lawyer.account.createdAt)} · submitted {formatDate(lawyer.submittedAt)}</p>
              </div>
            </div>
            {lawyer.statusReason && <div className="alert alert-warning" style={{ marginTop: 12 }}><AlertTriangle size={16} /><span>Last reason given: {lawyer.statusReason}</span></div>}
          </section>

          <section className="card">
            <h2 className="lb-section-title">Enrollment details to verify</h2>
            <dl className="lb-dl">
              <dt>State Bar Council</dt><dd>{lawyer.barCouncilState}</dd>
              <dt>Enrollment number</dt><dd><strong style={{ fontWeight: 600 }}>{lawyer.enrollmentNumber}</strong></dd>
              <dt>Enrollment date</dt><dd>{lawyer.enrollmentDate ? formatDate(lawyer.enrollmentDate) : 'Not provided'}</dd>
              <dt>Practising since</dt><dd>{lawyer.practiceStartYear || 'Not provided'}</dd>
            </dl>
            <div className="alert alert-info" style={{ marginTop: 12 }}>
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>
                Legal Buddy has no automated Bar Council integration. Compare the details above with the uploaded documents and, where possible, with the
                relevant State Bar Council's official records or verification process before approving.
              </span>
            </div>
          </section>

          <section className="card">
            <h2 className="lb-section-title">Submitted documents ({lawyer.credentials.length})</h2>
            {lawyer.credentials.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No documents uploaded.</p> : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lawyer.credentials.map((c: any) => (
                  <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{CREDENTIAL_KIND_LABELS[c.kind] || c.kind}</p>
                      <p style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{c.originalName} · {Math.ceil(c.sizeBytes / 1024)} KB · {formatDate(c.createdAt)}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>SHA-256 {c.sha256}</p>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => ConnectApi.adminOpenCredential(lawyer.id, c.id).catch(e => setError(e.message))}><Eye size={14} /> Open</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="lb-section-title">Profile</h2>
            <dl className="lb-dl">
              <dt>Specializations</dt><dd>{lawyer.specializations.map((s: any) => s.name).join(', ') || '—'}</dd>
              <dt>Languages</dt><dd>{lawyer.languages.join(', ') || '—'}</dd>
              <dt>Education</dt><dd style={{ whiteSpace: 'pre-line' }}>{lawyer.education || '—'}</dd>
              <dt>Biography</dt><dd style={{ whiteSpace: 'pre-line' }}>{lawyer.bio || '—'}</dd>
              <dt>Consultations</dt><dd>{[lawyer.offersInPerson && 'In-person', lawyer.offersOnline && 'Online'].filter(Boolean).join(', ')} · {lawyer.acceptingRequests ? 'accepting' : 'not accepting'}{lawyer.feeDisclosed && lawyer.consultationFeeInr !== null ? ` · fee ₹${lawyer.consultationFeeInr}` : ''}</dd>
              <dt>Availability</dt><dd>{lawyer.availability.length ? lawyer.availability.map((a: any) => `${DAY_NAMES[a.dayOfWeek].slice(0, 3)} ${formatTime(a.startTime)}–${formatTime(a.endTime)}`).join(', ') : '—'}</dd>
              <dt>Phone</dt><dd>{lawyer.contactPhone || '—'} {lawyer.contactPhone && (lawyer.publishPhone ? '(published)' : '(private)')}</dd>
              <dt>Email</dt><dd>{lawyer.contactEmail || '—'} {lawyer.contactEmail && (lawyer.publishEmail ? '(published)' : '(private)')}</dd>
              <dt>Completion</dt><dd>{lawyer.completion.percent}%{lawyer.completion.missingRequired.length ? ` — missing: ${lawyer.completion.missingRequired.join(', ')}` : ''}</dd>
            </dl>
          </section>

          {lawyer.reports.length > 0 && (
            <section className="card">
              <h2 className="lb-section-title">Reports</h2>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lawyer.reports.map((r: any) => (
                  <li key={r.id} style={{ fontSize: '0.875rem' }}>
                    <strong>{r.reason.replace(/_/g, ' ').toLowerCase()}</strong> · {r.status.toLowerCase()} · {formatDate(r.createdAt)}{r.details ? ` — ${r.details}` : ''}
                  </li>
                ))}
              </ul>
              <Link to="/connect/admin?tab=reports" style={{ fontSize: '0.875rem', color: 'var(--info)' }}>Manage reports</Link>
            </section>
          )}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <h2 className="lb-section-title">Decision</h2>
            {lawyer.allowedActions.length === 0 ? (
              <p style={{ fontSize: '0.875rem' }}>No decision is available for a profile that is {String(lawyer.status).replace(/_/g, ' ').toLowerCase()}.</p>
            ) : (
              <form onSubmit={decide} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lawyer.allowedActions.map((a: string) => (
                    <label key={a} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input type="radio" name="action" value={a} checked={action === a} onChange={() => setAction(a)} /> {ACTION_LABELS[a] || a}
                    </label>
                  ))}
                </div>
                {action && (
                  <>
                    <label className="label" htmlFor="reason" style={{ marginBottom: 0 }}>{reasonRequired ? 'Reason (shown to the lawyer)' : 'Verification note (optional)'}</label>
                    <textarea id="reason" className="input" rows={4} maxLength={2000} required={Boolean(reasonRequired)} value={reason} onChange={e => setReason(e.target.value)}
                      placeholder={action === 'REQUEST_INFO' ? 'e.g. Please upload a clearer copy of your enrollment certificate.' : ''} />
                  </>
                )}
                {action === 'APPROVE' && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} style={{ marginTop: 3 }} />
                    I have personally reviewed the submitted documents and the enrollment details match.
                  </label>
                )}
                {message && <div className="alert alert-success">{message}</div>}
                <InlineError message={error} />
                <button type="submit" className={`btn ${action === 'REJECT' || action === 'SUSPEND' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={busy || !action || (action === 'APPROVE' && !reviewed) || (Boolean(reasonRequired) && reason.trim().length < 3)}>
                  {busy ? 'Saving…' : 'Record decision'}
                </button>
              </form>
            )}
            {lawyer.status === 'VERIFIED' && <Link to={`/connect/lawyers/${lawyer.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}><ExternalLink size={14} /> View public profile</Link>}
          </section>

          {office && (
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px' }}>
                <h2 className="lb-section-title" style={{ marginBottom: 4 }}>Office</h2>
                <p style={{ fontSize: '0.875rem' }}>{office.officeName ? `${office.officeName}, ` : ''}{office.addressLine}{office.locality ? `, ${office.locality}` : ''}, {office.city}, {office.state} {office.postalCode}</p>
              </div>
              <div style={{ height: 220 }}><LawyerMap location={null} radiusKm={1} lawyers={mapLawyer} selectedId={lawyer.id} onSelect={() => undefined} /></div>
            </section>
          )}

          <section className="card">
            <h2 className="lb-section-title">Audit history</h2>
            {history.length === 0 ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No admin decisions yet.</p> : (
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map(h => (
                  <li key={h.id} style={{ fontSize: '0.8125rem', borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{h.action.replace(/^LAWYER_/, '').replace(/_/g, ' ').toLowerCase()}</strong>
                    {' '}· {h.previousStatus?.toLowerCase().replace(/_/g, ' ')} → {h.newStatus?.toLowerCase().replace(/_/g, ' ')}
                    <br />{h.admin.name} ({h.admin.email}) · {new Date(h.createdAt).toLocaleString()}
                    {h.reason && <><br /><span style={{ color: 'var(--text-secondary)' }}>{h.reason}</span></>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
