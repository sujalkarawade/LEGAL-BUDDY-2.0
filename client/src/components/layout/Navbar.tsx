import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Shield,
  Upload,
  User,
  Sparkles,
  Info,
  LogOut,
  ChevronDown,
  Activity,
} from 'lucide-react';
import ApiService from '../../services/api.js';

export const Navbar: React.FC<{ sidebarCollapsed: boolean; onToggleSidebar: () => void }> = ({
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    ApiService.getSystemStatus()
      .then((data) => setSystemStatus(data))
      .catch((err) => console.warn('Status fetch failed:', err));
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-[3px] border-[#0a0a0a] bg-[#0a0a0a] px-6 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center border-2 border-white/30 text-white hover:border-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Toggle Navigation Sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden sm:flex items-center gap-3">
          <span className="text-sm font-black tracking-widest uppercase text-white">LEGAL BUDDY</span>
          <div className="w-[2px] h-3.5 bg-white/30"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Contract Intelligence</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* System & AI Engine Status Badge */}
        <button
          onClick={() => setShowStatusModal(!showStatusModal)}
          className="flex items-center gap-2 border-2 border-white/30 bg-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:border-white hover:bg-white/10 transition-all cursor-pointer font-mono"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
          </span>
          <span className="hidden md:inline">
            {systemStatus?.aiStatus?.isLiveLlm ? 'Live Neural LLM' : 'Heuristic Legal Engine'}
          </span>
          <Info className="h-3.5 w-3.5 text-white/70" />
        </button>

        {/* Quick Upload Action */}
        <Link
          to="/upload"
          className="btn btn-sm hidden sm:inline-flex bg-white text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white hover:border-white border-2 border-[#0a0a0a]"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Upload Contract</span>
        </Link>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 border-2 border-white/30 bg-[#0a0a0a] p-1.5 pr-2.5 hover:border-white transition-colors cursor-pointer"
          >
            <div className="flex h-6 w-6 items-center justify-center bg-white text-[#0a0a0a] text-[10px] font-black uppercase font-mono">
              {user ? getInitials(user.name) : 'LB'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-[11px] font-black uppercase text-white leading-none tracking-wide">{user?.name || 'Account'}</p>
              <p className="text-[9px] font-bold uppercase text-white/50 leading-none mt-1">{user?.organization || 'Counsel'}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-white/60" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 border-2 border-[#0a0a0a] bg-white p-1 text-sm shadow-[4px_4px_0_#0a0a0a] z-50 animate-fadeUp text-[#0a0a0a]">
              <div className="border-b-2 border-[#0a0a0a] px-3 py-2 bg-[#f9f9f9]">
                <p className="text-xs font-black uppercase">{user?.name}</p>
                <p className="text-[10px] font-medium text-gray-600 truncate font-mono">{user?.email}</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
              >
                <User className="h-4 w-4" />
                Profile & Settings
              </Link>

              <Link
                to="/lawyer-login"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#0a0a0a]" />
                  <span>Lawyer Portal</span>
                </div>
                <span className="border border-current px-1 py-0.2 text-[9px] font-black">Beta</span>
              </Link>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  navigate('/login');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#c0392b] hover:bg-[#c0392b] hover:text-white transition-colors cursor-pointer border-t border-gray-200 mt-1"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Engine Status Details Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[8px_8px_0_#0a0a0a] animate-fadeUp text-[#0a0a0a]">
            <div className="flex items-start justify-between pb-3 border-b-2 border-[#0a0a0a]">
              <div className="flex items-center gap-3">
                <div className="border-2 border-[#0a0a0a] bg-[#0a0a0a] p-2 text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">AI Processing Engine</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Legal Buddy Core Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white border border-[#0a0a0a] w-7 h-7 flex items-center justify-center font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Active Engine</span>
                <p className="text-xs font-black uppercase text-[#0a0a0a] mt-0.5">
                  {systemStatus?.aiStatus?.activeProvider === 'groq'
                    ? `Neural AI Engine — ${systemStatus?.aiStatus?.model?.replace(/\s*\(Groq LPU\)/gi, '') || 'Llama 3.3 70B'}`
                    : systemStatus?.aiStatus?.activeProvider === 'gemini'
                    ? 'Google Gemini 1.5 Flash (Live API)'
                    : systemStatus?.aiStatus?.activeProvider === 'openai'
                    ? 'OpenAI GPT-4o Mini (Live API)'
                    : 'Deterministic Heuristic Legal Engine'}
                </p>
                <p className="text-gray-600 mt-1.5 leading-relaxed text-[11px]">
                  {systemStatus?.aiStatus?.notice?.replace(/GROQ — /gi, '')?.replace(/\(Groq LPU\)/gi, '') || 'System operating in normal baseline mode.'}
                </p>
              </div>

              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Database Connection</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <p className="text-[#0a0a0a] font-bold text-xs uppercase font-mono">PostgreSQL 17 (Prisma ORM Active)</p>
                </div>
              </div>

              <div className="border-2 border-[#b7950b] bg-[#fefdf0] p-3 text-xs text-[#0a0a0a] leading-relaxed">
                <p className="font-black uppercase tracking-wider text-[#b7950b] mb-1">Legal Safeguard Disclaimer</p>
                Legal Buddy is an AI-assisted contract review and intelligence tool. Generated findings, clause risks, and summaries do not constitute legal advice or formal attorney-client privilege.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
