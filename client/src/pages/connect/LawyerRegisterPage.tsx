import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, ArrowRight } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { useAuth } from '../../context/AuthContext.js';
import { InlineError } from '../../components/connect/ConnectUi.js';
import { BAR_COUNCILS } from '../../types/connect.js';

const STEPS = [
  'Create your lawyer account',
  'Add professional details and specializations',
  'Set your office address and map location',
  'Choose which contact details to publish',
  'Upload verification documents',
  'Submit for review by a Legal Buddy administrator',
];

export const LawyerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', barCouncilState: '', enrollmentNumber: '' });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!agree) { setError('Please confirm the declaration to continue.'); return; }
    setLoading(true);
    try {
      const r = await ConnectApi.registerLawyer({ name: form.name, email: form.email, password: form.password, barCouncilState: form.barCouncilState, enrollmentNumber: form.enrollmentNumber });
      localStorage.setItem('legal_buddy_token', r.token);
      await refreshUser();
      navigate('/connect/lawyer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: '32px 16px' }}>
      <div className="lb-register-grid">
        <section>
          <div style={{ width: 44, height: 44, background: 'var(--black)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Scale size={22} style={{ color: 'var(--white)' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem' }}>Join Legal Buddy Connect</h1>
          <p style={{ marginTop: 6 }}>Create a professional profile so clients near you can find and contact you.</p>
          <ol className="lb-steps">
            {STEPS.map((s, i) => <li key={s}><span>{i + 1}</span>{s}</li>)}
          </ol>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
            Your profile stays private until an administrator manually reviews your documents. Listings are free; Legal Buddy does not sell
            rankings, promoted placement or client leads.
          </p>
        </section>

        <section className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Create lawyer account</h2>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <InlineError message={error} />
            <div><label className="label" htmlFor="l-name">Full name (as enrolled)</label><input id="l-name" className="input" required value={form.name} onChange={set('name')} autoComplete="name" /></div>
            <div><label className="label" htmlFor="l-email">Email</label><input id="l-email" className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
            <div>
              <label className="label" htmlFor="l-council">State Bar Council</label>
              <select id="l-council" className="input" required value={form.barCouncilState} onChange={set('barCouncilState')}>
                <option value="" disabled>Select your State Bar Council</option>
                {BAR_COUNCILS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="l-enr">Enrollment number</label><input id="l-enr" className="input" required value={form.enrollmentNumber} onChange={set('enrollmentNumber')} placeholder="e.g. MAH/1234/2015" /></div>
            <div><label className="label" htmlFor="l-pw">Password</label><input id="l-pw" className="input" type="password" required value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="At least 8 characters" /></div>
            <div><label className="label" htmlFor="l-pw2">Confirm password</label><input id="l-pw2" className="input" type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
              I confirm that I am an advocate enrolled with the Bar Council named above and that the information I provide is accurate.
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Creating account…' : <>Create account <ArrowRight size={14} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 16 }}>
            Already registered? <Link to="/login" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
};
