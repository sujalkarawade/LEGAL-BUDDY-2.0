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
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import ApiService from '../../services/api.js';

interface SidebarProps {
  collapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const location = useLocation();
  const [latestDocId, setLatestDocId] = useState<string | null>(null);

  // Match if currently viewing a specific document subpage
  const docMatch = location.pathname.match(/\/documents\/([a-zA-Z0-9_-]+)/);
  const activeDocId = docMatch ? docMatch[1] : latestDocId;

  useEffect(() => {
    // Fetch latest document so contextual links work seamlessly
    ApiService.getDocuments()
      .then((res) => {
        if (res.documents && res.documents.length > 0) {
          setLatestDocId(res.documents[0].id);
        }
      })
      .catch(() => {});
  }, [location.pathname]);

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Upload Contract',
      path: '/upload',
      icon: UploadCloud,
    },
    {
      name: 'My Documents',
      path: '/documents',
      icon: FileText,
    },
    {
      name: 'Clause Analysis',
      path: activeDocId ? `/documents/${activeDocId}/clauses` : '/documents',
      icon: SearchCode,
      badge: activeDocId ? 'Active' : undefined,
    },
    {
      name: 'Ask Legal Buddy',
      path: activeDocId ? `/documents/${activeDocId}/chat` : '/documents',
      icon: MessageSquareQuote,
      badge: 'AI Chat',
    },
    {
      name: 'Completeness Check',
      path: activeDocId ? `/documents/${activeDocId}/completeness` : '/documents',
      icon: CheckCircle2,
    },
    {
      name: 'Dates & Obligations',
      path: activeDocId ? `/documents/${activeDocId}/obligations` : '/documents',
      icon: CalendarClock,
    },
    {
      name: 'Document Generator',
      path: '/document-generator',
      icon: FileCode2,
      badge: 'Drafts',
    },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r-[3px] border-[#0a0a0a] bg-white transition-all duration-300 z-40 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center px-5 border-b-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-white">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-white bg-[#0a0a0a] text-white">
            <Scale className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-1.5">
                LEGAL BUDDY
                <span className="border border-white/60 px-1 py-0.2 text-[9px] font-black">2.0</span>
              </span>
              <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest">Contract Intelligence</span>
            </div>
          )}
        </NavLink>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 pt-1">
          {!collapsed && (
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Main Platform</p>
          )}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && item.path !== '/documents' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.name}
              to={item.path}
              title={collapsed ? item.name : undefined}
              className={({ isActive: exactActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-2 ${
                  isActive || exactActive
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-[3px_3px_0_#999999]'
                    : 'text-[#0a0a0a] border-transparent hover:border-[#0a0a0a] hover:bg-[#f0f0f0]'
                } ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-[#0a0a0a]'}`} />
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className={`border px-1.5 py-0.2 text-[9px] font-black font-mono uppercase ${
                      isActive ? 'border-white text-white' : 'border-[#0a0a0a] text-[#0a0a0a]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}

        {/* Lawyer Portal Dedicated Section */}
        <div className="pt-4 px-3">
          {!collapsed && (
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Collaboration</p>
          )}
        </div>

        <NavLink
          to="/lawyer-login"
          title={collapsed ? 'Lawyer Portal (Phase 2)' : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-2 ${
              isActive
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-[3px_3px_0_#999999]'
                : 'text-[#0a0a0a] border-transparent hover:border-[#0a0a0a] hover:bg-[#f0f0f0]'
            } ${collapsed ? 'justify-center px-0' : ''}`
          }
        >
          <Briefcase className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between">
              <span>Lawyer Portal</span>
              <span className="border border-current px-1.5 py-0.2 text-[9px] font-black font-mono uppercase">
                Beta
              </span>
            </div>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          title={collapsed ? 'Profile & Settings' : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-2 ${
              isActive
                ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-[3px_3px_0_#999999]'
                : 'text-[#0a0a0a] border-transparent hover:border-[#0a0a0a] hover:bg-[#f0f0f0]'
            } ${collapsed ? 'justify-center px-0' : ''}`
          }
        >
          <UserCheck className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Profile & Settings</span>}
        </NavLink>
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="p-3 border-t-2 border-[#0a0a0a] bg-[#f9f9f9]">
          <div className="border-2 border-[#0a0a0a] bg-white p-3 shadow-[2px_2px_0_#0a0a0a]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#0a0a0a] shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0a0a0a]">Contract AI</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed font-medium">
              Legal Buddy assists in clause review. Generated findings do not constitute formal legal counsel.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
