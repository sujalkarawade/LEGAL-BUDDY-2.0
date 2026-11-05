import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { LawyerStatusBadge, InlineError, formatDate } from '../../components/connect/ConnectUi.js';
import type { AdminLawyerRow, AdminStats, AdminReport, Specialization, LawyerStatus } from '../../types/connect.js';

type Tab = 'lawyers' | 'reports' | 'specializations';

const Stats: React.FC<{ stats: AdminStats | null }> = ({ stats }) => {
  if (!stats) return null;
  const items: Array<[string, number]> = [
    ['Total registered', stats.lawyers.total],
    ['Pending verification', stats.lawyers.PENDING_REVIEW],
    ['Verified', stats.lawyers.VERIFIED],
    ['Rejected', stats.lawyers.REJECTED],
    ['Suspended', stats.lawyers.SUSPENDED],
    ['New (7 days)', stats.lawyers.newLast7Days],
    ['Open reports', stats.openReports],
    ['Consultation requests', stats.consultations.total],
  ];
  return (
    <section className="lb-stat-row" aria-label="Platform statistics">
      {items.map(([label, value]) => (
        <div key={label} className="stat-card"><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span><strong style={{ fontSize: '1.5rem' }}>{value ?? 0}</strong></div>
      ))}
    </section>
  );
};

const LawyersTab: React.FC = () => {
  const [status, setStatus] = useState<string>('PENDING_REVIEW');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminLawyerRow[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    ConnectApi.adminLawyers(status || undefined, query || undefined, page)
      .then(r => { setRows(r.lawyers); setTotalPages(Math.max(1, r.pagination.totalPages)); })
      .catch(e => setError(e.message));
  }, [status, query, page]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="label" htmlFor="a-status">Status</label>
          <select id="a-status" className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="PENDING_REVIEW">Pending verification</option>
            <option value="INFO_REQUESTED">Information requested</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DRAFT">Draft (not submitted)</option>
          </select>
        </div>
        <form onSubmit={e => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
          <input className="input" aria-label="Search lawyers" placeholder="Name, email or enrollment number" value={q} onChange={e => setQ(e.target.value)} />
          <button type="submit" className="btn btn-secondary"><Search size={15} /> Search</button>
        </form>
      </div>
      <InlineError message={error} />
      {!rows ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
        : rows.length === 0 ? <div className="card empty-state"><h3>No profiles</h3><p>No lawyer profiles match this filter.</p></div>
          : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Lawyer</th><th>Bar Council / enrollment</th><th>Location</th><th>Status</th><th>Submitted</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td><strong style={{ fontWeight: 600 }}>{r.professionalName}</strong><br /><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.email}</span>{r.isSynthetic && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Demo</span>}</td>
                      <td>{r.barCouncilState}<br /><span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.enrollmentNumber}</span></td>
                      <td>{r.city ? `${r.city}, ${r.state}` : '—'}</td>
                      <td><LawyerStatusBadge status={r.status as LawyerStatus} />{r.openReports > 0 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>{r.openReports} report{r.openReports > 1 ? 's' : ''}</span>}</td>
                      <td>{formatDate(r.submittedAt)}</td>
                      <td><Link to={`/connect/admin/lawyers/${r.id}`} className="btn btn-secondary btn-sm">Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </section>
  );
};

const ReportsTab: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [status, setStatus] = useState('OPEN');
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => { setReports(null); ConnectApi.adminReports(status).then(r => setReports(r.reports)).catch(e => setError(e.message)); };
  useEffect(load, [status]);

  const resolve = async (id: string, outcome: 'RESOLVED' | 'DISMISSED') => {
    setError(null);
    try { await ConnectApi.adminResolveReport(id, outcome, notes[id] || ''); load(); onChanged(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ maxWidth: 220 }}>
        <label className="label" htmlFor="r-status">Show</label>
        <select id="r-status" className="input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option>
        </select>
      </div>
      <InlineError message={error} />
      {!reports ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
        : reports.length === 0 ? <div className="card empty-state"><h3>No reports</h3><p>Nothing to review here.</p></div>
          : reports.map(r => (
            <article key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <Link to={`/connect/admin/lawyers/${r.lawyerProfile.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.lawyerProfile.professionalName}</Link>
                  <p style={{ fontSize: '0.875rem' }}>{r.reason.replace(/_/g, ' ').toLowerCase()} · reported by {r.reporter.name} ({r.reporter.email}) · {formatDate(r.createdAt)}</p>
                </div>
                <LawyerStatusBadge status={r.lawyerProfile.status as LawyerStatus} />
              </div>
              {r.details && <p style={{ marginTop: 8, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{r.details}</p>}
              {r.resolution && <p style={{ marginTop: 8, fontSize: '0.875rem' }}><strong>Resolution:</strong> {r.resolution}</p>}
              {r.status === 'OPEN' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Resolution note (required)" value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => resolve(r.id, 'RESOLVED')}>Mark resolved</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => resolve(r.id, 'DISMISSED')}>Dismiss</button>
                </div>
              )}
            </article>
          ))}
    </section>
  );
};

const SpecializationsTab: React.FC = () => {
  const [items, setItems] = useState<Array<Specialization & { isActive: boolean; lawyerCount: number }> | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = () => ConnectApi.adminSpecializations().then(r => setItems(r.specializations)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await ConnectApi.adminCreateSpecialization(name.trim()); setName(''); load(); } catch (err: any) { setError(err.message); }
  };
  const toggle = async (id: string, isActive: boolean) => {
    setError(null);
    try { await ConnectApi.adminUpdateSpecialization(id, { isActive }); load(); } catch (err: any) { setError(err.message); }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <input className="input" aria-label="New specialization" placeholder="New specialization name" value={name} onChange={e => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={name.trim().length < 3}>Add</button>
      </form>
      <InlineError message={error} />
      {items && (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Specialization</th><th>Lawyers</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.lawyerCount}</td>
                  <td>{s.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-default">Hidden</span>}</td>
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(s.id, !s.isActive)}>{s.isActive ? 'Hide' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const AdminConnectPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (['lawyers', 'reports', 'specializations'].includes(params.get('tab') || '') ? params.get('tab') : 'lawyers') as Tab;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadStats = () => ConnectApi.adminStats().then(setStats).catch(e => setError(e.message));
  useEffect(() => { loadStats(); }, []);

  return (
    <div className="page-wrapper animate-fade-in lb-connect">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Legal Buddy Connect — Admin</h1>
          <p>Review lawyer credentials, moderate reports and manage specializations. Every decision is recorded in the audit log.</p>
        </div>
      </div>
      <InlineError message={error} />
      <Stats stats={stats} />
      <nav className="tab-nav" style={{ margin: '16px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        {([['lawyers', 'Lawyer profiles'], ['reports', `Reports${stats?.openReports ? ` (${stats.openReports})` : ''}`], ['specializations', 'Specializations']] as Array<[Tab, string]>).map(([t, label]) => (
          <button key={t} type="button" className={`tab-item${tab === t ? ' active' : ''}`} onClick={() => setParams({ tab: t })}>{label}</button>
        ))}
      </nav>
      {tab === 'lawyers' && <LawyersTab />}
      {tab === 'reports' && <ReportsTab onChanged={loadStats} />}
      {tab === 'specializations' && <SpecializationsTab />}
    </div>
  );
};
