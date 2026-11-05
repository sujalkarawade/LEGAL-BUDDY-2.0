import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import type { AppNotification } from '../../types/connect.js';

const POLL_MS = 60000;

/** In-app notifications (no email). Polls once a minute only while the tab is visible. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = () => ConnectApi.notifications().then(r => { setItems(r.notifications); setUnread(r.unreadCount); }).catch(() => undefined);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) { await ConnectApi.markNotificationRead(n.id).catch(() => undefined); load(); }
    if (n.link && n.link.startsWith('/')) navigate(n.link);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        style={{
          position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text-secondary)',
        }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: 'var(--danger)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="lb-notifications" role="menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
              {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => ConnectApi.markAllNotificationsRead().then(load)}>Mark all read</button>}
            </div>
            {items.length === 0 ? <p style={{ padding: 16, fontSize: '0.875rem' }}>No notifications yet.</p> : (
              <ul style={{ listStyle: 'none', maxHeight: 380, overflowY: 'auto' }}>
                {items.map(n => (
                  <li key={n.id}>
                    <button type="button" role="menuitem" onClick={() => openItem(n)} className="lb-notification-item" data-unread={n.readAt ? undefined : 'true'}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{n.body}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
