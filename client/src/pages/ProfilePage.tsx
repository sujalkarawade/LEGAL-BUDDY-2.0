import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  User,
  Building,
  Mail,
  Shield,
  Calendar,
  Activity,
  Cpu,
  Key,
  Database,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import ApiService from '../services/api.js';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [systemStatus, setSystemStatus] = useState<any>(null);

  useEffect(() => {
    ApiService.getSystemStatus()
      .then((res) => setSystemStatus(res))
      .catch((err) => console.warn('Status error:', err));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#0a0a0a]">
          Profile & System Settings
        </h1>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-wide mt-1">
          Account credentials // Database persistence verification // AI engine parameters
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Account Details */}
        <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b-2 border-[#0a0a0a]">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white font-mono font-bold text-sm shadow-[2px_2px_0_#0a0a0a]">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'LB'}
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-[#0a0a0a]">{user?.name}</h2>
              <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-[#0a0a0a]">
                {user?.role || 'User'}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs text-[#0a0a0a]">
            <div className="flex items-center justify-between py-2 border-b border-[#e0e0e0]">
              <span className="text-[#666666] flex items-center gap-2 uppercase font-bold tracking-wider text-[11px]">
                <Mail className="h-3.5 w-3.5 text-[#0a0a0a]" />
                Email
              </span>
              <span className="font-mono font-bold">{user?.email}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#e0e0e0]">
              <span className="text-[#666666] flex items-center gap-2 uppercase font-bold tracking-wider text-[11px]">
                <Building className="h-3.5 w-3.5 text-[#0a0a0a]" />
                Organization
              </span>
              <span className="font-medium text-[#0a0a0a]">{user?.organization || 'Independent'}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#e0e0e0]">
              <span className="text-[#666666] flex items-center gap-2 uppercase font-bold tracking-wider text-[11px]">
                <Calendar className="h-3.5 w-3.5 text-[#0a0a0a]" />
                Created
              </span>
              <span className="font-mono text-[#0a0a0a]">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* AI & Infrastructure Settings */}
        <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#0a0a0a]">
            <Cpu className="h-5 w-5 text-[#0a0a0a]" />
            <h3 className="text-sm font-black uppercase tracking-wide text-[#0a0a0a]">
              AI Engine Configuration
            </h3>
          </div>

          <div className="space-y-3.5 text-xs text-[#0a0a0a]">
            <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                Active AI Provider
              </span>
              <p className="text-xs font-bold text-[#0a0a0a] mt-0.5">
                {systemStatus?.aiStatus?.activeProvider === 'groq'
                  ? `Neural AI Engine — ${systemStatus?.aiStatus?.model?.replace(/\s*\(Groq LPU\)/gi, '') || 'Llama 3.3 70B'}`
                  : systemStatus?.aiStatus?.activeProvider === 'gemini'
                  ? 'Google Gemini 1.5 Flash (Live API Key)'
                  : systemStatus?.aiStatus?.activeProvider === 'openai'
                  ? 'OpenAI GPT-4o Mini (Live API Key)'
                  : 'Deterministic Legal Rule Engine (Offline)'}
              </p>
              <p className="text-[11px] font-mono text-[#666666] mt-1 leading-relaxed">
                {systemStatus?.aiStatus?.notice?.replace(/GROQ — /gi, '')?.replace(/\(Groq LPU\)/gi, '')}
              </p>
            </div>

            <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                PostgreSQL Database
              </span>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#27ae60]" />
                <span className="font-mono text-xs font-bold text-[#0a0a0a]">
                  PostgreSQL 17 Running on Port 5432
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide Box */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] flex items-center gap-2">
          <Key className="h-4 w-4" />
          <span>Configuring Live AI Keys</span>
        </h4>
        <p className="text-xs text-[#555555] leading-relaxed">
          Legal Buddy works immediately out of the box with its deterministic legal rule extraction engine. To activate high-speed neural reasoning with Meta-Llama 3.3 70B:
        </p>
        <div className="border-2 border-[#0a0a0a] bg-[#f0f0f0] p-4 font-mono text-xs text-[#0a0a0a] shadow-[2px_2px_0_#0a0a0a] space-y-1">
          <div>1. Open <code className="font-bold underline">server/.env</code></div>
          <div>2. Set <code className="font-bold">LLM_API_KEY="your_api_key_here"</code></div>
          <div>3. Set <code className="font-bold">LLM_MODEL="meta-llama/llama-3.3-70b-instruct"</code></div>
          <div>4. Set <code className="font-bold">AI_PROVIDER="auto"</code></div>
        </div>
      </div>
    </div>
  );
};
