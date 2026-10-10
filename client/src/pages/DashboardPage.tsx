import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  Clock,
  Sparkles,
  Upload,
  FileCode2,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Calendar,
  Layers,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DashboardStats } from '../types/index.js';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiService.getDashboardStats()
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load dashboard metrics.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin border-3 border-[#0a0a0a] border-t-transparent"></div>
          <p className="text-xs font-mono text-[#666666] uppercase tracking-wider">Loading contract intelligence dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalDocs: 0,
    completedDocs: 0,
    totalClauses: 0,
    highRiskClauses: 0,
    pendingObligations: 0,
    totalDrafts: 0,
  };

  const isNewAccount = stats.totalDocs === 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fadeUp">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b-2 border-[#0a0a0a]">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#0a0a0a] sm:text-3xl">
            Contract Intelligence Dashboard
          </h1>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mt-1">
            Real-time analysis, risk exposure metrics, and upcoming contractual deadlines
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="btn btn-primary"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Contract</span>
          </Link>
          <Link
            to="/document-generator"
            className="btn"
          >
            <FileCode2 className="h-4 w-4" />
            <span>Draft New Agreement</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Active Contracts</span>
            <div className="border-2 border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a]">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0a0a0a] font-mono">{stats.totalDocs}</span>
            <span className="text-[10px] font-mono text-gray-500 font-bold uppercase">
              ({stats.completedDocs} parsed)
            </span>
          </div>
        </div>

        {/* Total Clauses Analyzed */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Clauses Identified</span>
            <div className="border-2 border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0a0a0a] font-mono">{stats.totalClauses}</span>
            <span className="text-[10px] font-mono text-gray-500 font-bold uppercase">portfolio total</span>
          </div>
        </div>

        {/* Flagged / Potential Concern Clauses */}
        <div className="border-2 border-[#0a0a0a] bg-[#fdf0ef] p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#c0392b] font-mono">Needs Review / High Risk</span>
            <div className="border-2 border-[#c0392b] bg-white p-1.5 text-[#c0392b]">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#c0392b] font-mono">{stats.highRiskClauses}</span>
            <span className="text-[10px] font-mono text-[#c0392b] font-bold uppercase">requires review</span>
          </div>
        </div>

        {/* Pending Contractual Obligations */}
        <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#0a0a0a] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono">Pending Obligations</span>
            <div className="border-2 border-[#0a0a0a] bg-white p-1.5 text-[#0a0a0a]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0a0a0a] font-mono">{stats.pendingObligations}</span>
            <span className="text-[10px] font-mono text-gray-500 font-bold uppercase">unreviewed</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Contracts & Upcoming Obligations */}
      {isNewAccount ? (
        /* Empty State */
        <div className="border-[3px] border-[#0a0a0a] bg-white p-12 text-center shadow-[6px_6px_0_#0a0a0a]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#0a0a0a] bg-[#f0f0f0] text-[#0a0a0a] mb-4 shadow-[3px_3px_0_#0a0a0a]">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="text-base font-black uppercase text-[#0a0a0a]">No contracts uploaded yet</h3>
          <p className="text-xs text-gray-600 mt-2 max-w-sm mx-auto leading-relaxed font-medium">
            Upload your first PDF agreement to generate structured executive summaries, risk-rated clause breakdowns, and contract completeness checklists.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/upload"
              className="btn btn-primary"
            >
              Upload PDF Contract
            </Link>
            <Link
              to="/document-generator"
              className="btn"
            >
              Generate a Legal Draft
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Contracts Table (2 cols) */}
          <div className="lg:col-span-2 border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a]">
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#0a0a0a] mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">Recent Contracts</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Processed legal documents and status</p>
              </div>
              <Link
                to="/documents"
                className="text-xs font-black uppercase text-[#0a0a0a] hover:underline flex items-center gap-1 font-mono tracking-wider"
              >
                <span>View All ({stats.totalDocs})</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#0a0a0a] bg-[#f9f9f9] text-[10px] uppercase font-black text-[#0a0a0a] font-mono">
                    <th className="py-3 px-3">Contract Document</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-[#0a0a0a]">
                  {data?.recentDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#f9f9f9] transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a] shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="truncate max-w-[200px] sm:max-w-[280px]">
                            <p className="font-black uppercase text-xs text-[#0a0a0a] truncate">{doc.originalName}</p>
                            <p className="text-[10px] font-mono text-gray-500 font-semibold">
                              {(doc.fileSize / 1024).toFixed(0)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-black uppercase font-mono">
                          {doc.summary?.contractType || 'General Contract'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {doc.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#27ae60] font-mono">
                            <span className="h-2 w-2 rounded-full bg-[#27ae60]"></span>
                            Ready
                          </span>
                        ) : doc.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#d35400] font-mono animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-[#d35400]"></span>
                            Parsing...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#c0392b] font-mono">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/documents/${doc.id}/summary`}
                            className="btn btn-sm btn-primary py-1 px-2.5 text-[10px]"
                          >
                            Summary
                          </Link>
                          <Link
                            to={`/documents/${doc.id}/chat`}
                            className="btn btn-sm py-1 px-2.5 text-[10px]"
                          >
                            Chat
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extracted Obligations & Deadlines (1 col) */}
          <div className="border-[3px] border-[#0a0a0a] bg-white p-6 shadow-[6px_6px_0_#0a0a0a] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b-2 border-[#0a0a0a] mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0a0a0a]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">Upcoming Obligations</h3>
                </div>
                <span className="text-[10px] text-gray-500 font-mono font-bold uppercase">Feed</span>
              </div>

              {data?.upcomingObligations && data.upcomingObligations.length > 0 ? (
                <div className="space-y-3">
                  {data.upcomingObligations.map((ob) => (
                    <div
                      key={ob.id}
                      className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3 text-xs shadow-[2px_2px_0_#0a0a0a] hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="border border-[#0a0a0a] bg-white px-1.5 py-0.5 text-[9px] font-black uppercase font-mono">
                          {ob.category}
                        </span>
                        <span className="text-[10px] font-black uppercase text-[#0a0a0a] font-mono">
                          {ob.dueDateOrPeriod || 'Notice-based'}
                        </span>
                      </div>
                      <p className="mt-2 text-[#0a0a0a] font-medium line-clamp-2 leading-relaxed">
                        {ob.description}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-600 font-mono font-bold">
                        <span>Party: {ob.responsibleParty || 'Specified'}</span>
                        <Link
                          to={`/documents/${ob.documentId}/obligations`}
                          className="text-[#0a0a0a] underline hover:no-underline font-black uppercase"
                        >
                          Source →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500 font-medium">
                  <p className="font-bold uppercase">No pending obligations extracted.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Upload an agreement to scan deadlines.</p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t-2 border-[#0a0a0a]">
              <Link
                to="/document-generator"
                className="flex items-center justify-between border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3 shadow-[2px_2px_0_#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode2 className="h-4 w-4 text-[#0a0a0a] group-hover:text-white" />
                  <div>
                    <p className="text-xs font-black uppercase">Need a new contract?</p>
                    <p className="text-[10px] text-gray-500 group-hover:text-gray-300 font-mono">Generate NDAs, MSAs & Offers</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#0a0a0a] group-hover:text-white" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
