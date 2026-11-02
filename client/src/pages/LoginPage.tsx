import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Scale, Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillTestCredentials = () => {
    setEmail('test@legalbuddy.io');
    setPassword('Password123!');
    setError(null);
  };

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
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: 'var(--black)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Scale size={22} color="white" />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Legal Buddy
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            AI-powered contract intelligence platform
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Sign in</h2>
            <Link
              to="/lawyer-login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '4px 8px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Shield size={12} />
              Lawyer Portal
            </Link>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={14}
                  style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={14}
                  style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '4px', justifyContent: 'center', padding: '10px 16px' }}
            >
              {isLoading ? (
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick fill */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={fillTestCredentials}
              style={{
                width: '100%', padding: '8px', fontSize: '0.8125rem', fontWeight: 500,
                color: 'var(--text-secondary)', background: 'var(--surface)',
                border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)',
                cursor: 'pointer', transition: 'background var(--transition)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
            >
              Autofill test credentials (Adv. Sarah Jenkins)
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '16px' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
