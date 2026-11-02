import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Scale, Lock, Mail, User, Building, ArrowRight, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setIsLoading(true);
    try {
      await register({ name, email, organization, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputWithIcon = (icon: React.ReactNode, element: React.ReactNode) => (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
        {icon}
      </span>
      {element}
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface)',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '44px', height: '44px', background: 'var(--black)', borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Scale size={22} color="white" />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Create your account
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Legal Buddy — Contract Intelligence Platform
          </p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Register</h2>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label" htmlFor="name">Full name</label>
              {inputWithIcon(
                <User size={14} />,
                <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Jane Doe" className="input" style={{ paddingLeft: '36px' }} />
              )}
            </div>

            <div>
              <label className="label" htmlFor="reg-email">Work email</label>
              {inputWithIcon(
                <Mail size={14} />,
                <input id="reg-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com" className="input" style={{ paddingLeft: '36px' }} />
              )}
            </div>

            <div>
              <label className="label" htmlFor="org">Organization (optional)</label>
              {inputWithIcon(
                <Building size={14} />,
                <input id="org" type="text" value={organization} onChange={e => setOrganization(e.target.value)}
                  placeholder="Apex Legal Corp" className="input" style={{ paddingLeft: '36px' }} />
              )}
            </div>

            <div>
              <label className="label" htmlFor="reg-password">Password</label>
              {inputWithIcon(
                <Lock size={14} />,
                <input id="reg-password" type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" className="input" style={{ paddingLeft: '36px' }} />
              )}
            </div>

            <div>
              <label className="label" htmlFor="confirm-password">Confirm password</label>
              {inputWithIcon(
                <Lock size={14} />,
                <input id="confirm-password" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password" className="input" style={{ paddingLeft: '36px' }} />
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginTop: '4px' }}
            >
              {isLoading
                ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }} />
                : <><span>Create account</span><ArrowRight size={14} /></>
              }
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '16px' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
