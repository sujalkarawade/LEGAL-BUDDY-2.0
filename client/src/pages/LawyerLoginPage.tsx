import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, CalendarCheck, FileLock2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

/** Entry point for advocates: explains Legal Buddy Connect and links to registration / sign-in. */
export const LawyerLoginPage: React.FC = () => {
  const { user } = useAuth();
  const features = [
    { icon: MapPin, title: 'Be discoverable', desc: 'Appear on the Find a Lawyer map for clients searching near your office.' },
    { icon: ShieldCheck, title: 'Manual credential review', desc: 'A Legal Buddy administrator reviews your Bar Council enrollment documents before you are listed.' },
    { icon: CalendarCheck, title: 'Consultation requests', desc: 'Accept, decline or propose new times for requests from clients.' },
    { icon: FileLock2, title: 'Private by default', desc: 'You choose which contact details are published. Verification documents are never public.' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: '32px 16px' }}>
      <Link to={user ? '/dashboard' : '/login'} style={{ position: 'fixed', top: 24, left: 24, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none' }}>
        {user ? 'Back to dashboard' : 'Back to user login'}
      </Link>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem' }}>Legal Buddy Connect for Lawyers</h1>
          <p style={{ marginTop: 6 }}>Create a verified professional profile so clients near you can find and contact you.</p>
        </div>
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {features.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} style={{ display: 'flex', gap: 10 }}>
                  <Icon size={18} style={{ flexShrink: 0, marginTop: 3, color: 'var(--text-primary)' }} />
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</p>
                    <p style={{ fontSize: '0.875rem' }}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Listing is free. Legal Buddy does not sell rankings, promoted placement, ratings or client leads, and does not take referral commissions.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {user?.role === 'LAWYER' ? (
              <Link to="/connect/lawyer" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Open lawyer dashboard</Link>
            ) : (
              <>
                <Link to="/connect/lawyer/register" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Register as a lawyer</Link>
                {!user && <Link to="/login" className="btn btn-secondary" style={{ justifyContent: 'center' }}>Lawyer sign in</Link>}
              </>
            )}
          </div>
          {user && user.role !== 'LAWYER' && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Lawyer profiles use a separate account. Sign out first if you want to register with a different email.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
