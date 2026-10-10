import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Briefcase, ArrowLeft, CheckCircle, Clock, Users, FileCheck2, Scale } from 'lucide-react';

export const LawyerLoginPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9] px-4 py-12 relative">
      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#0a0a0a] hover:underline mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to User Login</span>
          </Link>

          <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[4px_4px_0_#0a0a0a] mb-4">
            <Briefcase className="h-8 w-8 text-white" />
          </div>

          <div className="inline-flex items-center gap-2 border-2 border-[#0a0a0a] bg-[#fffbe6] px-3 py-1 text-xs font-mono font-bold uppercase tracking-wide text-[#0a0a0a] shadow-[2px_2px_0_#0a0a0a] mb-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Phase 2 Capability // In Active Development</span>
          </div>

          <h1 className="text-2xl font-black uppercase tracking-wider text-[#0a0a0a] sm:text-3xl">
            Legal Buddy Lawyer Portal
          </h1>
          <p className="text-xs font-mono text-[#666666] mt-2 max-w-md mx-auto leading-relaxed">
            A dedicated workspace designed specifically for licensed advocates, outside counsel, and legal compliance officers.
          </p>
        </div>

        <div className="border-[3px] border-[#0a0a0a] bg-white p-7 sm:p-8 shadow-[8px_8px_0_#0a0a0a] space-y-6">
          <div className="border-2 border-[#0a0a0a] bg-[#f0f0f0] p-4 shadow-[3px_3px_0_#0a0a0a]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Architectural Notice & Authentication Integrity</span>
            </h3>
            <p className="text-xs text-[#555555] mt-1.5 leading-relaxed font-mono">
              In accordance with our baseline MVP architecture, lawyer-specific credentials and privileged client case assignments are scheduled for Phase 2. To avoid misleading claims of attorney verification, active lawyer authentication is intentionally deferred until bar credential verification is integrated.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-3">
              Planned Capabilities for the Lawyer Workspace
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
                <div className="flex items-center gap-2 text-[#0a0a0a] mb-1.5">
                  <FileCheck2 className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Formal Redlining</span>
                </div>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Direct clause markup, attorney sign-offs, and client review feedback loops.
                </p>
              </div>

              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
                <div className="flex items-center gap-2 text-[#0a0a0a] mb-1.5">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Case Collaboration</span>
                </div>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Delegation of contract portfolios between enterprise clients and retained counsel.
                </p>
              </div>

              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
                <div className="flex items-center gap-2 text-[#0a0a0a] mb-1.5">
                  <Scale className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Statutory Compliance</span>
                </div>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Deterministic policy rules engine (Contract Guard) with PASS/REVIEW/FAIL metrics.
                </p>
              </div>

              <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3.5 shadow-[2px_2px_0_#0a0a0a]">
                <div className="flex items-center gap-2 text-[#0a0a0a] mb-1.5">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Legal Precedents</span>
                </div>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Future integration hook for permitted Indian Kanoon and high-court citations.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/login"
              className="btn btn-primary w-full flex-1 text-center py-2.5 text-xs font-bold uppercase tracking-wider"
            >
              Log in to Standard User Workspace
            </Link>
            <Link
              to="/dashboard"
              className="btn btn-secondary w-full sm:w-auto text-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
            >
              Explore Dashboard Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
