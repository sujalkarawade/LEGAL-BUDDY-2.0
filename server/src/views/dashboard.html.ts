export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legal Buddy | Server Logs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --border-dark: #cbd5e1;
      
      --text: #0f172a;
      --text-muted: #64748b;
      --text-dim: #94a3b8;
      
      --primary: #2563eb;
      --primary-light: #eff6ff;
      --primary-border: #bfdbfe;
      
      --level-info-bg: #f0fdf4;
      --level-info-text: #166534;
      --level-info-border: #bbf7d0;

      --level-http-bg: #f0f9ff;
      --level-http-text: #0369a1;
      --level-http-border: #bae6fd;
      
      --level-warn-bg: #fffbeb;
      --level-warn-text: #b45309;
      --level-warn-border: #fde68a;
      
      --level-error-bg: #fef2f2;
      --level-error-text: #b91c1c;
      --level-error-border: #fecaca;

      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 0.9rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text);
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }

    .brand-title {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #15803d;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .btn {
      font-family: var(--font-sans);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn:hover {
      background: #f1f5f9;
      border-color: var(--border-dark);
    }

    .btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }

    .btn-danger {
      color: #b91c1c;
      background: #fef2f2;
      border-color: #fecaca;
    }

    .btn-danger:hover {
      background: #fee2e2;
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 1.25rem 1.75rem;
      max-width: 1500px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Quick status info bar */
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.65rem 1rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .status-info-items {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }

    .status-info-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .status-info-item strong {
      color: var(--text);
    }

    /* Logs Card */
    .logs-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 540px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    /* Toolbar */
    .logs-toolbar {
      padding: 0.75rem 1rem;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .search-box {
      border: 1px solid var(--border);
      background: #f8fafc;
      padding: 0.38rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-family: var(--font-sans);
      width: 240px;
      color: var(--text);
      transition: all 0.15s ease;
    }

    .search-box:focus {
      outline: none;
      background: #ffffff;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      width: 280px;
    }

    .filter-pills {
      display: flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: 6px;
      gap: 2px;
    }

    .pill-btn {
      border: none;
      background: transparent;
      font-family: var(--font-sans);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.65rem;
      border-radius: 4px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.15s ease;
    }

    .pill-btn:hover {
      color: var(--text);
    }

    .pill-btn.active {
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .pill-count {
      font-size: 0.68rem;
      color: var(--text-dim);
    }

    /* Logs Table */
    .table-container {
      flex: 1;
      overflow-y: auto;
      max-height: calc(100vh - 280px);
      min-height: 420px;
      background: #ffffff;
    }

    .table-container::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    .table-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .table-container::-webkit-scrollbar-track {
      background: #f8fafc;
    }

    .log-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .log-table th {
      position: sticky;
      top: 0;
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
      padding: 0.55rem 0.85rem;
      text-align: left;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      z-index: 5;
    }

    .log-row {
      border-bottom: 1px solid #f1f5f9;
      transition: background-color 0.1s ease;
      cursor: pointer;
    }

    .log-row:hover {
      background-color: #f8fafc;
    }

    .log-row td {
      padding: 0.45rem 0.85rem;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .col-time {
      color: var(--text-muted);
      white-space: nowrap;
      width: 110px;
      font-size: 0.74rem;
    }

    .col-level {
      width: 75px;
      white-space: nowrap;
    }

    .col-module {
      width: 95px;
      white-space: nowrap;
    }

    .col-msg {
      color: var(--text);
    }

    .badge {
      display: inline-block;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      border: 1px solid transparent;
    }

    .badge-info { background: var(--level-info-bg); color: var(--level-info-text); border-color: var(--level-info-border); }
    .badge-http { background: var(--level-http-bg); color: var(--level-http-text); border-color: var(--level-http-border); }
    .badge-warn { background: var(--level-warn-bg); color: var(--level-warn-text); border-color: var(--level-warn-border); }
    .badge-error { background: var(--level-error-bg); color: var(--level-error-text); border-color: var(--level-error-border); }
    .badge-system { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }

    .module-tag {
      font-size: 0.68rem;
      color: #475569;
      background: #f1f5f9;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-weight: 600;
    }

    .empty-logs {
      padding: 4rem 1rem;
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    /* Modal for details */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(2px);
      z-index: 50;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .modal-overlay.open {
      display: flex;
    }

    .modal-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      max-width: 650px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .modal-header {
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
    }

    .modal-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text);
    }

    .modal-body {
      padding: 1rem 1.15rem;
      overflow-y: auto;
      font-family: var(--font-mono);
      font-size: 0.8rem;
    }

    .json-code {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.85rem;
      white-space: pre-wrap;
      color: #0f172a;
      overflow-x: auto;
    }

    .modal-footer {
      padding: 0.65rem 1.15rem;
      border-top: 1px solid var(--border);
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    /* Simple toast */
    .toast {
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      background: #0f172a;
      color: #ffffff;
      padding: 0.5rem 0.9rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.2s ease;
      z-index: 100;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>

  <!-- Clean Header -->
  <header>
    <a href="/" class="brand">
      <div class="brand-icon">⚖️</div>
      <div>
        <div class="brand-title">Legal Buddy Server</div>
      </div>
    </a>

    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <div class="status-badge">
        <span class="status-dot"></span>
        <span id="connStatus">Online (Port 5000)</span>
      </div>
    </div>

    <div class="header-right">
      <button class="btn" id="btnPingHealth" title="Check /api/health">Ping API</button>
      <button class="btn" id="btnTestLog" title="Send a test log">Test Log</button>
      <a href="http://localhost:5173" target="_blank" class="btn btn-primary">Open App (5173)</a>
    </div>
  </header>

  <!-- Main Section -->
  <main>
    <!-- Simple Status Bar -->
    <div class="status-bar">
      <div class="status-info-items">
        <div class="status-info-item">
          <span>Database:</span>
          <strong id="dbStatus" style="color: #166534;">PostgreSQL (Connected)</strong>
        </div>
        <div class="status-info-item">
          <span>AI Model:</span>
          <strong>Llama 3.1 8B (auto)</strong>
        </div>
        <div class="status-info-item">
          <span>OCR:</span>
          <strong>PaddleOCR (Devanagari/En)</strong>
        </div>
        <div class="status-info-item">
          <span>Uptime:</span>
          <strong id="uptimeText">00h 00m 00s</strong>
        </div>
      </div>
      <div>
        <span>Total Logs: <strong id="totalCount">0</strong></span>
      </div>
    </div>

    <!-- Logs Container Card -->
    <div class="logs-card">
      <!-- Toolbar -->
      <div class="logs-toolbar">
        <div class="toolbar-left">
          <input type="text" id="searchBox" class="search-box" placeholder="Search logs..." />

          <!-- Filter Pills -->
          <div class="filter-pills" id="filterPills">
            <button class="pill-btn active" data-level="all">All <span class="pill-count" id="countAll">0</span></button>
            <button class="pill-btn" data-level="info">Info <span class="pill-count" id="countInfo">0</span></button>
            <button class="pill-btn" data-level="http">HTTP <span class="pill-count" id="countHttp">0</span></button>
            <button class="pill-btn" data-level="warn">Warn <span class="pill-count" id="countWarn">0</span></button>
            <button class="pill-btn" data-level="error">Error <span class="pill-count" id="countError">0</span></button>
          </div>
        </div>

        <div class="toolbar-right">
          <button class="btn" id="btnSort">
            <span id="sortText">Newest First</span>
          </button>
          <button class="btn" id="btnAutoScroll">
            <span id="scrollText">Auto-Scroll: ON</span>
          </button>
          <button class="btn btn-danger" id="btnClearLogs">Clear</button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="table-container" id="tableContainer">
        <table class="log-table">
          <thead>
            <tr>
              <th style="width: 105px;">Time</th>
              <th style="width: 75px;">Level</th>
              <th style="width: 95px;">Module</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody id="logTbody">
            <!-- Populated dynamically -->
          </tbody>
        </table>

        <div class="empty-logs" id="emptyLogs" style="display: none;">
          No logs match your filter.
        </div>
      </div>
    </div>
  </main>

  <!-- Details Modal -->
  <div class="modal-overlay" id="modal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">Log Entry Details</div>
        <button class="btn" onclick="closeModal()" style="padding: 0.15rem 0.45rem;">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 0.65rem; font-weight: 600;" id="modalMsg"></div>
        <div class="json-code" id="modalJson"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="btnCopy">Copy JSON</button>
        <button class="btn btn-primary" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast">Copied</div>

  <script>
    let logs = [];
    let activeLevel = 'all';
    let searchQuery = '';
    let sortNewestFirst = true;
    let autoScroll = true;
    let eventSource = null;
    let startTime = Date.now();
    let selectedLog = null;

    const logTbody = document.getElementById('logTbody');
    const tableContainer = document.getElementById('tableContainer');
    const emptyLogs = document.getElementById('emptyLogs');

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    function formatTime(iso) {
      const d = new Date(iso);
      const pad = n => String(n).padStart(2, '0');
      return \`\${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}\`;
    }

    function getBadge(level) {
      const l = level.toLowerCase();
      if (l === 'error') return '<span class="badge badge-error">ERROR</span>';
      if (l === 'warn') return '<span class="badge badge-warn">WARN</span>';
      if (l === 'http') return '<span class="badge badge-http">HTTP</span>';
      if (l === 'system') return '<span class="badge badge-system">SYS</span>';
      return '<span class="badge badge-info">INFO</span>';
    }

    function createRow(entry) {
      const tr = document.createElement('tr');
      tr.className = 'log-row';
      tr.id = entry.id;

      tr.innerHTML = \`
        <td class="col-time">\${formatTime(entry.timestamp)}</td>
        <td class="col-level">\${getBadge(entry.level)}</td>
        <td class="col-module"><span class="module-tag">\${entry.module}</span></td>
        <td class="col-msg">\${escapeHtml(entry.message)}</td>
      \`;

      tr.onclick = () => openModal(entry);
      return tr;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function getFilteredLogs() {
      let filtered = logs.filter(l => {
        if (activeLevel !== 'all' && l.level.toLowerCase() !== activeLevel) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchMsg = l.message.toLowerCase().includes(q);
          const matchMod = l.module.toLowerCase().includes(q);
          const matchDet = l.details ? JSON.stringify(l.details).toLowerCase().includes(q) : false;
          if (!matchMsg && !matchMod && !matchDet) return false;
        }
        return true;
      });

      if (sortNewestFirst) {
        filtered = [...filtered].reverse();
      }
      return filtered;
    }

    function renderTable() {
      const filtered = getFilteredLogs();
      logTbody.innerHTML = '';

      if (filtered.length === 0) {
        emptyLogs.style.display = 'block';
      } else {
        emptyLogs.style.display = 'none';
        const fragment = document.createDocumentFragment();
        filtered.forEach(entry => fragment.appendChild(createRow(entry)));
        logTbody.appendChild(fragment);
      }

      if (autoScroll) {
        tableContainer.scrollTop = sortNewestFirst ? 0 : tableContainer.scrollHeight;
      }
    }

    function updateCounts() {
      const total = logs.length;
      document.getElementById('totalCount').innerText = total;
      document.getElementById('countAll').innerText = total;
      document.getElementById('countInfo').innerText = logs.filter(l => l.level === 'info').length;
      document.getElementById('countHttp').innerText = logs.filter(l => l.level === 'http').length;
      document.getElementById('countWarn').innerText = logs.filter(l => l.level === 'warn').length;
      document.getElementById('countError').innerText = logs.filter(l => l.level === 'error').length;
    }

    function handleIncomingLog(newEntry) {
      logs.push(newEntry);
      if (logs.length > 2000) logs.shift();

      updateCounts();

      const passLevel = activeLevel === 'all' || newEntry.level.toLowerCase() === activeLevel;
      let passSearch = true;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        passSearch = newEntry.message.toLowerCase().includes(q) || newEntry.module.toLowerCase().includes(q);
      }

      if (passLevel && passSearch) {
        emptyLogs.style.display = 'none';
        const row = createRow(newEntry);
        if (sortNewestFirst) {
          logTbody.insertBefore(row, logTbody.firstChild);
        } else {
          logTbody.appendChild(row);
        }

        if (autoScroll) {
          tableContainer.scrollTop = sortNewestFirst ? 0 : tableContainer.scrollHeight;
        }
      }
    }

    // Modal
    function openModal(entry) {
      selectedLog = entry;
      document.getElementById('modalMsg').innerText = entry.message;
      document.getElementById('modalJson').innerText = JSON.stringify(entry.details || entry, null, 2);
      document.getElementById('modal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('modal').classList.remove('open');
      selectedLog = null;
    }

    document.getElementById('btnCopy').addEventListener('click', () => {
      if (selectedLog) {
        navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
        showToast('JSON copied to clipboard');
      }
    });

    document.getElementById('modal').addEventListener('click', e => {
      if (e.target.id === 'modal') closeModal();
    });

    // Toolbar events
    document.getElementById('filterPills').addEventListener('click', e => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLevel = btn.getAttribute('data-level');
      renderTable();
    });

    document.getElementById('searchBox').addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      renderTable();
    });

    document.getElementById('btnSort').addEventListener('click', () => {
      sortNewestFirst = !sortNewestFirst;
      document.getElementById('sortText').innerText = sortNewestFirst ? 'Newest First' : 'Oldest First';
      renderTable();
    });

    document.getElementById('btnAutoScroll').addEventListener('click', () => {
      autoScroll = !autoScroll;
      document.getElementById('scrollText').innerText = autoScroll ? 'Auto-Scroll: ON' : 'Auto-Scroll: OFF';
    });

    document.getElementById('btnClearLogs').addEventListener('click', async () => {
      await fetch('/api/logs/clear', { method: 'POST' });
      logs = [];
      updateCounts();
      renderTable();
      showToast('Logs cleared');
    });

    document.getElementById('btnPingHealth').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        showToast(\`/api/health -> \${res.status} OK\`);
      } catch (err) {
        showToast('Ping failed');
      }
    });

    document.getElementById('btnTestLog').addEventListener('click', async () => {
      const levels = ['info', 'warn', 'error', 'http'];
      const lvl = levels[Math.floor(Math.random() * levels.length)];
      await fetch('/api/logs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl, module: 'TEST', message: 'Sample test log at ' + new Date().toLocaleTimeString() })
      });
      showToast('Emitted test ' + lvl.toUpperCase() + ' log');
    });

    // SSE Connection
    function initStream() {
      eventSource = new EventSource('/api/logs/stream');
      eventSource.onmessage = e => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'log') handleIncomingLog(payload.data);
        } catch {}
      };
    }

    // Uptime ticker
    setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      document.getElementById('uptimeText').innerText = \`\${h}h \${m}m \${s}s\`;
    }, 1000);

    // Initial Load
    async function loadInitial() {
      try {
        const res = await fetch('/api/logs?limit=500');
        const json = await res.json();
        if (json.success) {
          logs = json.data.logs || [];
          if (json.data.metrics?.startedAt) startTime = new Date(json.data.metrics.startedAt).getTime();
          updateCounts();
          renderTable();
        }
      } catch (err) {
        console.error('Initial logs failed:', err);
      }
    }

    loadInitial();
    initStream();
  </script>
</body>
</html>
`;
}
