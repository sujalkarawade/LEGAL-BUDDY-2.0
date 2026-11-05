import React, { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { InsightsApi } from '../../services/insightsApi.js';
import type { ObligationReminder } from '../../types/insights.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Per-obligation "remind me on" date. Fires an in-app notification and is included in the .ics export. */
export const ReminderControl: React.FC<{
  documentId: string;
  obligationId: string;
  reminder: ObligationReminder | undefined;
  onChange: (obligationId: string, reminder: ObligationReminder | null) => void;
}> = ({ documentId, obligationId, reminder, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(reminder?.remindOn || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!date) return;
    setBusy(true); setError(null);
    try { const r = await InsightsApi.setReminder(documentId, obligationId, date); onChange(obligationId, r.reminder); setEditing(false); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { await InsightsApi.deleteReminder(documentId, obligationId); onChange(obligationId, null); setDate(''); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        {reminder ? (
          <>
            <span className="badge badge-info"><BellRing size={12} /> Reminder {new Date(`${reminder.remindOn}T00:00:00`).toLocaleDateString()}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} disabled={busy}>Change</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy} aria-label="Remove reminder"><X size={12} /></button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}><BellRing size={12} /> Remind me</button>
        )}
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" className="input" style={{ width: 'auto', padding: '6px 8px' }} min={today()} value={date} onChange={e => setDate(e.target.value)} aria-label="Reminder date" />
      <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!date || busy}>Save</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>{error}</span>}
    </div>
  );
};
