// ============================================
// TimeTrack BGFIBank - Chef de Département JS
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let chefCharts = {};

// Auth check
if (!token || (currentUser.role !== 'Chef de Département' && currentUser.role !== 'Administrateur')) {
  window.location = '/login';
}

async function checkAuth() {
  const r = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) { logout(); }
}
checkAuth();

// ============================================
// UTILITIES
// ============================================
function api(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }).then(async r => {
    if (r.status === 401) { logout(); return {}; }
    return r.json();
  });
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check' : 'exclamation') + '-circle" style="margin-right:6px"></i>' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function minutesToHours(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h + 'h ' + String(m).padStart(2, '0') + 'm';
}

function logout() {
  localStorage.clear();
  window.location = '/login';
}

function destroyCharts() {
  Object.values(chefCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  chefCharts = {};
}

// ============================================
// ROUTING
// ============================================
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('equipe') || path.includes('team')) return 'equipe';
  if (path.includes('validation')) return 'validation';
  if (path.includes('rapports') || path.includes('reports')) return 'rapports';
  return 'dashboard';
}

function navigate(page) {
  history.pushState({}, '', '/chef/' + page);
  renderPage(page);
}

// ============================================
// LAYOUT
// ============================================
function renderLayout(title, content) {
  const page = getCurrentPage();
  const name = currentUser.first_name + ' ' + currentUser.last_name;
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  const dept = currentUser.department_name || '';

  document.getElementById('app').innerHTML = `
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="fas fa-star text-yellow-400"></i></div>
      <div class="logo-text"><h2>TimeTrack</h2><p>BGFIBank</p></div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Tableau de Bord</div>
      <a class="sidebar-item ${page==='dashboard'?'active':''}" onclick="navigate('dashboard')">
        <i class="fas fa-tachometer-alt"></i> Vue d'ensemble
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Mon Équipe</div>
      <a class="sidebar-item ${page==='equipe'?'active':''}" onclick="navigate('equipe')">
        <i class="fas fa-users"></i> Mon Équipe
      </a>
      <a class="sidebar-item ${page==='validation'?'active':''}" onclick="navigate('validation')">
        <i class="fas fa-check-circle"></i> Validation
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Rapports</div>
      <a class="sidebar-item ${page==='rapports'?'active':''}" onclick="navigate('rapports')">
        <i class="fas fa-chart-bar"></i> Rapports
      </a>
    </div>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="avatar" style="background:${avatarColor}">${initials}</div>
        <div>
          <div class="name">${name}</div>
          <div class="role">${dept}</div>
        </div>
      </div>
      <div class="sidebar-search"><input type="text" placeholder="Rechercher..."></div>
      <button class="logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Déconnexion</button>
    </div>
  </div>
  <div class="main-content">
    <div class="topbar">
      <h1>${title}</h1>
      <div class="user-badge">
        <div class="avatar" style="background:${avatarColor}">${initials}</div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="role">Chef de Département</div>
        </div>
      </div>
    </div>
    <div class="content-area" id="content">${content}</div>
  </div>`;
}

// ============================================
// DASHBOARD CHEF
// ============================================
async function renderDashboard() {
  renderLayout('Tableau de bord équipe', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const data = await api('/api/chef/dashboard');

  const today = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  document.getElementById('content').innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px">
      <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
      <h2 style="font-size:20px;font-weight:700;color:#1e3a5f">Vue d'ensemble de mon équipe</h2>
    </div>
    <span style="font-size:13px;color:#6b7280">${today}</span>
  </div>

  <!-- KPIs -->
  <div class="grid-3" style="margin-bottom:24px">
    <div class="kpi-card" style="border-left-color:#1e3a5f">
      <div>
        <div class="kpi-value">${data.active_agents}</div>
        <div class="kpi-label">Agents actifs</div>
      </div>
    </div>
    <div class="kpi-card" style="border-left-color:#f59e0b">
      <div>
        <div class="kpi-value">${data.total_team_hours}</div>
        <div class="kpi-label">Total équipe ce mois</div>
      </div>
    </div>
    <div class="kpi-card" style="border-left-color:#ef4444">
      <div>
        <div class="kpi-value">${data.to_validate}</div>
        <div class="kpi-label">Sessions à valider</div>
      </div>
    </div>
  </div>

  <!-- Charts -->
  <div class="grid-2" style="margin-bottom:24px">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f"></i> Heures par Agent</div>
      ${data.hoursByAgent.length > 0 ? `<canvas id="chartAgents" height="220"></canvas>` : `<div style="text-align:center;padding:40px;color:#9ca3af">Aucune donnée</div>`}
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Répartition par Objectif</div>
      ${data.byObjective.length > 0 ? `
      <div style="display:flex;align-items:center;gap:20px">
        <div style="width:200px;height:200px"><canvas id="chartObj"></canvas></div>
        <div style="flex:1">
          ${data.byObjective.map(o => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="width:12px;height:12px;border-radius:2px;background:${o.color};display:inline-block"></span>
            <span style="font-size:12px;color:#555">${o.name}</span>
          </div>`).join('')}
        </div>
      </div>` : `<div style="text-align:center;padding:40px;color:#9ca3af">Aucune donnée</div>`}
    </div>
  </div>

  <!-- Productivité équipe aujourd'hui -->
  <div class="chart-card" style="margin-bottom:16px">
    <div class="chart-title"><i class="fas fa-user-clock" style="color:#1e3a5f"></i> Productivité de l'Équipe — Aujourd'hui (base 8h/agent)</div>
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1;padding:14px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#16a34a">${data.team_productivity?.productive_hours_today || '0h'}</div>
        <div style="font-size:12px;color:#6b7280">Heures Productives <b style="color:#16a34a">(${data.team_productivity?.productive_pct || 0}%)</b></div>
      </div>
      <div style="flex:1;padding:14px;background:#fee2e2;border-radius:10px;border:1px solid #fecaca;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#dc2626">${data.team_productivity?.non_productive_hours_today || '0h'}</div>
        <div style="font-size:12px;color:#6b7280">Heures Non Productives <b style="color:#dc2626">(${data.team_productivity?.non_productive_pct || 0}%)</b></div>
      </div>
    </div>
    <table style="width:100%">
      <thead><tr>
        <th>AGENT</th>
        <th>H. PRODUCTIVES (auj.)</th>
        <th>H. NON PRODUCTIVES (auj.)</th>
        <th>PROGRESSION</th>
      </tr></thead>
      <tbody>
        ${data.agentDetail.map(a => {
          const pct = a.productive_pct_today || 0;
          const color = pct >= 80 ? '#16a34a' : (pct >= 50 ? '#f59e0b' : '#dc2626');
          const badge = pct >= 80 ? 'badge-active' : (pct >= 50 ? 'badge-warning' : 'badge-inactive');
          const label = pct >= 80 ? 'Bon' : (pct >= 50 ? 'Moyen' : 'Faible');
          return `<tr>
            <td style="font-weight:600;color:#1e3a5f">${a.agent_name}</td>
            <td><span style="font-weight:700;color:#16a34a">${a.productive_hours_today || '0h'}</span> <span style="font-size:11px;color:#6b7280">(${pct}%)</span></td>
            <td><span style="font-weight:700;color:#dc2626">${a.non_productive_hours_today || '8h00'}</span> <span style="font-size:11px;color:#6b7280">(${a.non_productive_pct_today || 100}%)</span></td>
            <td style="min-width:130px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:4px"></div>
                </div>
                <span class="badge ${badge}" style="font-size:10px">${label}</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
        ${data.agentDetail.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px">Aucune donnée</td></tr>' : ''}
      </tbody>
    </table>
  </div>

  <!-- Détail par Agent — Ce mois -->
  <div class="chart-card">
    <div class="chart-title"><i class="fas fa-list" style="color:#1e3a5f"></i> Détail par Agent — Ce mois</div>
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>AGENT</th><th>SESSIONS</th><th>TOTAL HEURES</th><th>HEURES VALIDÉES</th><th>% VALIDÉ</th>
        </tr></thead>
        <tbody>
          ${data.agentDetail.map(a => `<tr>
            <td style="font-weight:600;color:#1e3a5f">${a.agent_name}</td>
            <td>${a.total_sessions}</td>
            <td style="font-weight:700">${a.total_hours}</td>
            <td style="font-weight:700;color:#16a34a">${a.validated_hours}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:80px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden">
                  <div style="width:${Math.min(100, Math.round(a.pct_validated))}%;height:100%;background:#1e3a5f;border-radius:3px"></div>
                </div>
                <span style="font-size:12px;font-weight:700;color:#1e3a5f">${Math.round(a.pct_validated)}%</span>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  destroyCharts();

  if (data.hoursByAgent.length > 0) {
    chefCharts.agents = new Chart(document.getElementById('chartAgents'), {
      type: 'bar',
      data: {
        labels: data.hoursByAgent.map(a => a.agent_name.split(' ')[1] || a.agent_name),
        datasets: [{ data: data.hoursByAgent.map(a => (a.total_minutes / 60).toFixed(2)), backgroundColor: '#1e3a5f' }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + 'h' } } } }
    });
  }

  if (data.byObjective.length > 0) {
    chefCharts.obj = new Chart(document.getElementById('chartObj'), {
      type: 'doughnut',
      data: {
        labels: data.byObjective.map(o => o.name),
        datasets: [{ data: data.byObjective.map(o => o.total_minutes), backgroundColor: data.byObjective.map(o => o.color), borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false } }, cutout: '55%' }
    });
  }
}

// ============================================
// MON ÉQUIPE
// ============================================
async function renderEquipe() {
  renderLayout('Mon Équipe', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const members = await api('/api/chef/team');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <i class="fas fa-users"></i><h2>Mon Équipe</h2>
    </div>
  </div>
  <div class="grid-auto">
    ${members.map(m => {
      const name = m.first_name + ' ' + m.last_name;
      const initials = getInitials(name);
      const color = getAvatarColor(name);
      return `
      <div class="team-card">
        <div class="agent-info">
          <div class="avatar" style="background:${color}">${initials}</div>
          <div>
            <h3>${name}</h3>
            <p>${m.email}</p>
          </div>
        </div>
        <div class="stats">
          <div class="stat-item">
            <div class="val">${m.today_sessions}</div>
            <div class="lbl">Sessions auj.</div>
          </div>
          <div class="stat-item">
            <div class="val">${m.today_hours}</div>
            <div class="lbl">Temps auj.</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:#9ca3af">
          Dernière connexion : ${m.last_login ? formatDate(m.last_login) : 'Jamais'}
        </div>
      </div>`;
    }).join('')}
    ${members.length === 0 ? '<div style="color:#9ca3af;text-align:center;padding:40px;grid-column:1/-1">Aucun agent dans votre équipe</div>' : ''}
  </div>`;
}

// ============================================
// VALIDATION
// ============================================
async function renderValidation() {
  renderLayout('Validation des Sessions', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const sessions = await api('/api/chef/validation');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <i class="fas fa-check-circle" style="color:#22c55e"></i>
      <h2>Validation des Sessions</h2>
    </div>
    <button class="btn btn-success" onclick="validateAll()">
      <i class="fas fa-check-double"></i> Tout valider
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th class="checkbox-col"><input type="checkbox" id="select-all" onchange="toggleAll(this)"></th>
            <th>AGENT</th><th>TÂCHE</th><th>OBJECTIF</th>
            <th>DATE</th><th>DURÉE</th><th>TYPE</th><th>ACTIONS</th>
          </tr></thead>
          <tbody>
            ${sessions.map(s => `<tr id="row-${s.id}">
              <td><input type="checkbox" class="session-check" value="${s.id}"></td>
              <td style="font-weight:600;color:#1e3a5f">${s.agent_name}</td>
              <td>${s.task_name}</td>
              <td><span class="badge-obj" style="background:${s.objective_color}">${s.objective_name}</span></td>
              <td style="font-size:12px;color:#6b7280">
                ${formatDate(s.start_time)}<br>
                <span style="font-size:11px">${formatTime(s.start_time)} — ${s.end_time ? formatTime(s.end_time) : '?'}</span>
              </td>
              <td style="font-weight:700">${minutesToHours(s.duration_minutes || 0)}</td>
              <td><span class="badge-auto">${s.session_type || 'Auto'}</span></td>
              <td style="display:flex;gap:6px">
                <button class="validate-btn" onclick="validateSession(${s.id})">
                  <i class="fas fa-check"></i>
                </button>
                <button class="reject-btn" onclick="rejectSession(${s.id})">
                  <i class="fas fa-times"></i>
                </button>
              </td>
            </tr>`).join('')}
            ${sessions.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:#9ca3af">Aucune session en attente de validation</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function toggleAll(cb) {
  document.querySelectorAll('.session-check').forEach(c => c.checked = cb.checked);
}

async function validateSession(id) {
  const r = await api('/api/chef/validate/' + id, { method: 'POST' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Session validée !');
  const row = document.getElementById('row-' + id);
  if (row) row.remove();
}

async function rejectSession(id) {
  const r = await api('/api/chef/reject/' + id, { method: 'POST', body: JSON.stringify({ reason: '' }) });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Session rejetée', 'error');
  const row = document.getElementById('row-' + id);
  if (row) row.remove();
}

async function validateAll() {
  if (!confirm('Valider toutes les sessions en attente ?')) return;
  const r = await api('/api/chef/validate-all', { method: 'POST' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Toutes les sessions ont été validées !');
  renderValidation();
}

// ============================================
// RAPPORTS
// ============================================
async function renderRapports() {
  renderLayout('Rapports', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const data = await api('/api/chef/reports');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-chart-bar"></i><h2>Rapports de mon département</h2></div>
    <button class="btn btn-primary" onclick="exportCSV(window.chefReportsData,'rapports_dept')">
      <i class="fas fa-file-csv"></i> Exporter CSV
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>AGENT</th><th>TÂCHE</th><th>PROCESSUS</th><th>OBJECTIF</th>
            <th>DATE</th><th>DURÉE</th><th>STATUT</th>
          </tr></thead>
          <tbody>
            ${data.map(r => `<tr>
              <td style="font-weight:600;color:#1e3a5f">${r.agent_name}</td>
              <td>${r.task_name}</td>
              <td>${r.process_name}</td>
              <td><span class="badge-obj" style="background:${r.objective_color}">${r.objective_name}</span></td>
              <td style="font-size:12px;color:#6b7280">${formatDate(r.start_time)}</td>
              <td style="font-weight:700">${minutesToHours(r.duration_minutes || 0)}</td>
              <td>${getStatusBadge(r.status)}</td>
            </tr>`).join('')}
            ${data.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af">Aucune donnée</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  window.chefReportsData = data;
}

function getStatusBadge(status) {
  const cls = { 'Validé': 'status-valide', 'Terminé': 'status-termine', 'Rejeté': 'status-rejete', 'En cours': 'status-en-cours' };
  const icon = status === 'Validé' ? '✓ ' : status === 'Terminé' ? '✓ ' : status === 'Rejeté' ? '✗ ' : '';
  return `<span class="status-badge ${cls[status]||'status-en-cours'}">${icon}${status}</span>`;
}

function exportCSV(data, name) {
  if (!data || !data.length) { toast('Aucune donnée', 'error'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(r => Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}

// ============================================
// RENDER
// ============================================
function renderPage(page) {
  destroyCharts();
  const p = page || getCurrentPage();
  if (p === 'dashboard') renderDashboard();
  else if (p === 'equipe') renderEquipe();
  else if (p === 'validation') renderValidation();
  else if (p === 'rapports') renderRapports();
  else renderDashboard();
}

renderPage();
window.addEventListener('popstate', () => renderPage());
