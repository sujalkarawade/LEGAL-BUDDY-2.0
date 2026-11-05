import React from 'react';
import { ShieldCheck, MapPin, Briefcase, Video, Users, Languages, AlertTriangle } from 'lucide-react';
import type { PublicLawyer, ConsultationStatus, LawyerStatus } from '../../types/connect.js';
import { publicPhotoUrl } from '../../services/connectApi.js';

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatTime = (hhmm: string | null | undefined) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export const formatInr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** Badge rules: the "verified" badge is shown ONLY for Legal Buddy profiles an admin has verified. */
export const VerificationBadge: React.FC<{ lawyer: Pick<PublicLawyer, 'legalBuddyVerified' | 'source' | 'isSynthetic'> }> = ({ lawyer }) => (
  <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
    {lawyer.legalBuddyVerified ? (
      <span className="badge badge-success" title="A Legal Buddy administrator manually reviewed this lawyer's submitted credentials.">
        <ShieldCheck size={12} /> Credentials reviewed by Legal Buddy
      </span>
    ) : lawyer.source === 'EXTERNAL_DIRECTORY' ? (
      <span className="badge badge-default" title="Listing from an external directory. Not reviewed by Legal Buddy.">External listing · not verified</span>
    ) : (
      <span className="badge badge-warning">Unverified</span>
    )}
    {lawyer.isSynthetic && <span className="badge badge-danger" title="Synthetic demo record, not a real lawyer.">Demo record</span>}
  </span>
);

const CONSULTATION_STATUS: Record<ConsultationStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pending', cls: 'badge-warning' },
  ACCEPTED: { label: 'Accepted', cls: 'badge-info' },
  REJECTED: { label: 'Declined', cls: 'badge-danger' },
  RESCHEDULE_REQUESTED: { label: 'Reschedule requested', cls: 'badge-warning' },
  CONFIRMED: { label: 'Confirmed', cls: 'badge-success' },
  COMPLETED: { label: 'Completed', cls: 'badge-default' },
  CANCELLED: { label: 'Cancelled', cls: 'badge-default' },
};

export const ConsultationStatusBadge: React.FC<{ status: ConsultationStatus }> = ({ status }) => (
  <span className={`badge ${CONSULTATION_STATUS[status]?.cls || 'badge-default'}`}>{CONSULTATION_STATUS[status]?.label || status}</span>
);

const LAWYER_STATUS: Record<LawyerStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft — not submitted', cls: 'badge-default' },
  PENDING_REVIEW: { label: 'Pending verification', cls: 'badge-warning' },
  INFO_REQUESTED: { label: 'More information requested', cls: 'badge-warning' },
  VERIFIED: { label: 'Verified', cls: 'badge-success' },
  REJECTED: { label: 'Rejected', cls: 'badge-danger' },
  SUSPENDED: { label: 'Suspended', cls: 'badge-danger' },
  LISTED: { label: 'External listing', cls: 'badge-default' },
};

export const LawyerStatusBadge: React.FC<{ status: LawyerStatus }> = ({ status }) => (
  <span className={`badge ${LAWYER_STATUS[status]?.cls || 'badge-default'}`}>{LAWYER_STATUS[status]?.label || status}</span>
);

export const LawyerAvatar: React.FC<{ lawyer: Pick<PublicLawyer, 'id' | 'hasPhoto' | 'professionalName'>; size?: number; src?: string | null }> = ({ lawyer, size = 48, src }) => {
  const [failed, setFailed] = React.useState(false);
  const initials = lawyer.professionalName.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const url = src ?? (lawyer.hasPhoto ? publicPhotoUrl(lawyer.id) : null);
  return url && !failed ? (
    <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
  ) : (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--surface-alt)', color: 'var(--text-secondary)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.34, flexShrink: 0,
      border: '1px solid var(--border)',
    }}>{initials || '?'}</span>
  );
};

export const ModeChips: React.FC<{ inPerson: boolean; online: boolean }> = ({ inPerson, online }) => (
  <span style={{ display: 'inline-flex', gap: 10, fontSize: '0.8125rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
    {inPerson && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> In-person</span>}
    {online && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Video size={13} /> Online</span>}
  </span>
);

/** Compact result card used in the results list and as the map preview card. */
export const LawyerResultCard: React.FC<{
  lawyer: PublicLawyer;
  selected?: boolean;
  onClick?: () => void;
  onOpen: () => void;
  compact?: boolean;
}> = ({ lawyer, selected, onClick, onOpen, compact }) => (
  <article
    className="lb-result-card"
    data-selected={selected ? 'true' : undefined}
    onClick={onClick ?? onOpen}
    onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
    tabIndex={0}
    aria-label={`${lawyer.professionalName}${lawyer.distanceKm !== null ? `, ${lawyer.distanceKm} km away` : ''}`}
  >
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <LawyerAvatar lawyer={lawyer} size={compact ? 40 : 48} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <h3 style={{ fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lawyer.professionalName}</h3>
          {lawyer.distanceKm !== null && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{lawyer.distanceKm} km</span>}
        </div>
        {lawyer.professionalTitle && <p style={{ fontSize: '0.875rem', marginTop: 2 }}>{lawyer.professionalTitle}</p>}
        <div style={{ marginTop: 6 }}><VerificationBadge lawyer={lawyer} /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {lawyer.office && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {lawyer.office.locality ? `${lawyer.office.locality}, ` : ''}{lawyer.office.city}</span>}
          {lawyer.yearsOfExperience !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Briefcase size={13} /> {lawyer.yearsOfExperience} yrs experience</span>}
          {lawyer.languages.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Languages size={13} /> {lawyer.languages.slice(0, 3).join(', ')}</span>}
        </div>
        {!compact && lawyer.specializations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {lawyer.specializations.slice(0, 4).map(s => <span key={s.id} className="badge badge-default">{s.name}</span>)}
            {lawyer.specializations.length > 4 && <span className="badge badge-default">+{lawyer.specializations.length - 4}</span>}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          <ModeChips inPerson={lawyer.consultation.offersInPerson} online={lawyer.consultation.offersOnline} />
          {lawyer.consultation.acceptingRequests
            ? <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600 }}>Accepting requests</span>
            : <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Currently unavailable</span>}
        </div>
        {onClick && (
          <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={e => { e.stopPropagation(); onOpen(); }}>
            View profile
          </button>
        )}
      </div>
    </div>
  </article>
);

export const InlineError: React.FC<{ message: string | null }> = ({ message }) => message ? (
  <div className="alert alert-error" role="alert"><AlertTriangle size={16} style={{ flexShrink: 0 }} /><span>{message}</span></div>
) : null;

export const LegalDisclaimer: React.FC = () => (
  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
    Legal Buddy Connect helps you find and contact lawyers. It does not recommend, rank or endorse any lawyer and is not a substitute for professional legal advice.
    Listings are not advertisements and no lawyer pays for placement.
  </p>
);
