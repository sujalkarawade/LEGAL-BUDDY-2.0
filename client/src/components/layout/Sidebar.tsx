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
} from 'lucide-react';
import ApiService from '../../services/api.js';

interface SidebarProps {
  collapsed: boolean;
}

const NAV_ITEMS = [
  { name: 'Dashboard',       path: '/dashboard',              icon: LayoutDashboard, doc: false },
  { name: 'Upload Contract', path: '/upload',                 icon: UploadCloud,     doc: false },
  { name: 'My Documents',    path: '/documents',              icon: FileText,        doc: false },
];

const DOC_ITEMS = [
  { name: 'Clause Analysis',       key: 'clauses',      icon: SearchCode },
  { name: 'Ask Legal Buddy',       key: 'chat',         icon: MessageSquareQuote },
  { name: 'Completeness Check',    key: 'completeness', icon: CheckCircle2 },
  { name: 'Dates & Obligations',   key: 'obligations',  icon: CalendarClock },
];

const BOTTOM_ITEMS = [
  { name: 'Document Generator', path: '/document-generator', icon: FileCode2 },
  { name: 'Lawyer Portal',      path: '/lawyer-login',       icon: Briefcase },
  { name: 'Profile',            path: '/profile',            icon: UserCheck },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const location = useLocation();
  const [latestDocId, setLatestDocId] = useState<string | null>(null);

  const docMatch = location.pathname.match(/\/documents\/([a-zA-Z0-9_-]+)/);
  const activeDocId = docMatch ? docMatch[1] : latestDocId;

  useEffect(() => {
    ApiService.getDocuments()
      .then((res) => {
        if (res.documents?.length > 0) setLatestDocId(res.documents[0].id);
      })
      .catch(() => {});
  }, [location.pathname]);

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
    flexShrink: 0,
    background: 'var(--white)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 250ms ease',
    overflow: 'hidden',
    zIndex: 40,
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: collapsed ? '10px 0' : '9px 12px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: '0.8125rem',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'background var(--transition), color var(--transition)',
    background: isActive ? 'var(--surface-alt)' : 'transparent',
  });

  const isDocActive = (key: string) => location.pathname.includes(`/${key}`);

  return (
    <aside style={sidebarStyle}>
      {/* Brand */}
      <NavLink
        to="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          height: 'var(--nav-height)',
          padding: collapsed ? '0' : '0 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: '28px',
            height: '28px',
            background: 'var(--black)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Scale size={15} color="white" />
        </span>
        {!collapsed && (
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>Legal Buddy</p>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1 }}>Contract Intelligence</p>
          </div>
        )}
      </NavLink>

      {/* Main nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* Core pages */}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path ||
            (item.path !== '/dashboard' && item.path !== '/documents' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : undefined}
              style={({ isActive }) => linkStyle(active || isActive)}
              onMouseEnter={e => { if (!(active)) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              onMouseLeave={e => { if (!(active)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}

        {/* Document analysis section */}
        {!collapsed && (
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              padding: '14px 12px 4px',
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
            <NavLink
              key={item.key}
              to={path}
              title={collapsed ? item.name : undefined}
              style={() => linkStyle(active)}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = active ? 'var(--surface-alt)' : 'transparent'; }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}

        {/* Bottom section */}
        {!collapsed && (
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              padding: '14px 12px 4px',
            }}
          >
            Tools
          </p>
        )}
        {collapsed && <div style={{ height: '8px' }} />}

        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : undefined}
              style={({ isActive }) => linkStyle(isActive)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
              onMouseLeave={e => { }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer note */}
      {!collapsed && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          AI-assisted review only. Not legal advice.
        </div>
      )}
    </aside>
  );
};
