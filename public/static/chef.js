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
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fas fa-' + (icons[type] || 'check-circle') + '" style="margin-right:6px"></i>' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
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

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {}
  localStorage.clear();
  window.location = '/login';
}

// ============================================
// NOTIFICATIONS (polling 30s)
// ============================================
let _chefNotifSince = new Date().toISOString();

function startChefNotifPolling() {
  setInterval(async () => {
    try {
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(_chefNotifSince), { headers: { 'Authorization': 'Bearer ' + token } });
      if (!r.ok) return;
      const items = await r.json();
      _chefNotifSince = new Date().toISOString();
      items.forEach(n => {
        if (n.status === 'Terminé') {
          toast('Nouvelle session a valider - ' + n.agent_name + ' : ' + n.task_name, 'info');
        }
      });
    } catch(e) {}
  }, 30000);
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
    <div class="chart-title"><i class="fas fa-user-clock" style="color:#1e3a5f"></i> Productivité de l'Équipe — Aujourd'hui ${data.is_weekend ? '<span style="background:#fef3c7;color:#92400e;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px"><i class="fas fa-moon"></i> Week-end</span>' : '(base 8h/agent)'}</div>
    ${data.is_weekend ? `
    <div style="text-align:center;padding:24px;color:#92400e;background:#fef9c3;border-radius:10px">
      <i class="fas fa-calendar-times" style="font-size:28px;margin-bottom:8px;display:block"></i>
      <div style="font-weight:700">Week-end — Pas de journée de travail attendue</div>
      <div style="font-size:12px;margin-top:4px;color:#78350f">Les statistiques reprennent automatiquement lundi</div>
    </div>` : `
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div style="flex:1;padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#16a34a">${data.team_productivity?.validated_hours_today || data.team_productivity?.productive_hours_today || '0h 00m'}</div>
        <div style="font-size:11px;color:#6b7280">✅ Validées <b style="color:#16a34a">(${data.team_productivity?.validated_pct || data.team_productivity?.productive_pct || 0}%)</b></div>
      </div>
      <div style="flex:1;padding:12px;background:#fffbeb;border-radius:10px;border:1px solid #fde68a;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#d97706">${data.team_productivity?.pending_hours_today || '0h 00m'}</div>
        <div style="font-size:11px;color:#6b7280">⏳ En attente <b style="color:#d97706">(${data.team_productivity?.pending_pct || 0}%)</b></div>
      </div>
      <div style="flex:1;padding:12px;background:#fee2e2;border-radius:10px;border:1px solid #fecaca;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#dc2626">${data.team_productivity?.non_productive_hours_today || '0h 00m'}</div>
        <div style="font-size:11px;color:#6b7280">❌ Non pointées <b style="color:#dc2626">(${data.team_productivity?.non_productive_pct || 0}%)</b></div>
      </div>
    </div>
    <table style="width:100%">
      <thead><tr>
        <th>AGENT</th>
        <th style="color:#16a34a">✅ VALIDÉES</th>
        <th style="color:#d97706">⏳ EN ATTENTE</th>
        <th style="color:#ef4444">❌ NON POINTÉES</th>
        <th>PROGRESSION</th>
      </tr></thead>
      <tbody>
        ${data.agentDetail.map(a => {
          const pct = a.productive_pct_today || 0;
          const valMin = a.validated_minutes_today || 0;
          const pendMin = a.pending_minutes_today || 0;
          const color = pct >= 80 ? '#16a34a' : (pct >= 50 ? '#f59e0b' : '#dc2626');
          const badge = pct >= 80 ? 'badge-active' : (pct >= 50 ? 'badge-warning' : 'badge-inactive');
          const label = pct >= 80 ? 'Bon' : (pct >= 50 ? 'Moyen' : 'Faible');
          const valW  = Math.round((valMin / 480) * 100);
          const pendW = Math.round((pendMin / 480) * 100);
          return `<tr>
            <td style="font-weight:600;color:#1e3a5f">${a.agent_name}</td>
            <td><span style="font-weight:700;color:#16a34a">${a.validated_hours_today || a.productive_hours_today || '0h 00m'}</span> <span style="font-size:10px;color:#6b7280">(${a.validated_pct_today || a.productive_pct_today || 0}%)</span></td>
            <td><span style="font-weight:700;color:#d97706">${a.pending_hours_today || '0h 00m'}</span> <span style="font-size:10px;color:#6b7280">(${a.pending_pct_today || 0}%)</span></td>
            <td><span style="font-weight:700;color:#dc2626">${a.non_pointed_hours_today || a.non_productive_hours_today || '0h 00m'}</span> <span style="font-size:10px;color:#6b7280">(${a.non_productive_pct_today || 0}%)</span></td>
            <td style="min-width:130px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;display:flex">
                  <div style="height:100%;width:${valW}%;background:#22c55e" title="Validé"></div>
                  <div style="height:100%;width:${pendW}%;background:#f59e0b" title="En attente"></div>
                </div>
                <span class="badge ${badge}" style="font-size:10px">${label}</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
        ${data.agentDetail.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px">Aucune donnée</td></tr>' : ''}
      </tbody>
    </table>`}
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
  // Supprimer tout modal existant
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'reject-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
  <div style="background:#fff;border-radius:14px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.25);overflow:hidden;animation:fadeIn .2s ease">
    <!-- En-tête rouge -->
    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:18px 20px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center">
          <i class="fas fa-times-circle" style="color:#fff;font-size:18px"></i>
        </div>
        <div>
          <div style="color:#fff;font-size:15px;font-weight:700">Rejeter la session</div>
          <div style="color:rgba(255,255,255,0.75);font-size:11px">Session #${id}</div>
        </div>
      </div>
      <button onclick="document.getElementById('reject-modal').remove()" style="background:rgba(255,255,255,0.2);border:none;border-radius:6px;width:30px;height:30px;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center">&times;</button>
    </div>
    <!-- Corps -->
    <div style="padding:24px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:18px;display:flex;gap:10px;align-items:flex-start">
        <i class="fas fa-exclamation-triangle" style="color:#dc2626;margin-top:2px"></i>
        <div style="font-size:13px;color:#7f1d1d;line-height:1.5">
          Le motif du rejet est <strong>obligatoire</strong>. Il sera visible par l'agent concerné et dans les rapports de l'administrateur.
        </div>
      </div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">
        <i class="fas fa-comment-alt" style="color:#dc2626;margin-right:6px"></i>
        Motif du rejet <span style="color:#ef4444">*</span>
      </label>
      <textarea id="reject-reason" rows="4"
        placeholder="Expliquez clairement la raison du rejet&#10;Ex : Durée incorrecte, la session dépasse 8h&#10;Ex : Tâche non autorisée pour cet agent..."
        style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;resize:vertical;outline:none;font-family:inherit;line-height:1.5;transition:border-color .2s"
        onfocus="this.style.borderColor='#dc2626'"
        onblur="this.style.borderColor='#e5e7eb'"></textarea>
      <div id="reject-err" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;color:#dc2626;font-size:12px;margin-top:8px">
        <i class="fas fa-exclamation-circle mr-1"></i><span id="reject-err-msg"></span>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button onclick="document.getElementById('reject-modal').remove()"
          style="padding:9px 18px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:13px;cursor:pointer;font-weight:500">
          <i class="fas fa-arrow-left" style="margin-right:6px"></i>Annuler
        </button>
        <button id="reject-confirm-btn" onclick="confirmReject(${id}, this)"
          style="padding:9px 18px;border:none;border-radius:8px;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-size:13px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">
          <i class="fas fa-times-circle"></i> Confirmer le rejet
        </button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(() => { const ta = document.getElementById('reject-reason'); if (ta) ta.focus(); }, 150);
}

async function confirmReject(id, btn) {
  const ta    = document.getElementById('reject-reason');
  const errEl = document.getElementById('reject-err');
  const errMsg= document.getElementById('reject-err-msg');
  const reason = ta ? ta.value.trim() : '';

  if (!reason || reason.length < 5) {
    if (errEl)  errEl.style.display = 'flex';
    if (errMsg) errMsg.textContent = 'Le motif est obligatoire (minimum 5 caractères).';
    if (ta)     ta.focus();
    return;
  }
  if (errEl) errEl.style.display = 'none';

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejet en cours...';

  const r = await api('/api/chef/reject/' + id, { method: 'POST', body: JSON.stringify({ reason }) });
  if (r.error) {
    toast(r.error, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-times-circle"></i> Confirmer le rejet';
    return;
  }
  toast('Session rejetée — motif enregistré et visible par l\'admin', 'error');
  const modal = document.getElementById('reject-modal');
  if (modal) modal.remove();
  const row = document.getElementById('row-' + id);
  if (row) {
    row.style.transition = 'opacity 0.3s';
    row.style.opacity = '0';
    setTimeout(() => row.remove(), 300);
  }
}

async function validateAll() {
  if (!confirm('Valider toutes les sessions en attente ?')) return;
  const r = await api('/api/chef/validate-all', { method: 'POST' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Toutes les sessions ont été validées !');
  renderValidation();
}

// ============================================
// RAPPORTS (filtres periode, export CSV, print)
// ============================================
let _chefRptFrom = '', _chefRptTo = '', _chefRptAgent = '', _chefRptStatus = '';

async function renderRapports() {
  renderLayout('Rapports', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const team = await api('/api/chef/team');

  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(); firstDay.setDate(1);
  const firstDayStr = firstDay.toISOString().split('T')[0];
  if (!_chefRptFrom) _chefRptFrom = firstDayStr;
  if (!_chefRptTo)   _chefRptTo   = today;

  const teamOptions = team.map(m => `<option value="${m.id}" ${_chefRptAgent==m.id?'selected':''}>${m.first_name} ${m.last_name}</option>`).join('');
  const statusVal = (v, label) => `<option value="${v}" ${_chefRptStatus===v?'selected':''}>${label}</option>`;

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-chart-bar"></i><h2>Rapports de mon departement</h2></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" onclick="downloadChefCSV()">
        <i class="fas fa-file-csv"></i> Exporter CSV
      </button>
      <button class="btn btn-outline" onclick="printChefReport()">
        <i class="fas fa-print"></i> Imprimer
      </button>
    </div>
  </div>
  <!-- Filtres -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-body" style="padding:14px 20px">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div><label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Du</label>
          <input type="date" id="cr_from" value="${_chefRptFrom}" class="form-control" style="width:140px"></div>
        <div><label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Au</label>
          <input type="date" id="cr_to" value="${_chefRptTo}" class="form-control" style="width:140px"></div>
        <div><label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Agent</label>
          <select id="cr_agent" class="form-control" style="width:180px">
            <option value="">Tous</option>${teamOptions}
          </select></div>
        <div><label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Statut</label>
          <select id="cr_status" class="form-control" style="width:130px">
            <option value="">Tous</option>
            ${statusVal('Valide','Valide')}
            ${statusVal('Termine','Termine')}
            ${statusVal('Rejete','Rejete')}
          </select></div>
        <button class="btn btn-primary" onclick="loadChefReports()" style="height:38px"><i class="fas fa-filter"></i> Filtrer</button>
        <button class="btn btn-outline" onclick="resetChefFilters()" style="height:38px"><i class="fas fa-times"></i> Reinitialiser</button>
      </div>
    </div>
  </div>
  <!-- Graphique tendance + KPI -->
  <div class="grid-2" style="margin-bottom:16px">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-line" style="color:#1e3a5f"></i> Productivite de l equipe par periode</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <select id="trend-period" class="form-control" style="width:120px">
          <option value="7">7 jours</option>
          <option value="30" selected>30 jours</option>
          <option value="60">60 jours</option>
          <option value="90">90 jours</option>
        </select>
        <button class="btn btn-outline" onclick="loadTrendChart()" style="height:34px"><i class="fas fa-sync-alt"></i></button>
      </div>
      <canvas id="chartTrend" height="200"></canvas>
    </div>
    <div class="card" style="margin:0">
      <div class="card-body" style="padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:14px;background:#eff6ff;border-radius:8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#1d4ed8" id="cr-total">0</div>
            <div style="font-size:11px;color:#6b7280">Sessions totales</div>
          </div>
          <div style="padding:14px;background:#f0fdf4;border-radius:8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#16a34a" id="cr-validated">0h</div>
            <div style="font-size:11px;color:#6b7280">Heures validees</div>
          </div>
          <div style="padding:14px;background:#fef3c7;border-radius:8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#d97706" id="cr-total-h">0h</div>
            <div style="font-size:11px;color:#6b7280">Heures totales</div>
          </div>
          <div style="padding:14px;background:#fee2e2;border-radius:8px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#dc2626" id="cr-rejected">0</div>
            <div style="font-size:11px;color:#6b7280">Rejetees</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table id="chef-report-table">
          <thead><tr><th>AGENT</th><th>TACHE</th><th>PROCESSUS</th><th>OBJECTIF</th><th>DATE</th><th>DUREE</th><th>TYPE</th><th>STATUT</th><th>MOTIF REJET</th></tr></thead>
          <tbody id="chef-rpt-tbody"><tr><td colspan="9" style="text-align:center;color:#9ca3af"><i class="fas fa-spinner fa-spin"></i></td></tr></tbody>
        </table>
      </div>
    </div>
  </div>`;

  loadChefReports();
  loadTrendChart();
}

async function loadChefReports() {
  _chefRptFrom   = document.getElementById('cr_from') ? document.getElementById('cr_from').value : _chefRptFrom;
  _chefRptTo     = document.getElementById('cr_to')   ? document.getElementById('cr_to').value   : _chefRptTo;
  _chefRptAgent  = document.getElementById('cr_agent')  ? document.getElementById('cr_agent').value  : '';
  _chefRptStatus = document.getElementById('cr_status') ? document.getElementById('cr_status').value : '';

  let url = '/api/chef/reports?';
  if (_chefRptFrom)   url += 'date_from=' + _chefRptFrom + '&';
  if (_chefRptTo)     url += 'date_to='   + _chefRptTo   + '&';
  if (_chefRptAgent)  url += 'agent_id='  + _chefRptAgent + '&';
  if (_chefRptStatus) url += 'status='    + encodeURIComponent(_chefRptStatus) + '&';

  const data = await api(url);
  window.chefReportsData = { url, data };

  const totalH     = data.reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const validatedH = data.filter(r => r.status === 'Valide').reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const dom = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  dom('cr-total',     data.length);
  dom('cr-validated', minutesToHours(validatedH));
  dom('cr-total-h',   minutesToHours(totalH));
  dom('cr-rejected',  data.filter(r => r.status === 'Rejete').length);

  const tbody = document.getElementById('chef-rpt-tbody');
  if (tbody) tbody.innerHTML = data.length === 0
    ? '<tr><td colspan="9" style="text-align:center;padding:30px;color:#9ca3af">Aucune session pour cette periode</td></tr>'
    : data.map(r => '<tr>' +
      '<td style="font-weight:600;color:#1e3a5f">' + r.agent_name + '</td>' +
      '<td>' + r.task_name + '</td>' +
      '<td>' + r.process_name + '</td>' +
      '<td><span class="badge-obj" style="background:' + r.objective_color + '">' + r.objective_name + '</span></td>' +
      '<td style="font-size:12px;color:#6b7280">' + formatDate(r.start_time) + '</td>' +
      '<td style="font-weight:700">' + minutesToHours(r.duration_minutes || 0) + '</td>' +
      '<td><span class="badge-auto" style="font-size:10px">' + (r.session_type || 'Auto') + '</span></td>' +
      '<td>' + getStatusBadge(r.status) + '</td>' +
      '<td style="font-size:11px;color:#ef4444">' + (r.rejected_reason || '') + '</td>' +
      '</tr>').join('');
}

function resetChefFilters() { _chefRptFrom = ''; _chefRptTo = ''; _chefRptAgent = ''; _chefRptStatus = ''; renderRapports(); }

function downloadChefCSV() {
  const d = window.chefReportsData || {};
  let url = (d.url || '/api/chef/reports?').replace('export=csv&', '');
  if (!url.includes('?')) url += '?';
  url += 'export=csv&';
  fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rapport_dept_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    });
}

function printChefReport() {
  const table = document.getElementById('chef-report-table');
  if (!table) return;
  const win = window.open('', '_blank');
  win.document.write('<html><head><title>Rapport Chef - BGFIBank CA</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{color:#1e3a5f}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e3a5f;color:white;padding:8px;text-align:left;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}</style></head><body><h2>Rapport Departement - BGFIBank CA</h2><p style="color:#6b7280">Periode : ' + (_chefRptFrom || '-') + ' au ' + (_chefRptTo || '-') + ' | Genere le ' + new Date().toLocaleDateString('fr-FR') + '</p>' + table.outerHTML + '</body></html>');
  win.document.close();
  setTimeout(() => win.print(), 500);
}

async function loadTrendChart() {
  const period = document.getElementById('trend-period') ? document.getElementById('trend-period').value : '30';
  const trendData = await api('/api/chef/productivity-trend?period=' + period);
  if (!trendData.dates || trendData.dates.length === 0) return;

  if (chefCharts.trend) { try { chefCharts.trend.destroy(); } catch(e){} }

  const colors = ['#1e3a5f','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
  const datasets = trendData.agents.map(function(agent, i) {
    return {
      label: agent.split(' ')[1] || agent,
      data: trendData.dates.map(function(d) { return ((trendData.pivot[agent] || {})[d] || 0) / 60; }),
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '20',
      tension: 0.3,
      fill: false,
      pointRadius: 3
    };
  });

  const canvas = document.getElementById('chartTrend');
  if (!canvas) return;
  chefCharts.trend = new Chart(canvas, {
    type: 'line',
    data: { labels: trendData.dates, datasets: datasets },
    options: {
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxTicksLimit: 12 } },
        y: { ticks: { callback: function(v) { return v.toFixed(1) + 'h'; } } }
      }
    }
  });
}

function getStatusBadge(status) {
  const cls = { 'Valide': 'status-valide', 'Termine': 'status-termine', 'Rejete': 'status-rejete', 'En cours': 'status-en-cours' };
  // Normalize accents for class lookup
  const key = (status || '').replace(/é/g,'e').replace(/è/g,'e').replace(/à/g,'a');
  const icon = status === 'Validé' ? '✓ ' : status === 'Terminé' ? '✓ ' : status === 'Rejeté' ? '✗ ' : '';
  const sc = { 'Validé': 'status-valide', 'Terminé': 'status-termine', 'Rejeté': 'status-rejete', 'En cours': 'status-en-cours' };
  return '<span class="status-badge ' + (sc[status]||'status-en-cours') + '">' + icon + status + '</span>';
}

function exportCSV(data, name) {
  if (!data || !data.length) { toast('Aucune donnee', 'error'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(r => Object.values(r).map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}

// Removed - replaced above

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
startChefNotifPolling();
