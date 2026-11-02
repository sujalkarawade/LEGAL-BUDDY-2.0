import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';

export const AppLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font)',
      }}
    >
      <Sidebar collapsed={sidebarCollapsed} />

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Navbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 28px',
            background: 'var(--surface)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
