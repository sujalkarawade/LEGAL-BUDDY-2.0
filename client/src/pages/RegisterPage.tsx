import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Scale, Lock, Mail, User, Building, ArrowRight, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name,
        email,
        organization,
        password,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9] px-4 py-12 relative">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center border-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[4px_4px_0_#0a0a0a] mb-4">
            <Scale className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-[#0a0a0a]">
            Create Account
          </h1>
          <p className="text-xs font-mono text-[#666666] uppercase tracking-wide mt-1.5">
            LEGAL BUDDY // Instant Contract Intelligence Platform
          </p>
        </div>

        <div className="border-[3px] border-[#0a0a0a] bg-white p-7 sm:p-8 shadow-[8px_8px_0_#0a0a0a]">
          <div className="pb-4 mb-5 border-b-2 border-[#0a0a0a]">
            <h2 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">Register User Account</h2>
            <p className="text-[11px] font-mono text-[#666666]">Enter credentials to begin legal document processing</p>
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
                Full Legal Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

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
                  placeholder="name@company.com"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                Organization / Law Firm (Optional)
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Apex Legal Corp"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#666666]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] pl-10 pr-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-xs font-mono text-[#666666]">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-[#0a0a0a] underline hover:no-underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
