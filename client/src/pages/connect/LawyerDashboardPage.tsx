import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Upload, Trash2, Eye, Send, Plus, X, Search, FileLock2, AlertTriangle } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { OfficeLocationPicker } from '../../components/connect/OfficeLocationPicker.js';
import { ClauseReviewPanel } from '../../components/insights/ClauseReviewPanel.js';
import { LawyerAvatar, LawyerStatusBadge, ConsultationStatusBadge, InlineError, formatDate, formatTime } from '../../components/connect/ConnectUi.js';
import {
  BAR_COUNCILS, CREDENTIAL_KIND_LABELS, DAY_NAMES,
  type OwnLawyerProfile, type Specialization, type LawyerConsultation, type ConsultationStatus, type AvailabilitySlot, type GeocodeResult,
} from '../../types/connect.js';

type Tab = 'overview' | 'profile' | 'office' | 'availability' | 'documents' | 'requests';
const TABS: Array<[Tab, string]> = [['overview', 'Overview'], ['profile', 'Profile'], ['office', 'Office'], ['availability', 'Availability'], ['documents', 'Documents'], ['requests', 'Requests']];

interface TabProps { profile: OwnLawyerProfile; setProfile: (p: OwnLawyerProfile) => void }

const Saved: React.FC<{ message: string | null }> = ({ message }) => message ? <div className="alert alert-success"><CheckCircle2 size={16} /><span>{message}</span></div> : null;

// ─── Overview ───────────────────────────────────────────────────────────────
const OverviewTab: React.FC<TabProps & { counts: Record<ConsultationStatus, number> | null; goTo: (t: Tab) => void }> = ({ profile, setProfile, counts, goTo }) => {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = ['DRAFT', 'INFO_REQUESTED', 'REJECTED'].includes(profile.status);

  const submit = async () => {
    setBusy(true); setError(null);
    try { const r = await ConnectApi.submitForReview(); setProfile(r.profile); setMessage(r.message); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const statusText: Record<string, string> = {
    DRAFT: 'Your profile is private. Complete the required items and submit it for review.',
    PENDING_REVIEW: 'An administrator is reviewing your credentials. Your profile is not public yet.',
    INFO_REQUESTED: 'The admin team needs more information. Update your profile or documents and resubmit.',
    VERIFIED: 'Your profile is listed in Find a Lawyer.',
    REJECTED: 'Your profile was not approved. Review the reason below, make corrections and resubmit.',
    SUSPENDED: 'Your public listing is suspended. Contact the Legal Buddy admin team.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p className="section-label">Verification status</p>
            <div style={{ marginTop: 6 }}><LawyerStatusBadge status={profile.status} /></div>
            <p style={{ marginTop: 8 }}>{statusText[profile.status]}</p>
          </div>
          {profile.status === 'VERIFIED' && <Link to={`/connect/lawyers/${profile.id}`} className="btn btn-secondary"><Eye size={16} /> View public profile</Link>}
        </div>
        {profile.statusReason && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}><AlertTriangle size={16} style={{ flexShrink: 0 }} /><div><p style={{ color: 'inherit', fontWeight: 600 }}>Message from the admin team</p><p style={{ color: 'inherit', whiteSpace: 'pre-line' }}>{profile.statusReason}</p></div></div>
        )}
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 className="lb-section-title" style={{ marginBottom: 0 }}>Profile completion</h2>
          <strong>{profile.completion.percent}%</strong>
        </div>
        <div className="lb-progress" style={{ margin: '10px 0 14px' }}><span style={{ width: `${profile.completion.percent}%` }} /></div>
        <ul className="lb-checklist">
          {profile.completion.items.map(i => (
            <li key={i.key} data-done={i.done ? 'true' : undefined}>
              {i.done ? <CheckCircle2 size={16} /> : <Circle size={16} />} {i.label}{i.required && !i.done && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Required</span>}
            </li>
          ))}
        </ul>
        <Saved message={message} />
        <InlineError message={error} />
        {canSubmit && (
          <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy || !profile.completion.readyToSubmit} onClick={submit}>
            <Send size={16} /> {profile.status === 'DRAFT' ? 'Submit for review' : 'Resubmit for review'}
          </button>
        )}
        {canSubmit && !profile.completion.readyToSubmit && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>Complete the required items to enable submission.</p>}
      </section>

      {counts && (
        <section className="lb-stat-row">
          {([['PENDING', 'New requests'], ['ACCEPTED', 'Accepted'], ['CONFIRMED', 'Confirmed'], ['COMPLETED', 'Completed']] as Array<[ConsultationStatus, string]>).map(([s, label]) => (
            <button type="button" key={s} className="stat-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => goTo('requests')}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
              <strong style={{ fontSize: '1.5rem' }}>{counts[s] ?? 0}</strong>
            </button>
          ))}
        </section>
      )}
    </div>
  );
};

// ─── Profile ────────────────────────────────────────────────────────────────
const ProfileTab: React.FC<TabProps> = ({ profile, setProfile }) => {
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [otherLanguage, setOtherLanguage] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    professionalName: profile.professionalName,
    professionalTitle: profile.professionalTitle || '',
    bio: profile.bio || '',
    practiceStartYear: profile.practiceStartYear ? String(profile.practiceStartYear) : '',
    languages: profile.languages,
    education: profile.education || '',
    barCouncilState: profile.barCouncilState,
    enrollmentNumber: profile.enrollmentNumber,
    enrollmentDate: profile.enrollmentDate || '',
    specializationIds: profile.specializations.map(s => s.id),
    offersInPerson: profile.offersInPerson,
    offersOnline: profile.offersOnline,
    acceptingRequests: profile.acceptingRequests,
    feeDisclosed: profile.feeDisclosed,
    consultationFeeInr: profile.consultationFeeInr !== null ? String(profile.consultationFeeInr) : '',
    contactPhone: profile.contactPhone || '',
    publishPhone: profile.publishPhone,
    contactEmail: profile.contactEmail || '',
    publishEmail: profile.publishEmail,
  }));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ConnectApi.getSpecializations().then(r => { setSpecs(r.specializations); setLanguages(r.languages); }).catch(() => undefined);
  }, []);
  useEffect(() => {
    let url: string | null = null;
    if (profile.hasPhoto) ConnectApi.ownPhoto().then(u => { url = u; setPhotoUrl(u); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [profile.hasPhoto]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleIn = (k: 'languages' | 'specializationIds', v: string) => setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        professionalTitle: form.professionalTitle, bio: form.bio, education: form.education,
        practiceStartYear: form.practiceStartYear ? Number(form.practiceStartYear) : null,
        languages: form.languages, specializationIds: form.specializationIds,
        offersInPerson: form.offersInPerson, offersOnline: form.offersOnline, acceptingRequests: form.acceptingRequests,
        feeDisclosed: form.feeDisclosed, consultationFeeInr: form.consultationFeeInr ? Number(form.consultationFeeInr) : null,
        contactPhone: form.contactPhone, publishPhone: form.publishPhone, contactEmail: form.contactEmail, publishEmail: form.publishEmail,
      };
      if (!profile.identityLocked) Object.assign(payload, {
        professionalName: form.professionalName, barCouncilState: form.barCouncilState, enrollmentNumber: form.enrollmentNumber, enrollmentDate: form.enrollmentDate || null,
      });
      const r = await ConnectApi.updateLawyerProfile(payload);
      setProfile(r.profile); setMessage(r.message);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try { const r = await ConnectApi.uploadPhoto(file); setProfile(r.profile); setMessage(r.message); }
    catch (err: any) { setError(err.message); }
  };

  const allLanguages = [...new Set([...languages, ...form.languages])];
  const year = new Date().getFullYear();

  return (
    <form onSubmit={save} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <LawyerAvatar lawyer={{ id: profile.id, hasPhoto: profile.hasPhoto, professionalName: form.professionalName }} size={72} src={photoUrl} />
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
          <Upload size={14} /> {profile.hasPhoto ? 'Change photo' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png" hidden onChange={e => uploadPhoto(e.target.files?.[0])} />
        </label>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>JPG or PNG, up to 2 MB. Shown publicly once verified.</span>
      </div>

      <fieldset className="lb-fieldset">
        <legend>Identity and enrollment</legend>
        {profile.identityLocked && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 10 }}>These fields are locked while your profile is under review or verified. Contact the admin team to change them.</p>}
        <div className="lb-form-grid">
          <div><label className="label" htmlFor="p-name">Professional name</label><input id="p-name" className="input" required disabled={profile.identityLocked} value={form.professionalName} onChange={e => set('professionalName', e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="p-council">State Bar Council</label>
            <select id="p-council" className="input" disabled={profile.identityLocked} value={form.barCouncilState} onChange={e => set('barCouncilState', e.target.value)}>
              {BAR_COUNCILS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="p-enr">Enrollment number</label><input id="p-enr" className="input" required disabled={profile.identityLocked} value={form.enrollmentNumber} onChange={e => set('enrollmentNumber', e.target.value)} /></div>
          <div><label className="label" htmlFor="p-enrdate">Enrollment date (optional)</label><input id="p-enrdate" className="input" type="date" disabled={profile.identityLocked} value={form.enrollmentDate} onChange={e => set('enrollmentDate', e.target.value)} /></div>
        </div>
      </fieldset>

      <fieldset className="lb-fieldset">
        <legend>Professional details</legend>
        <div className="lb-form-grid">
          <div><label className="label" htmlFor="p-title">Professional title</label><input id="p-title" className="input" maxLength={120} value={form.professionalTitle} onChange={e => set('professionalTitle', e.target.value)} placeholder="e.g. Advocate, High Court" /></div>
          <div><label className="label" htmlFor="p-year">Practising since (year)</label><input id="p-year" className="input" type="number" min={1950} max={year} value={form.practiceStartYear} onChange={e => set('practiceStartYear', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="label" htmlFor="p-bio">Professional biography</label><textarea id="p-bio" className="input" rows={5} maxLength={3000} value={form.bio} onChange={e => set('bio', e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label className="label" htmlFor="p-edu">Education and qualifications</label><textarea id="p-edu" className="input" rows={3} maxLength={2000} value={form.education} onChange={e => set('education', e.target.value)} placeholder="e.g. LL.B., University of Mumbai (2014)" /></div>
      </fieldset>

      <fieldset className="lb-fieldset">
        <legend>Specializations (up to 8)</legend>
        <div className="lb-check-grid">
          {specs.map(s => (
            <label key={s.id}><input type="checkbox" checked={form.specializationIds.includes(s.id)} disabled={!form.specializationIds.includes(s.id) && form.specializationIds.length >= 8} onChange={() => toggleIn('specializationIds', s.id)} /> {s.name}</label>
          ))}
        </div>
      </fieldset>

      <fieldset className="lb-fieldset">
        <legend>Languages</legend>
        <div className="lb-check-grid">
          {allLanguages.map(l => <label key={l}><input type="checkbox" checked={form.languages.includes(l)} onChange={() => toggleIn('languages', l)} /> {l}</label>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 360 }}>
          <input className="input" placeholder="Add another language" value={otherLanguage} onChange={e => setOtherLanguage(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const v = otherLanguage.trim(); if (v && !form.languages.includes(v)) set('languages', [...form.languages, v]); setOtherLanguage(''); }}>Add</button>
        </div>
      </fieldset>

      <fieldset className="lb-fieldset">
        <legend>Consultations</legend>
        <div className="lb-check-grid">
          <label><input type="checkbox" checked={form.offersInPerson} onChange={e => set('offersInPerson', e.target.checked)} /> In-person consultations</label>
          <label><input type="checkbox" checked={form.offersOnline} onChange={e => set('offersOnline', e.target.checked)} /> Online consultations</label>
          <label><input type="checkbox" checked={form.acceptingRequests} onChange={e => set('acceptingRequests', e.target.checked)} /> Accepting new requests</label>
          <label><input type="checkbox" checked={form.feeDisclosed} onChange={e => set('feeDisclosed', e.target.checked)} /> Show my consultation fee</label>
        </div>
        {form.feeDisclosed && (
          <div style={{ marginTop: 10, maxWidth: 240 }}><label className="label" htmlFor="p-fee">Fee per consultation (₹)</label><input id="p-fee" className="input" type="number" min={0} value={form.consultationFeeInr} onChange={e => set('consultationFeeInr', e.target.value)} /></div>
        )}
      </fieldset>

      <fieldset className="lb-fieldset">
        <legend>Professional contact details</legend>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 10 }}>Admins can always see these. They appear on your public profile only if you choose to publish them.</p>
        <div className="lb-form-grid">
          <div>
            <label className="label" htmlFor="p-phone">Office phone</label>
            <input id="p-phone" className="input" type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
            <label style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.875rem' }}><input type="checkbox" checked={form.publishPhone} onChange={e => set('publishPhone', e.target.checked)} /> Publish on my profile</label>
          </div>
          <div>
            <label className="label" htmlFor="p-email">Professional email</label>
            <input id="p-email" className="input" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
            <label style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.875rem' }}><input type="checkbox" checked={form.publishEmail} onChange={e => set('publishEmail', e.target.checked)} /> Publish on my profile</label>
          </div>
        </div>
      </fieldset>

      <Saved message={message} />
      <InlineError message={error} />
      <div><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  );
};

// ─── Office ─────────────────────────────────────────────────────────────────
const OfficeTab: React.FC<TabProps> = ({ profile, setProfile }) => {
  const o = profile.office;
  const [form, setForm] = useState({
    officeName: o?.officeName || '', addressLine: o?.addressLine || '', locality: o?.locality || '',
    city: o?.city || '', state: o?.state || '', postalCode: o?.postalCode || '',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(o ? { lat: o.latitude, lng: o.longitude } : null);
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const locate = async () => {
    setError(null); setResults(null);
    const q = [form.addressLine, form.locality, form.city, form.state, form.postalCode].filter(Boolean).join(', ');
    if (q.length < 6) { setError('Enter the address, city and PIN code first.'); return; }
    setBusy(true);
    try {
      let r = await ConnectApi.geocode(q);
      // Fall back to a coarser query; the lawyer then drags the pin to the exact building.
      if (!r.results.length && form.postalCode) r = await ConnectApi.geocode(`${form.locality ? `${form.locality}, ` : ''}${form.city} ${form.postalCode}`);
      if (!r.results.length) setError('The address could not be found. Click on the map to place your office manually.');
      else setResults(r.results);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) { setError('Set your office location on the map before saving.'); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const r = await ConnectApi.updateOffice({ ...form, officeName: form.officeName || null, locality: form.locality || null, latitude: coords.lat, longitude: coords.lng });
      setProfile(r.profile); setMessage(r.message);
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="lb-form-grid">
        <div><label className="label" htmlFor="o-name">Office / chamber name (optional)</label><input id="o-name" className="input" value={form.officeName} onChange={set('officeName')} /></div>
        <div><label className="label" htmlFor="o-addr">Office address</label><input id="o-addr" className="input" required value={form.addressLine} onChange={set('addressLine')} placeholder="Building, street" /></div>
        <div><label className="label" htmlFor="o-loc">Area / locality</label><input id="o-loc" className="input" value={form.locality} onChange={set('locality')} /></div>
        <div><label className="label" htmlFor="o-city">City</label><input id="o-city" className="input" required value={form.city} onChange={set('city')} /></div>
        <div><label className="label" htmlFor="o-state">State</label><input id="o-state" className="input" required value={form.state} onChange={set('state')} /></div>
        <div><label className="label" htmlFor="o-pin">PIN code</label><input id="o-pin" className="input" required inputMode="numeric" pattern="[1-9][0-9]{5}" value={form.postalCode} onChange={set('postalCode')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={locate} disabled={busy}><Search size={15} /> Find address on map</button>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Then drag the pin to your exact building, or click the map to place it.</span>
      </div>
      {results && (
        <ul className="lb-place-results">
          {results.map((r, i) => (
            <li key={i}><button type="button" onClick={() => { setCoords({ lat: r.latitude, lng: r.longitude }); setResults(null); }}>{r.label}</button></li>
          ))}
        </ul>
      )}
      <OfficeLocationPicker value={coords} onChange={(lat, lng) => setCoords({ lat, lng })} />
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {coords ? `Pin: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'No location set yet.'} This location is shown publicly once your profile is verified.
      </p>
      <Saved message={message} />
      <InlineError message={error} />
      <div><button type="submit" className="btn btn-primary" disabled={busy || !coords}>Save office</button></div>
    </form>
  );
};

// ─── Availability ───────────────────────────────────────────────────────────
const AvailabilityTab: React.FC<TabProps> = ({ profile, setProfile }) => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>(profile.availability);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<AvailabilitySlot>) => setSlots(s => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    const bad = slots.find(s => s.startTime >= s.endTime);
    if (bad) { setError(`On ${DAY_NAMES[bad.dayOfWeek]}, the start time must be before the end time.`); return; }
    setSaving(true); setError(null); setMessage(null);
    try { const r = await ConnectApi.updateAvailability(slots); setProfile(r.profile); setSlots(r.profile.availability); setMessage(r.message); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p>Add the days and hours when you usually take consultations. Clients see these as a guide; every request still needs your acceptance.</p>
      {slots.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No time slots yet.</p>}
      {slots.map((s, i) => (
        <div key={i} className="lb-slot-row">
          <select className="input" aria-label="Day" value={s.dayOfWeek} onChange={e => update(i, { dayOfWeek: Number(e.target.value) })}>
            {DAY_NAMES.map((d, n) => <option key={d} value={n}>{d}</option>)}
          </select>
          <input className="input" type="time" aria-label="Start time" value={s.startTime} onChange={e => update(i, { startTime: e.target.value })} />
          <span aria-hidden="true">to</span>
          <input className="input" type="time" aria-label="End time" value={s.endTime} onChange={e => update(i, { endTime: e.target.value })} />
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove slot" onClick={() => setSlots(x => x.filter((_, j) => j !== i))}><X size={16} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={slots.length >= 28} onClick={() => setSlots(s => [...s, { dayOfWeek: 1, startTime: '10:00', endTime: '13:00' }])}><Plus size={14} /> Add time slot</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save availability'}</button>
      </div>
      <Saved message={message} />
      <InlineError message={error} />
    </section>
  );
};

// ─── Documents ──────────────────────────────────────────────────────────────
const DocumentsTab: React.FC<TabProps> = ({ profile, setProfile }) => {
  const [kind, setKind] = useState('ENROLLMENT_CERTIFICATE');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try { const r = await ConnectApi.uploadCredential(file, kind); setProfile(r.profile); setFile(null); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Remove this document?')) return;
    try { const r = await ConnectApi.deleteCredential(id); setProfile(r.profile); } catch (e: any) { setError(e.message); }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="alert alert-info"><FileLock2 size={16} style={{ flexShrink: 0 }} />
        <span>Documents are stored privately and are visible only to you and Legal Buddy administrators. They are never shown on your public profile.
          Submitting a document does not by itself verify you — an administrator reviews it manually.</span>
      </div>
      {profile.credentialsEditable ? (
        <div className="lb-upload-row">
          <select className="input" aria-label="Document type" value={kind} onChange={e => setKind(e.target.value)}>
            {Object.entries(CREDENTIAL_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} aria-label="Choose file" />
          <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={upload}><Upload size={15} /> {busy ? 'Uploading…' : 'Upload'}</button>
        </div>
      ) : <p style={{ fontSize: '0.875rem' }}>Documents cannot be changed while your profile is under review or verified.</p>}
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>PDF, JPG or PNG, up to 5 MB each, maximum 10 documents.</p>
      <InlineError message={error} />
      {profile.credentials.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No documents uploaded yet.</p> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {profile.credentials.map(c => (
                <tr key={c.id}>
                  <td>{CREDENTIAL_KIND_LABELS[c.kind] || c.kind}</td>
                  <td style={{ wordBreak: 'break-all' }}>{c.originalName} <span style={{ color: 'var(--text-muted)' }}>({Math.ceil(c.sizeBytes / 1024)} KB)</span></td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => ConnectApi.openOwnCredential(c.id).catch(e => setError(e.message))}><Eye size={14} /> View</button>
                    {profile.credentialsEditable && <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}><Trash2 size={14} /> Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ─── Requests ───────────────────────────────────────────────────────────────
const RequestsTab: React.FC<{ suspended: boolean; onChanged: () => void }> = ({ suspended, onChanged }) => {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<LawyerConsultation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [slot, setSlot] = useState({ date: '', time: '', message: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);

  const load = () => ConnectApi.lawyerConsultations(status || undefined).then(r => setItems(r.consultations)).catch(e => setError(e.message));
  useEffect(() => { setItems(null); load(); }, [status]);

  const act = async (c: LawyerConsultation, action: string, extra: Record<string, string> = {}) => {
    if ((action === 'REJECT' || action === 'CANCEL') && !window.confirm(action === 'REJECT' ? 'Decline this request?' : 'Cancel this consultation?')) return;
    setBusyId(c.id); setError(null);
    try {
      const r = await ConnectApi.actOnLawyerConsultation(c.id, { action, ...extra });
      setItems(list => list?.map(i => (i.id === c.id ? r.consultation : i)) ?? null);
      setProposeFor(null);
      onChanged();
    } catch (e: any) { setError(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {suspended && <div className="alert alert-error"><AlertTriangle size={16} /><span>Your profile is suspended, so you cannot act on requests.</span></div>}
      <div style={{ maxWidth: 260 }}>
        <label className="label" htmlFor="rq-status">Show</label>
        <select id="rq-status" className="input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All requests</option>
          <option value="PENDING">Pending</option>
          <option value="RESCHEDULE_REQUESTED">Reschedule requested</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <InlineError message={error} />
      {!items ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
        : items.length === 0 ? <div className="card empty-state"><h3>No requests</h3><p>Consultation requests from clients will appear here.</p></div>
          : items.map(c => {
            const userAsked = c.status === 'RESCHEDULE_REQUESTED' && c.rescheduleRequestedBy === 'USER';
            const canDecide = c.status === 'PENDING' || userAsked;
            return (
              <article key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem' }}>{c.contactName}</h3>
                    <p style={{ fontSize: '0.875rem' }}>{c.specialization?.name || 'General enquiry'} · {c.mode === 'ONLINE' ? 'Online' : 'In-person'}</p>
                  </div>
                  <ConsultationStatusBadge status={c.status} />
                </div>
                <dl className="lb-dl" style={{ marginTop: 12 }}>
                  <dt>Preferred</dt><dd>{formatDate(c.preferredDate)} at {formatTime(c.preferredTime)}{userAsked && ' (new time requested by client)'}</dd>
                  {c.scheduledDate && <><dt>Scheduled</dt><dd>{formatDate(c.scheduledDate)} at {formatTime(c.scheduledTime)}</dd></>}
                  {c.status === 'RESCHEDULE_REQUESTED' && c.rescheduleRequestedBy === 'LAWYER' && <><dt>You proposed</dt><dd>{formatDate(c.proposedDate)} at {formatTime(c.proposedTime)} — waiting for the client</dd></>}
                  <dt>Issue</dt><dd style={{ whiteSpace: 'pre-line' }}>{c.description}</dd>
                  {c.userMessage && <><dt>Client note</dt><dd style={{ whiteSpace: 'pre-line' }}>{c.userMessage}</dd></>}
                  <dt>Contact</dt><dd>{c.contactPhone} · {c.contactEmail}</dd>
                  {c.sharedDocument && (
                    <><dt>Shared document</dt><dd><button type="button" className="btn btn-ghost btn-sm" onClick={() => ConnectApi.openSharedDocument(c.id).catch(e => setError(e.message))}><FileLock2 size={14} /> {c.sharedDocument.originalName}</button></dd></>
                  )}
                </dl>
                {c.sharedDocument?.analysisShared && !suspended && (
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewFor(r => (r === c.id ? null : c.id))} aria-expanded={reviewFor === c.id}>
                      {reviewFor === c.id ? 'Hide clause review' : 'Review clauses with the client'}
                    </button>
                    {reviewFor === c.id && <ClauseReviewPanel consultationId={c.id} mode="LAWYER" />}
                  </div>
                )}
                {!suspended && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {canDecide && <button type="button" className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'ACCEPT')}>Accept</button>}
                    {['PENDING', 'ACCEPTED', 'CONFIRMED'].includes(c.status) || userAsked
                      ? <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === c.id} onClick={() => { setProposeFor(c.id); setSlot({ date: '', time: '', message: '' }); }}>Propose another time</button> : null}
                    {canDecide && <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'REJECT')}>Decline</button>}
                    {c.status === 'CONFIRMED' && <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'COMPLETE')}>Mark completed</button>}
                    {['ACCEPTED', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(c.status) && <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => act(c, 'CANCEL')}>Cancel</button>}
                  </div>
                )}
                {proposeFor === c.id && (
                  <div className="lb-inline-form">
                    <div><label className="label" htmlFor={`pd-${c.id}`}>Date</label><input id={`pd-${c.id}`} className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={slot.date} onChange={e => setSlot(s => ({ ...s, date: e.target.value }))} /></div>
                    <div><label className="label" htmlFor={`pt-${c.id}`}>Time</label><input id={`pt-${c.id}`} className="input" type="time" value={slot.time} onChange={e => setSlot(s => ({ ...s, time: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label className="label" htmlFor={`pm-${c.id}`}>Message (optional)</label><input id={`pm-${c.id}`} className="input" maxLength={1000} value={slot.message} onChange={e => setSlot(s => ({ ...s, message: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-primary btn-sm" disabled={!slot.date || !slot.time || busyId === c.id} onClick={() => act(c, 'PROPOSE_TIME', { proposedDate: slot.date, proposedTime: slot.time, ...(slot.message ? { message: slot.message } : {}) })}>Send proposal</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setProposeFor(null)}>Close</button>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>Received {formatDate(c.createdAt)}</p>
              </article>
            );
          })}
    </section>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────
export const LawyerDashboardPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] || 'overview') as Tab;
  const [profile, setProfile] = useState<OwnLawyerProfile | null>(null);
  const [counts, setCounts] = useState<Record<ConsultationStatus, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => ConnectApi.myLawyerProfile().then(r => { setProfile(r.profile); setCounts(r.consultationCounts); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const goTo = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t });

  if (error) return <InlineError message={error} />;
  if (!profile) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  return (
    <div className="page-wrapper animate-fade-in lb-connect" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Lawyer dashboard</h1>
          <p>Manage your Legal Buddy Connect profile and consultation requests.</p>
        </div>
        <LawyerStatusBadge status={profile.status} />
      </div>
      <nav className="tab-nav" style={{ marginBottom: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} aria-label="Dashboard sections">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" className={`tab-item${tab === t ? ' active' : ''}`} onClick={() => goTo(t)} aria-current={tab === t ? 'page' : undefined}>
            {label}{t === 'requests' && counts?.PENDING ? <span className="badge badge-warning" style={{ marginLeft: 4 }}>{counts.PENDING}</span> : null}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <OverviewTab profile={profile} setProfile={setProfile} counts={counts} goTo={goTo} />}
      {tab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
      {tab === 'office' && <OfficeTab profile={profile} setProfile={setProfile} />}
      {tab === 'availability' && <AvailabilityTab profile={profile} setProfile={setProfile} />}
      {tab === 'documents' && <DocumentsTab profile={profile} setProfile={setProfile} />}
      {tab === 'requests' && <RequestsTab suspended={profile.status === 'SUSPENDED'} onChanged={load} />}
    </div>
  );
};
