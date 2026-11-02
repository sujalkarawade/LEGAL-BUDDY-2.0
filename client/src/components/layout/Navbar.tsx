import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Scale, Upload, User, LogOut, ChevronDown, Activity, Shield, Info } from 'lucide-react';

export const Navbar: React.FC<{ sidebarCollapsed: boolean; onToggleSidebar: () => void }> = ({
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header
      style={{
        height: 'var(--nav-height)',
        background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '16px',
        paddingRight: '20px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        flexShrink: 0,
      }}
    >
      {/* Left: hamburger + brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Toggle sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Right: status, upload, user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Engine status */}
        <button
          onClick={() => setShowStatusModal(!showStatusModal)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: 'var(--text-muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
          }}
          title="AI Engine status"
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span className="hidden-mobile">System</span>
          <Info size={12} />
        </button>

        {/* Upload shortcut */}
        <Link
          to="/upload"
          className="btn btn-sm btn-primary"
          style={{ display: 'none' }}
        >
          <Upload size={13} />
          <span>Upload</span>
        </Link>

        {/* Show on md+ */}
        <Link
          to="/upload"
          className="btn btn-sm btn-primary"
          style={{ display: 'inline-flex' }}
        >
          <Upload size={13} />
          <span>Upload</span>
        </Link>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
            }}
          >
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'var(--black)',
                color: 'var(--white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: '700',
                flexShrink: 0,
              }}
            >
              {user ? getInitials(user.name) : 'LB'}
            </span>
            <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name?.split(' ')[0] || 'Account'}
            </span>
            <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setShowUserMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 4px)',
                  width: '200px',
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  overflow: 'hidden',
                  animation: 'fade-in 0.12s ease',
                }}
                className="animate-fade-in"
              >
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                </div>
                <div style={{ padding: '4px' }}>
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
                      fontSize: '0.8125rem', fontWeight: '500', color: 'var(--text-primary)',
                      textDecoration: 'none', borderRadius: '3px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={14} style={{ color: 'var(--text-muted)' }} />
                    Profile & Settings
                  </Link>
                  <Link
                    to="/lawyer-login"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
                      fontSize: '0.8125rem', fontWeight: '500', color: 'var(--text-primary)',
                      textDecoration: 'none', borderRadius: '3px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                    Lawyer Portal
                  </Link>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
                      fontSize: '0.8125rem', fontWeight: '500', color: 'var(--danger)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      width: '100%', textAlign: 'left', borderRadius: '3px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal animate-fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-box"><Activity size={16} /></div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>System Status</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>AI Engine & Infrastructure</p>
                </div>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn-ghost btn"
                style={{ padding: '4px 8px', color: 'var(--text-muted)' }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
              <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <p className="section-label">Active Engine</p>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>Local Rule-Based Analysis</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px', lineHeight: 1.5 }}>
                  External AI model services are currently disabled. All analysis runs on the deterministic local engine.
                </p>
              </div>

              <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <p className="section-label">Database</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span className="status-dot status-dot-success" />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>PostgreSQL 17 (Prisma ORM)</p>
                </div>
              </div>

              <div className="alert alert-warning" style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                <Shield size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>Legal Buddy is an AI-assisted tool. Generated findings do not constitute legal advice or formal attorney-client privilege.</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStatusModal(false)} className="btn btn-sm btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
