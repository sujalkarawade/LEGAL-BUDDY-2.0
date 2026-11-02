import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { Scale, User, LogOut, ChevronDown, Activity, Shield, Info, Sun, Moon } from 'lucide-react';

export const Navbar: React.FC<{ sidebarCollapsed: boolean; onToggleSidebar: () => void }> = ({
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        paddingLeft: '18px',
        paddingRight: '24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        flexShrink: 0,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Left: hamburger + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background var(--transition), color var(--transition)',
          }}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Right: theme toggle, system status, user menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Black & White Theme Switch */}
        <button
          onClick={toggleTheme}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            height: '34px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={15} style={{ color: '#fbbf24' }} />
              <span className="hidden-mobile" style={{ fontSize: '0.8125rem' }}>Light</span>
            </>
          ) : (
            <>
              <Moon size={15} style={{ color: 'var(--text-secondary)' }} />
              <span className="hidden-mobile" style={{ fontSize: '0.8125rem' }}>Dark</span>
            </>
          )}
        </button>

        {/* Engine status button */}
        <button
          onClick={() => setShowStatusModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 12px',
            height: '34px',
            fontSize: '0.8125rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="AI Engine status"
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'inline-block',
              flexShrink: 0,
              boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
            }}
          />
          <span className="hidden-mobile">System</span>
          <Info size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '5px 12px',
              height: '34px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              transition: 'background var(--transition)',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--black)',
                color: 'var(--white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: '700',
                flexShrink: 0,
              }}
            >
              {user ? getInitials(user.name) : 'LB'}
            </span>
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name?.split(' ')[0] || 'Account'}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop for user dropdown */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setShowUserMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: '220px',
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                  overflow: 'hidden',
                  animation: 'fade-in 0.15s ease',
                }}
                className="animate-fade-in"
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                </div>
                <div style={{ padding: '6px' }}>
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)',
                      textDecoration: 'none', borderRadius: '4px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <User size={15} style={{ color: 'var(--text-muted)' }} />
                    Profile & Settings
                  </Link>
                  <Link
                    to="/lawyer-login"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)',
                      textDecoration: 'none', borderRadius: '4px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Shield size={15} style={{ color: 'var(--text-muted)' }} />
                    Lawyer Portal
                  </Link>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      fontSize: '0.875rem', fontWeight: '500', color: 'var(--danger)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      width: '100%', textAlign: 'left', borderRadius: '4px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* System Status Modal rendered via Portal to blackout the entire page & sidebar */}
      {showStatusModal &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowStatusModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              animation: 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              className="modal animate-fade-in"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--white)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                width: '100%',
                maxWidth: '480px',
                padding: '28px',
                boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
                animation: 'modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="icon-box" style={{ width: '40px', height: '40px' }}>
                    <Activity size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>System Status</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      AI Engine & Infrastructure
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="btn-ghost btn"
                  style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '1rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
                <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <p className="section-label">Active Engine</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px', fontSize: '0.9375rem' }}>
                    Local Deterministic & AI Hybrid Engine
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '4px', lineHeight: 1.6 }}>
                    Contract analysis and clause breakdown run locally and deterministically with fallback to high-speed RAG.
                  </p>
                </div>

                <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <p className="section-label">Database Infrastructure</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span className="status-dot status-dot-success" style={{ width: '8px', height: '8px' }} />
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      PostgreSQL 17 (Prisma ORM & pgvector)
                    </p>
                  </div>
                </div>

                <div className="alert alert-warning" style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
                  <Shield size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Legal Buddy is an AI-assisted analysis tool. Findings do not constitute legal advice or formal attorney-client privilege.
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowStatusModal(false)} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
