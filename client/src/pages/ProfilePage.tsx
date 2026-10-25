import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Building,
  Mail,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#0a0a0a]">
          Profile & System Settings
        </h1>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-wide mt-1">
          Account credentials // Document processing
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

        {/* Infrastructure Status */}
        <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-[#0a0a0a]">Application Status</h3>
          <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">Document Analysis</span>
            <p className="text-xs font-bold text-[#0a0a0a] mt-1">Local rule-based processing</p>
          </div>
          <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">PostgreSQL Database</span>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#27ae60]" />
              <span className="font-mono text-xs font-bold text-[#0a0a0a]">Connected</span>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};
