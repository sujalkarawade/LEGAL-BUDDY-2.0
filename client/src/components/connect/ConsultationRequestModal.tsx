import React, { useEffect, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import ApiService from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { InlineError } from './ConnectUi.js';
import type { PublicLawyer, Specialization } from '../../types/connect.js';
import type { DocumentRecord } from '../../types/index.js';

const today = () => new Date().toISOString().slice(0, 10);
const maxDate = () => { const d = new Date(); d.setDate(d.getDate() + 180); return d.toISOString().slice(0, 10); };

export const ConsultationRequestModal: React.FC<{ lawyer: PublicLawyer; onClose: () => void; onSubmitted: () => void }> = ({ lawyer, onClose, onSubmitted }) => {
  const { user } = useAuth();
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [form, setForm] = useState({
    contactName: user?.name || '',
    contactPhone: '',
    contactEmail: user?.email || '',
    specializationId: lawyer.specializations[0]?.id || '',
    description: '',
    mode: lawyer.consultation.offersInPerson ? 'IN_PERSON' : 'ONLINE',
    preferredDate: '',
    preferredTime: '',
    sharedDocumentId: '',
  });
  const [consent, setConsent] = useState(false);
  const [shareAnalysis, setShareAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ConnectApi.getSpecializations().then(r => setSpecializations(r.specializations)).catch(() => undefined);
    ApiService.getDocuments().then(r => setDocuments(r.documents || [])).catch(() => undefined);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.description.trim().length < 20) { setError('Please describe your issue in at least 20 characters.'); return; }
    if (form.sharedDocumentId && !consent) { setError('Tick the consent box to share the selected document, or choose "Do not share a document".'); return; }
    setSubmitting(true);
    try {
      await ConnectApi.createConsultation({
        lawyerId: lawyer.id,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        specializationId: form.specializationId || null,
        description: form.description,
        mode: form.mode,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        sharedDocumentId: form.sharedDocumentId || null,
        documentShareConsent: Boolean(form.sharedDocumentId && consent),
        analysisShareConsent: Boolean(form.sharedDocumentId && consent && shareAnalysis),
      });
      onSubmitted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal lb-modal-wide" role="dialog" aria-modal="true" aria-labelledby="req-title" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 id="req-title" style={{ fontSize: '1.15rem' }}>Request a consultation</h2>
            <p style={{ fontSize: '0.875rem', marginTop: 2 }}>with {lawyer.professionalName}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InlineError message={error} />
          <div className="lb-form-grid">
            <div><label className="label" htmlFor="c-name">Your name</label><input id="c-name" className="input" required value={form.contactName} onChange={set('contactName')} /></div>
            <div><label className="label" htmlFor="c-phone">Phone number</label><input id="c-phone" className="input" type="tel" required value={form.contactPhone} onChange={set('contactPhone')} placeholder="+91 98xxxxxxxx" /></div>
            <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" className="input" type="email" required value={form.contactEmail} onChange={set('contactEmail')} /></div>
            <div>
              <label className="label" htmlFor="c-cat">Legal assistance category</label>
              <select id="c-cat" className="input" value={form.specializationId} onChange={set('specializationId')}>
                <option value="">Not sure</option>
                {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="c-desc">Brief description of your issue</label>
            <textarea id="c-desc" className="input" rows={4} maxLength={2000} required value={form.description} onChange={set('description')}
              placeholder="Describe the situation in a few sentences. Avoid sharing passwords, ID numbers or bank details." />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{form.description.length}/2000 · Only this lawyer will see your description.</p>
          </div>

          <div className="lb-form-grid">
            <div>
              <label className="label" htmlFor="c-mode">Consultation mode</label>
              <select id="c-mode" className="input" value={form.mode} onChange={set('mode')}>
                {lawyer.consultation.offersInPerson && <option value="IN_PERSON">In-person</option>}
                {lawyer.consultation.offersOnline && <option value="ONLINE">Online</option>}
              </select>
            </div>
            <div><label className="label" htmlFor="c-date">Preferred date</label><input id="c-date" className="input" type="date" required min={today()} max={maxDate()} value={form.preferredDate} onChange={set('preferredDate')} /></div>
            <div><label className="label" htmlFor="c-time">Preferred time</label><input id="c-time" className="input" type="time" required value={form.preferredTime} onChange={set('preferredTime')} /></div>
          </div>

          <div>
            <label className="label" htmlFor="c-doc">Attach a document (optional)</label>
            <select id="c-doc" className="input" value={form.sharedDocumentId} onChange={e => { set('sharedDocumentId')(e); setConsent(false); setShareAnalysis(false); }}>
              <option value="">Do not share a document</option>
              {documents.map(d => <option key={d.id} value={d.id}>{d.originalName}</option>)}
            </select>
            {form.sharedDocumentId && (
              <label className="alert alert-warning" style={{ marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ fontSize: '0.8125rem' }}>
                  <ShieldAlert size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  I consent to share the original PDF of this document with <strong>{lawyer.professionalName}</strong> only. Legal Buddy's analysis results are not shared unless you also tick the option below.
                  I can revoke access at any time from My Consultations.
                </span>
              </label>
            )}
            {form.sharedDocumentId && consent && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={shareAnalysis} onChange={e => setShareAnalysis(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Optional: also share Legal Buddy's clause findings for this document so the lawyer can comment on each clause. Chat history is never shared.</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Sending…' : 'Send request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
