import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  SearchCode,
  MessageSquareQuote,
  CheckCircle2,
  CalendarClock,
  FileCode2,
  UserCheck,
  Scale,
  Briefcase,
  MapPin,
  CalendarCheck,
  ShieldCheck,
  Landmark,
  GitCompare,
  BarChart3,
} from 'lucide-react';
import ApiService from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';

interface SidebarProps {
  collapsed: boolean;
}

const NAV_ITEMS = [
  { name: 'Dashboard',       path: '/dashboard', icon: LayoutDashboard },
  { name: 'Upload Contract', path: '/upload',    icon: UploadCloud },
  { name: 'My Documents',    path: '/documents', icon: FileText },
];

const DOC_ITEMS = [
  { name: 'Clause Analysis',       key: 'clauses',      icon: SearchCode },
  { name: 'Ask Legal Buddy',       key: 'chat',         icon: MessageSquareQuote },
  { name: 'Completeness Check',    key: 'completeness', icon: CheckCircle2 },
  { name: 'Dates & Obligations',   key: 'obligations',  icon: CalendarClock },
  { name: 'Indian Law Checks',     key: 'compliance',   icon: Landmark },
  { name: 'Compare Template',      key: 'compare',      icon: GitCompare },
];

/** Legal Buddy Connect entries depend on the signed-in role (the server enforces the same roles). */
function bottomItems(role: string | undefined) {
  return [
    { name: 'Document Generator', path: '/document-generator', icon: FileCode2 },
    { name: 'Find a Lawyer', path: '/connect/find', icon: MapPin },
    { name: 'Accuracy & Evaluation', path: '/evaluation', icon: BarChart3 },
    ...(role === 'USER' ? [
      { name: 'My Consultations', path: '/connect/consultations', icon: CalendarCheck },
      { name: 'Lawyer Portal', path: '/lawyer-login', icon: Briefcase },
    ] : []),
    ...(role === 'LAWYER' ? [{ name: 'Lawyer Dashboard', path: '/connect/lawyer', icon: Briefcase }] : []),
    ...(role === 'ADMIN' ? [{ name: 'Connect Admin', path: '/connect/admin', icon: ShieldCheck }] : []),
    { name: 'Profile', path: '/profile', icon: UserCheck },
  ];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const location = useLocation();
  const { user } = useAuth();
  const BOTTOM_ITEMS = bottomItems(user?.role);
  const [hasDocuments, setHasDocuments] = useState<boolean>(false);
  const [latestDocId, setLatestDocId] = useState<string | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ name: string; top: number } | null>(null);

  const docMatch = location.pathname.match(/\/documents\/([a-zA-Z0-9_-]+)/);
  const activeDocId = docMatch ? docMatch[1] : latestDocId;

  const fetchDocs = () => {
    ApiService.getDocuments()
      .then((res) => {
        const docs = res.documents || [];
        if (docs.length > 0) {
          setHasDocuments(true);
          setLatestDocId(docs[0].id);
        } else {
          setHasDocuments(false);
          setLatestDocId(null);
        }
      })
      .catch(() => {
        setHasDocuments(false);
      });
  };

  useEffect(() => {
    fetchDocs();
    const handleDocUpdate = () => fetchDocs();
    window.addEventListener('document_uploaded', handleDocUpdate);
    window.addEventListener('documents_changed', handleDocUpdate);
    return () => {
      window.removeEventListener('document_uploaded', handleDocUpdate);
      window.removeEventListener('documents_changed', handleDocUpdate);
    };
  }, [location.pathname]);

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
    flexShrink: 0,
    background: 'var(--white)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 240ms cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 40,
    position: 'relative',
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: collapsed ? '11px 0' : '10px 14px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
    background: isActive ? 'var(--surface-alt)' : 'transparent',
    borderLeft: isActive && !collapsed ? '3px solid var(--text-primary)' : '3px solid transparent',
  });

  const isDocActive = (key: string) => location.pathname.includes(`/${key}`);

  const handleMouseEnter = (name: string, e: React.MouseEvent<HTMLElement>) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      name,
      top: rect.top + rect.height / 2,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  return (
    <aside style={sidebarStyle}>
      {/* Brand - Removed "Contract Intelligence" per requirement */}
      <NavLink
        to="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          height: 'var(--nav-height)',
          padding: collapsed ? '0' : '0 18px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--black)',
            color: 'var(--white)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Scale size={18} />
        </span>
        {!collapsed && (
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Legal Buddy
            </p>
          </div>
        )}
      </NavLink>

      {/* Main navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '14px 10px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {/* Core items */}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.path ||
            (item.path !== '/dashboard' && item.path !== '/documents' && location.pathname.startsWith(item.path));

          return (
            <div
              key={item.path}
              onMouseEnter={(e) => handleMouseEnter(item.name, e)}
              onMouseLeave={handleMouseLeave}
            >
              <NavLink
                to={item.path}
                style={({ isActive }) => linkStyle(active || isActive)}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            </div>
          );
        })}

        {/* Document analysis section - ONLY APPEARS WHEN DOCUMENT IS UPLOADED */}
        {hasDocuments && (
          <>
            {!collapsed && (
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-muted)',
                  padding: '16px 14px 4px',
                }}
              >
                Analysis
              </p>
            )}
            {collapsed && <div style={{ height: '8px' }} />}

            {DOC_ITEMS.map((item) => {
              const Icon = item.icon;
              const path = activeDocId ? `/documents/${activeDocId}/${item.key}` : '/documents';
              const active = isDocActive(item.key);

              return (
                <div
                  key={item.key}
                  onMouseEnter={(e) => handleMouseEnter(item.name, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  <NavLink
                    to={path}
                    style={() => linkStyle(active)}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.name}</span>}
                  </NavLink>
                </div>
              );
            })}
          </>
        )}

        {/* Tools section */}
        {!collapsed && (
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text-muted)',
              padding: '16px 14px 4px',
            }}
          >
            Tools
          </p>
        )}
        {collapsed && <div style={{ height: '8px' }} />}

        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <div
              key={item.path}
              onMouseEnter={(e) => handleMouseEnter(item.name, e)}
              onMouseLeave={handleMouseLeave}
            >
              <NavLink
                to={item.path}
                style={({ isActive }) => linkStyle(active || isActive)}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Footer note */}
      {!collapsed && (
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          AI-assisted review only. Not legal advice.
        </div>
      )}

      {/* High-fidelity Fixed Tooltip Popup for Minimized Sidebar */}
      {collapsed && hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: 'calc(var(--sidebar-collapsed) + 8px)',
            top: hoveredTooltip.top,
            transform: 'translateY(-50%)',
            background: 'var(--tooltip-bg, #0f172a)',
            color: 'var(--tooltip-text, #ffffff)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
            pointerEvents: 'none',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            letterSpacing: '0.01em',
            animation: 'sidebar-tooltip-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '-4px',
              top: '50%',
              transform: 'translateY(-50%) rotate(45deg)',
              width: '8px',
              height: '8px',
              background: 'var(--tooltip-bg, #0f172a)',
              borderLeft: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          />
          {hoveredTooltip.name}
        </div>
      )}
    </aside>
  );
};
