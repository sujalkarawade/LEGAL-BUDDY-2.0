import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, CalendarPlus, MapPin, GraduationCap, Briefcase, Languages, Flag, Clock, IndianRupee, CheckCircle2 } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { useAuth } from '../../context/AuthContext.js';
import { LawyerMap } from '../../components/connect/LawyerMap.js';
import { ConsultationRequestModal } from '../../components/connect/ConsultationRequestModal.js';
import { LawyerAvatar, VerificationBadge, ModeChips, InlineError, LegalDisclaimer, formatDate, formatTime, formatInr } from '../../components/connect/ConnectUi.js';
import { DAY_NAMES, type PublicLawyer } from '../../types/connect.js';

const REPORT_REASONS: Array<[string, string]> = [
  ['INCORRECT_INFORMATION', 'Incorrect information'],
  ['IMPERSONATION', 'Possible impersonation'],
  ['MISCONDUCT', 'Professional misconduct'],
  ['INAPPROPRIATE_CONTENT', 'Inappropriate content'],
  ['OTHER', 'Other'],
];

export const LawyerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lawyer, setLawyer] = useState<PublicLawyer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ reason: 'INCORRECT_INFORMATION', details: '' });
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    ConnectApi.getLawyer(id).then(r => setLawyer(r.lawyer)).catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="page-wrapper"><InlineError message={error} /><Link to="/connect/find" className="btn btn-secondary" style={{ marginTop: 12 }}>Back to search</Link></div>;
  if (!lawyer) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  const canRequest = user?.role === 'USER' && lawyer.legalBuddyVerified && lawyer.consultation.acceptingRequests;
  const byDay = DAY_NAMES.map((name, day) => ({ name, slots: lawyer.consultation.availability.filter(a => a.dayOfWeek === day) })).filter(d => d.slots.length);

  const submitReport = async () => {
    try {
      const r = await ConnectApi.reportLawyer(lawyer.id, report.reason, report.details);
      setNotice(r.message);
      setShowReport(false);
    } catch (e: any) {
      setReportError(e.message);
    }
  };

  return (
    <div className="page-wrapper animate-fade-in lb-connect" style={{ maxWidth: 1100 }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><ArrowLeft size={15} /> Back</button>

      {notice && <div className="alert alert-success" style={{ marginBottom: 16 }}><CheckCircle2 size={16} /><span>{notice}</span></div>}

      <div className="lb-profile-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <LawyerAvatar lawyer={lawyer} size={84} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <h1 style={{ fontSize: '1.5rem' }}>{lawyer.professionalName}</h1>
                {lawyer.professionalTitle && <p style={{ marginTop: 2 }}>{lawyer.professionalTitle}</p>}
                <div style={{ marginTop: 8 }}><VerificationBadge lawyer={lawyer} /></div>
                {lawyer.verifiedAt && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>Credentials reviewed on {formatDate(lawyer.verifiedAt)}</p>}
              </div>
            </div>
            {lawyer.bio && <p style={{ marginTop: 16, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{lawyer.bio}</p>}
          </section>

          <section className="card">
            <h2 className="lb-section-title">Professional details</h2>
            <dl className="lb-dl">
              <dt><Briefcase size={14} /> Experience</dt><dd>{lawyer.yearsOfExperience !== null ? `${lawyer.yearsOfExperience} years (practising since ${lawyer.practiceStartYear})` : 'Not provided'}</dd>
              <dt>Specializations</dt>
              <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{lawyer.specializations.length ? lawyer.specializations.map(s => <span key={s.id} className="badge badge-default">{s.name}</span>) : 'Not provided'}</dd>
              <dt><Languages size={14} /> Languages</dt><dd>{lawyer.languages.join(', ') || 'Not provided'}</dd>
              <dt><GraduationCap size={14} /> Education</dt><dd style={{ whiteSpace: 'pre-line' }}>{lawyer.education || 'Not provided'}</dd>
              <dt>State Bar Council</dt><dd>{lawyer.barCouncilState}</dd>
              <dt>Enrollment number</dt><dd>{lawyer.enrollmentNumber}</dd>
              {lawyer.enrollmentDate && <><dt>Enrollment date</dt><dd>{formatDate(lawyer.enrollmentDate)}</dd></>}
            </dl>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 12 }}>
              Enrollment details are self-declared and were reviewed by a Legal Buddy administrator against the documents the lawyer submitted.
              Legal Buddy is not connected to any Bar Council database.
            </p>
          </section>

          <section className="card">
            <h2 className="lb-section-title">Consultation</h2>
            <dl className="lb-dl">
              <dt>Modes</dt><dd><ModeChips inPerson={lawyer.consultation.offersInPerson} online={lawyer.consultation.offersOnline} /></dd>
              <dt>Requests</dt><dd>{lawyer.consultation.acceptingRequests ? 'Accepting consultation requests' : 'Currently not accepting requests'}</dd>
              {lawyer.consultation.feeInr !== null && <><dt><IndianRupee size={14} /> Fee</dt><dd>{formatInr(lawyer.consultation.feeInr)} per consultation (as disclosed by the lawyer)</dd></>}
              <dt><Clock size={14} /> Availability</dt>
              <dd>
                {byDay.length ? (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {byDay.map(d => <li key={d.name}><strong style={{ fontWeight: 600 }}>{d.name}:</strong> {d.slots.map(s => `${formatTime(s.startTime)} – ${formatTime(s.endTime)}`).join(', ')}</li>)}
                  </ul>
                ) : 'Not specified'}
              </dd>
            </dl>
          </section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <h2 className="lb-section-title">Contact</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {canRequest ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowRequest(true)}><CalendarPlus size={16} /> Request consultation</button>
              ) : (
                <p style={{ fontSize: '0.875rem' }}>
                  {user?.role !== 'USER' ? 'Consultation requests are available to client accounts.'
                    : !lawyer.consultation.acceptingRequests ? 'This lawyer is not accepting requests right now.'
                      : 'Requests are available only for Legal Buddy verified profiles.'}
                </p>
              )}
              {lawyer.contact.phone ? (
                <a className="btn btn-secondary" href={`tel:${lawyer.contact.phone.replace(/[^\d+]/g, '')}`}><Phone size={16} /> Call {lawyer.contact.phone}</a>
              ) : <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Phone number not published by the lawyer.</p>}
              {lawyer.contact.email ? (
                <a className="btn btn-secondary" href={`mailto:${lawyer.contact.email}`}><Mail size={16} /> Email</a>
              ) : <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Email not published. Use a consultation request instead.</p>}
            </div>
          </section>

          {lawyer.office && (
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px' }}>
                <h2 className="lb-section-title" style={{ marginBottom: 6 }}>Office</h2>
                {lawyer.office.officeName && <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lawyer.office.officeName}</p>}
                <p style={{ display: 'flex', gap: 6 }}><MapPin size={15} style={{ flexShrink: 0, marginTop: 4 }} />
                  <span>{lawyer.office.addressLine}{lawyer.office.locality ? `, ${lawyer.office.locality}` : ''}, {lawyer.office.city}, {lawyer.office.state} {lawyer.office.postalCode}</span>
                </p>
              </div>
              <div style={{ height: 240 }}>
                <LawyerMap location={null} radiusKm={1} lawyers={[lawyer]} selectedId={lawyer.id} onSelect={() => undefined} />
              </div>
              <div style={{ padding: '10px 20px' }}>
                <a href={`https://www.openstreetmap.org/?mlat=${lawyer.office.latitude}&mlon=${lawyer.office.longitude}#map=17/${lawyer.office.latitude}/${lawyer.office.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--info)' }}>
                  Open in OpenStreetMap
                </a>
              </div>
            </section>
          )}

          {user?.role === 'USER' && (
            <section>
              {!showReport ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReport(true)}><Flag size={14} /> Report this profile</button>
              ) : (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <InlineError message={reportError} />
                  <label className="label" htmlFor="rep-reason">Reason</label>
                  <select id="rep-reason" className="input" value={report.reason} onChange={e => setReport(r => ({ ...r, reason: e.target.value }))}>
                    {REPORT_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <textarea className="input" rows={3} maxLength={1000} placeholder="Details (optional)" value={report.details} onChange={e => setReport(r => ({ ...r, details: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={submitReport}>Send report</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReport(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          )}
          <LegalDisclaimer />
        </aside>
      </div>

      {showRequest && (
        <ConsultationRequestModal
          lawyer={lawyer}
          onClose={() => setShowRequest(false)}
          onSubmitted={() => { setShowRequest(false); setNotice('Your request was sent. You can follow its status under My Consultations.'); }}
        />
      )}
    </div>
  );
};
