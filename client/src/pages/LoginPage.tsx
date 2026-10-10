import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Scale, Lock, Mail, ArrowRight, Shield, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillTestCredentials = () => {
    setEmail('test@legalbuddy.io');
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9] px-4 py-12 relative">
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center border-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[4px_4px_0_#0a0a0a] mb-4">
            <Scale className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#0a0a0a]">
            LEGAL BUDDY
          </h1>
          <p className="text-xs font-mono text-[#666666] uppercase tracking-wide mt-1.5">
            AI-Powered Contract Intelligence // Legal RAG Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="border-[3px] border-[#0a0a0a] bg-white p-7 sm:p-8 shadow-[8px_8px_0_#0a0a0a]">
          <div className="flex items-center justify-between pb-4 mb-5 border-b-2 border-[#0a0a0a]">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">User Sign In</h2>
              <p className="text-[11px] font-mono text-[#666666]">Access contracts and risk reports</p>
            </div>
            <Link
              to="/lawyer-login"
              className="inline-flex items-center gap-1.5 border-2 border-[#0a0a0a] bg-[#f0f0f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-all shadow-[2px_2px_0_#0a0a0a]"
            >
              <Shield className="h-3 w-3" />
              <span>Lawyer Portal</span>
            </Link>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 border-2 border-[#c0392b] bg-[#fff5f5] p-3 text-xs font-mono text-[#c0392b] font-bold shadow-[2px_2px_0_#c0392b]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Seed User Autofill */}
          <div className="mt-5 pt-4 border-t-2 border-[#0a0a0a]">
            <button
              type="button"
              onClick={fillTestCredentials}
              className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-[#0a0a0a] bg-[#f9f9f9] py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-[#f0f0f0] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#0a0a0a]" />
              <span>Autofill Test User (Adv. Sarah Jenkins)</span>
            </button>
          </div>

          <div className="mt-5 text-center text-xs font-mono text-[#666666]">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-bold text-[#0a0a0a] underline hover:no-underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
