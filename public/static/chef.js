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
// TODAY LIVE — Statut temps réel agents
// ============================================
async function refreshLive() {
  const grid = document.getElementById('live-agents-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

  const data = await api('/api/chef/live');
  if (!data || data.error) {
    grid.innerHTML = '<div style="color:#ef4444;padding:16px">Erreur de chargement</div>';
    return;
  }

  // Résumé
  const wEl = document.getElementById('live-working');
  const pEl = document.getElementById('live-paused');
  const nEl = document.getElementById('live-not-started');
  if (wEl) wEl.textContent = data.summary.working_now;
  if (pEl) pEl.textContent = data.summary.paused;
  if (nEl) nEl.textContent = data.summary.not_started;

  if (data.is_weekend) {
    grid.innerHTML = `<div style="text-align:center;padding:24px;color:#92400e;background:#fef9c3;border-radius:10px;grid-column:1/-1">
      <i class="fas fa-moon" style="font-size:28px;margin-bottom:8px;display:block"></i>
      <div style="font-weight:700">Week-end — Pas de journée attendue</div>
    </div>`;
    return;
  }

  grid.innerHTML = data.agents.map(a => {
    const statusConfig = {
      working:     { bg: '#dcfce7', border: '#16a34a', icon: 'fa-play-circle', iconColor: '#16a34a', label: 'En cours', labelColor: '#16a34a' },
      paused:      { bg: '#fef9c3', border: '#ca8a04', icon: 'fa-pause-circle', iconColor: '#ca8a04', label: 'En pause',  labelColor: '#ca8a04' },
      not_started: { bg: '#fee2e2', border: '#dc2626', icon: 'fa-times-circle', iconColor: '#dc2626', label: 'Pas pointé', labelColor: '#dc2626' },
      weekend:     { bg: '#f3f4f6', border: '#d1d5db', icon: 'fa-moon',        iconColor: '#9ca3af', label: 'Week-end',  labelColor: '#9ca3af' }
    };
    const s = statusConfig[a.live_status] || statusConfig.not_started;
    const pct = a.productive_pct || 0;
    const pctColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626';
    const taskInfo = a.is_active_now && a.current_task
      ? `<div style="font-size:10px;color:#1e3a5f;background:#eff6ff;padding:3px 8px;border-radius:4px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${a.current_task}"><i class="fas fa-tasks"></i> ${a.current_task}</div>`
      : '';
    return `
    <div style="background:${s.bg};border:1.5px solid ${s.border};border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:700;font-size:13px;color:#1e3a5f">${a.agent_name}</span>
        <span style="color:${s.labelColor};font-size:11px;font-weight:600"><i class="fas ${s.icon}" style="color:${s.iconColor}"></i> ${s.label}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:6px">
        <span>✅ ${a.total_pointed_hours}</span>
        <span style="font-weight:700;color:${pctColor}">${pct}%</span>
        <span>${a.sessions_done_today} session(s)</span>
      </div>
      <div style="height:6px;background:#e5e7eb;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pctColor};transition:width .5s"></div>
      </div>
      ${taskInfo}
    </div>`;
  }).join('');
}

// Auto-refresh live toutes les 60 secondes si la carte est visible
let liveRefreshInterval = null;
function startLiveRefresh() {
  if (liveRefreshInterval) clearInterval(liveRefreshInterval);
  refreshLive();
  liveRefreshInterval = setInterval(() => {
    if (document.getElementById('live-agents-grid')) refreshLive();
    else { clearInterval(liveRefreshInterval); liveRefreshInterval = null; }
  }, 60000);
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
let chefMonth1 = new Date().toISOString().slice(0,7);
let chefMonth2 = '';
let chefBarMode = 'mensuel'; // 'mensuel' ou 'cumul'
let chefLastData = null;     // cache pour le toggle sans re-fetch

async function renderDashboard() {
  renderLayout('Tableau de bord équipe', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  await loadChefDashboard();
}

async function loadChefDashboard() {
  const m2p = chefMonth2 ? `&month2=${chefMonth2}` : '';
  const data = await api(`/api/chef/dashboard?month=${chefMonth1}${m2p}`);
  chefLastData = data; // cache pour le toggle
  const today = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  document.getElementById('content').innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px">
      <i class="fas fa-check-circle" style="color:#22c55e;font-size:18px"></i>
      <h2 style="font-size:20px;font-weight:700;color:#1e3a5f">Vue d'ensemble de mon équipe</h2>
    </div>
    <span style="font-size:13px;color:#6b7280">${today}</span>
  </div>

  <!-- Filtre période -->
  <div class="chart-card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <i class="fas fa-calendar-alt" style="color:#1e3a5f"></i>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 1</label>
        <input type="month" id="chefFilterM1" value="${chefMonth1}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#1e3a5f;outline:none">
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 2</label>
        <input type="month" id="chefFilterM2" value="${chefMonth2}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#6b7280;outline:none">
        <button onclick="document.getElementById('chefFilterM2').value='';chefMonth2='';loadChefDashboard()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px" title="Effacer">✕</button>
      </div>
      <button onclick="chefMonth1=document.getElementById('chefFilterM1').value;chefMonth2=document.getElementById('chefFilterM2').value;loadChefDashboard()"
        style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:13px;font-weight:600;cursor:pointer">
        <i class="fas fa-search" style="margin-right:6px"></i>Appliquer
      </button>
      ${data.month2 ? `<span style="background:#eff6ff;color:#1e3a5f;font-size:12px;padding:4px 10px;border-radius:6px;font-weight:600"><i class="fas fa-code-branch" style="margin-right:4px"></i>${data.month||chefMonth1} vs ${data.month2}</span>` : `<span style="color:#9ca3af;font-size:12px">Période : <b>${data.month||chefMonth1}</b></span>`}
    </div>
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
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:12px;height:12px;border-radius:2px;background:${o.color};display:inline-block"></span>
              <span style="font-size:12px;color:#555">${o.name}</span>
            </div>
            <div style="text-align:right">
              <span style="font-size:14px;font-weight:800;color:${o.color}">${o.percentage}%</span>
              <span style="font-size:11px;color:#6b7280;margin-left:4px">${o.hours_display}</span>
            </div>
          </div>`).join('')}
        </div>
      </div>` : `<div style="text-align:center;padding:40px;color:#9ca3af">Aucune donnée</div>`}
    </div>
  </div>

  <!-- ══ TODAY LIVE : statut temps réel ══ -->
  <div class="chart-card" style="margin-bottom:16px" id="live-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div class="chart-title" style="margin:0"><i class="fas fa-satellite-dish" style="color:#16a34a"></i> Statut Live — Aujourd'hui <span style="font-size:11px;background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:10px;margin-left:6px"><i class="fas fa-circle" style="font-size:8px"></i> Temps réel</span></div>
      <button onclick="refreshLive()" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;color:#6b7280"><i class="fas fa-sync-alt"></i> Actualiser</button>
    </div>
    <div id="live-summary" style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px;background:#dcfce7;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#16a34a" id="live-working">—</div>
        <div style="font-size:11px;color:#6b7280">🟢 En train de bosser</div>
      </div>
      <div style="flex:1;min-width:100px;background:#fef9c3;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#ca8a04" id="live-paused">—</div>
        <div style="font-size:11px;color:#6b7280">🟡 A pointé / Pause</div>
      </div>
      <div style="flex:1;min-width:100px;background:#fee2e2;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#dc2626" id="live-not-started">—</div>
        <div style="font-size:11px;color:#6b7280">🔴 Pas encore pointé</div>
      </div>
    </div>
    <div id="live-agents-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      <div style="text-align:center;padding:20px;color:#9ca3af"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
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

  <!-- Détail par Agent — Ce mois (avec ratios 3-3-3) -->
  <div class="chart-card">
    <div class="chart-title"><i class="fas fa-list" style="color:#1e3a5f"></i> Détail par Agent — Ce mois
      <span style="font-size:11px;font-weight:400;color:#6b7280;margin-left:8px">Capacité = jours ouvrés × 8h/agent</span>
    </div>
    <div class="table-wrapper">
      <table style="font-size:12px">
        <thead><tr>
          <th>AGENT</th>
          <th style="text-align:center">SESSIONS</th>
          <th style="text-align:center;color:#1e3a5f">🔵 PRODUCTION</th>
          <th style="text-align:center;color:#f59e0b">🟡 ADMIN & REPORTING</th>
          <th style="text-align:center;color:#10b981">🟢 CONTRÔLE</th>
          <th style="text-align:center;color:#ef4444">🔴 NON POINTÉ</th>
          <th style="text-align:center">CAPACITÉ</th>
          <th style="text-align:center">% PRODUCTIF</th>
        </tr></thead>
        <tbody>
          ${(data.agentComparison || []).map(a => {
            const cap = a.capacity_minutes || 480;
            const prod = a.Production || 0;
            const admin = a['Administration & Reporting'] || 0;
            const ctrl = a['Contrôle'] || 0;
            const total = a.total_minutes || 0;
            const np = Math.max(0, cap - total);
            const pct = cap > 0 ? Math.round(total * 100 / cap) : 0;
            const npPct = Math.max(0, 100 - pct);
            const col = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626';
            const prodPct = total > 0 ? Math.round(prod * 100 / total) : 0;
            const adminPct = total > 0 ? Math.round(admin * 100 / total) : 0;
            const ctrlPct = total > 0 ? Math.round(ctrl * 100 / total) : 0;
            return `<tr>
              <td style="font-weight:600;color:#1e3a5f">${a.agent_name}</td>
              <td style="text-align:center">${(data.agentDetail||[]).find(x=>x.agent_name===a.agent_name)?.total_sessions||'—'}</td>
              <td style="text-align:center">
                <span style="font-weight:700;color:#1e3a5f">${minutesToHours(prod)}</span>
                <div style="font-size:10px;color:#9ca3af">${prodPct}% du pointé</div>
              </td>
              <td style="text-align:center">
                <span style="font-weight:700;color:#f59e0b">${minutesToHours(admin)}</span>
                <div style="font-size:10px;color:#9ca3af">${adminPct}% du pointé</div>
              </td>
              <td style="text-align:center">
                <span style="font-weight:700;color:#10b981">${minutesToHours(ctrl)}</span>
                <div style="font-size:10px;color:#9ca3af">${ctrlPct}% du pointé</div>
              </td>
              <td style="text-align:center">
                <span style="font-weight:700;color:#ef4444">${minutesToHours(np)}</span>
                <div style="font-size:10px;color:#9ca3af">${npPct}% cap.</div>
              </td>
              <td style="text-align:center;color:#6b7280">${minutesToHours(cap)}</td>
              <td style="text-align:center">
                <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                  <div style="width:60px;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;display:flex">
                    <div style="height:100%;width:${pct}%;background:${col}"></div>
                  </div>
                  <span style="font-size:12px;font-weight:800;color:${col}">${pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
          ${!(data.agentComparison||[]).length ? '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:20px">Aucune donnée</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ══ BANDEAU ALERTES 3-3-3 DÉPARTEMENT ══ -->
  ${(() => {
    const CIBLES = { 'Production': 70, 'Administration & Reporting': 20, 'Contrôle': 10 };
    const r = data.ratio333 || [];
    const alerts = r.filter(x => {
      const tgt = CIBLES[x.type] || 0;
      return Math.abs(x.percentage - tgt) > 5;
    });
    if (!alerts.length) return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <i class="fas fa-check-circle" style="color:#16a34a;font-size:18px"></i>
      <span style="color:#15803d;font-size:13px;font-weight:600">Méthode 3-3-3 : toutes les catégories de votre département sont dans les cibles ce mois-ci.</span>
    </div>`;
    return `<div style="background:#fff;border-radius:10px;padding:12px 18px;margin-bottom:16px;border-left:4px solid #ef4444;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:16px"></i>
        <span style="font-weight:700;color:#1e3a5f;font-size:14px">Alertes 3-3-3 — ${alerts.length} catégorie(s) hors cible</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${alerts.map(x => {
          const tgt = CIBLES[x.type] || 0;
          const ecart = x.percentage - tgt;
          const over = ecart > 0;
          const severe = Math.abs(ecart) > 10;
          const bg = severe ? (over ? '#fee2e2' : '#fef9c3') : (over ? '#fff7ed' : '#fffbeb');
          const col = severe ? (over ? '#dc2626' : '#b45309') : '#d97706';
          const color = x.type==='Production'?'#1e3a5f':x.type==='Administration & Reporting'?'#f59e0b':'#10b981';
          return `<div style="background:${bg};border-radius:8px;padding:6px 14px;display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
            <span style="font-weight:600;color:#1e3a5f;font-size:13px">${x.type}</span>
            <span style="color:${col};font-size:12px;font-weight:700"><i class="fas fa-arrow-${over?'up':'down'}"></i> ${over?'+':''}${ecart}% vs cible ${tgt}%</span>
            ${severe ? `<span style="font-size:10px;background:${col};color:#fff;padding:1px 6px;border-radius:4px;font-weight:700">⚠ CRITIQUE</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  })()}

  <!-- Méthode 3-3-3 — Ratio d'Efficience du Département -->
  <div class="chart-card" style="margin-bottom:20px">
    <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Méthode 3-3-3 — Efficience du Département${data.month2?` <span style="font-size:12px;font-weight:400;color:#6b7280">(${data.month||chefMonth1} vs ${data.month2})</span>`:''}</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;margin-top:10px">
      <div style="text-align:center">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${data.month||chefMonth1}</div>
        <canvas id="chart333ChefM1" width="160" height="160"></canvas>
      </div>
      ${data.month2 ? `<div style="text-align:center">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${data.month2}</div>
        <canvas id="chart333ChefM2" width="160" height="160"></canvas>
      </div>` : ''}
      <div style="flex:1;min-width:180px">
        ${(data.ratio333||[]).map(r => {
          const color = r.type==='Production'?'#1e3a5f':r.type==='Administration & Reporting'?'#f59e0b':'#10b981';
          const pct2 = data.month2&&data.ratio333Month2 ? (data.ratio333Month2.find(x=>x.type===r.type)?.percentage||0) : null;
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span style="width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0"></span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:12px;color:#374151">${r.type}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                <div style="flex:1;background:#e5e7eb;border-radius:4px;height:7px"><div style="width:${r.percentage}%;background:${color};height:7px;border-radius:4px"></div></div>
                <span style="font-weight:700;color:${color};font-size:13px;width:36px">${r.percentage}%</span>
                <span style="color:#6b7280;font-size:11px">${r.hours_display}</span>
                ${pct2!==null?`<span style="color:#9ca3af;font-size:11px">→ ${pct2}% M2</span>`:''}
              </div>
            </div>
          </div>`;
        }).join('')}
        <div style="margin-top:12px;padding:8px 12px;background:#eff6ff;border-radius:8px;border-left:4px solid #1e3a5f">
          <div style="font-size:11px;color:#1e3a5f;font-weight:600">Efficience Production</div>
          <div style="font-size:20px;font-weight:800;color:#1e3a5f">
            ${(data.ratio333||[]).find(r=>r.type==='Production')?.percentage||0}%
            ${data.month2&&data.ratio333Month2 ? `<span style="font-size:12px;font-weight:400;color:#6b7280"> → ${(data.ratio333Month2||[]).find(r=>r.type==='Production')?.percentage||0}%</span>` : ''}
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Objectif : ≥ 70% en Production</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toggle vue mensuelle / cumulative -->
  <div id="chef-bar-toggle-wrap" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
    <span style="font-size:13px;font-weight:600;color:#374151"><i class="fas fa-layer-group" style="margin-right:6px;color:#1e3a5f"></i>Vue des barres :</span>
    <button id="chef-btn-mensuel" onclick="chefSetBarMode('mensuel')"
      style="padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid #1e3a5f;background:#1e3a5f;color:#fff">
      <i class="fas fa-calendar-day" style="margin-right:5px"></i>Mensuel
    </button>
    <button id="chef-btn-cumul" onclick="chefSetBarMode('cumul')"
      style="padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid #1e3a5f;background:#fff;color:#1e3a5f">
      <i class="fas fa-layer-group" style="margin-right:5px"></i>Cumulatif <span id="chef-cumul-nb-months">${(data.cumulMonths||[]).length||6}</span> mois
    </button>
    <span id="chef-cumul-info" style="font-size:11px;color:#6b7280;display:none">
      <i class="fas fa-info-circle" style="margin-right:4px"></i>Données cumulées sur <b>${(data.cumulMonths||[]).length||6}</b> mois
    </span>
  </div>

  <!-- Barres comparatives par Agent (3-3-3) -->
  <div class="chart-card">
    <div class="chart-title">
      <i class="fas fa-users" style="color:#1e3a5f"></i> Comparaison par Agent — Temps Reporting vs Production
      <span id="chef-agent-mode-label" style="font-size:11px;font-weight:400;color:#6b7280;margin-left:8px"></span>
    </div>
    <canvas id="chartAgentBar333" height="${Math.max(160,(data.agentComparison||data.hoursByAgent||[]).length*(data.month2?42:30))}"></canvas>
  </div>`;

  destroyCharts();
  // Démarrer le rafraîchissement live après le rendu
  startLiveRefresh();

  if (data.hoursByAgent && data.hoursByAgent.length > 0 && document.getElementById('chartAgents')) {
    chefCharts.agents = new Chart(document.getElementById('chartAgents'), {
      type: 'bar',
      data: {
        labels: data.hoursByAgent.map(a => a.agent_name.split(' ')[1] || a.agent_name),
        datasets: [{ data: data.hoursByAgent.map(a => (a.total_minutes / 60).toFixed(2)), backgroundColor: '#1e3a5f' }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const a = data.hoursByAgent[ctx.dataIndex];
                const totalTeam = data.hoursByAgent.reduce((s, x) => s + (x.total_minutes||0), 0);
                const pct = totalTeam > 0 ? Math.round((a.total_minutes||0)*100/totalTeam) : 0;
                return ` ${a.agent_name} : ${(a.total_minutes/60).toFixed(1)}h (${pct}% équipe)`;
              }
            }
          }
        },
        scales: { y: { ticks: { callback: v => v + 'h' } } }
      }
    });
  }

  if (data.byObjective && data.byObjective.length > 0 && document.getElementById('chartObj')) {
    chefCharts.obj = new Chart(document.getElementById('chartObj'), {
      type: 'doughnut',
      data: {
        labels: data.byObjective.map(o => o.name),
        datasets: [{ data: data.byObjective.map(o => o.total_minutes), backgroundColor: data.byObjective.map(o => o.color), borderWidth: 2 }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const o = data.byObjective[ctx.dataIndex];
                return ` ${o.name} : ${o.percentage}% (${o.hours_display})`;
              }
            }
          }
        },
        cutout: '55%'
      }
    });
  }

  // Pie 3-3-3 Mois 1
  if (data.ratio333 && data.ratio333.length > 0 && document.getElementById('chart333ChefM1')) {
    chefCharts.p333M1 = new Chart(document.getElementById('chart333ChefM1'), {
      type: 'pie',
      data: { labels: data.ratio333.map(r=>r.type), datasets: [{ data: data.ratio333.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const r=data.ratio333[ctx.dataIndex]; return ` ${r.hours_display} (${r.percentage}%)`; } } } } }
    });
  }

  // Pie 3-3-3 Mois 2
  if (data.ratio333Month2 && data.ratio333Month2.length > 0 && document.getElementById('chart333ChefM2')) {
    chefCharts.p333M2 = new Chart(document.getElementById('chart333ChefM2'), {
      type: 'pie',
      data: { labels: data.ratio333Month2.map(r=>r.type), datasets: [{ data: data.ratio333Month2.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const r=data.ratio333Month2[ctx.dataIndex]; return ` ${r.hours_display} (${r.percentage}%)`; } } } } }
    });
  }

  // Mettre à jour le toggle UI puis rendre les barres
  chefUpdateToggleUI();
  renderChefAgentBar(data, chefBarMode);
}

// ── Toggle mode chef ──────────────────────────────────────────────────────────
function chefSetBarMode(mode) {
  chefBarMode = mode;
  chefUpdateToggleUI();
  if (chefLastData) renderChefAgentBar(chefLastData, mode);
}

function chefUpdateToggleUI() {
  const btnM = document.getElementById('chef-btn-mensuel');
  const btnC = document.getElementById('chef-btn-cumul');
  const info = document.getElementById('chef-cumul-info');
  if (btnM) { btnM.style.background = chefBarMode==='mensuel'?'#1e3a5f':'#fff'; btnM.style.color = chefBarMode==='mensuel'?'#fff':'#1e3a5f'; }
  if (btnC) { btnC.style.background = chefBarMode==='cumul'?'#1e3a5f':'#fff'; btnC.style.color = chefBarMode==='cumul'?'#fff':'#1e3a5f'; }
  if (info) info.style.display = chefBarMode==='cumul' ? 'inline' : 'none';
}

function renderChefAgentBar(data, mode) {
  // Détruire seulement la barre agent
  if (chefCharts.agentBar) { try { chefCharts.agentBar.destroy(); } catch(e){} delete chefCharts.agentBar; }

  const isCumul = mode === 'cumul';
  const cumulNb = (data.cumulMonths||[]).length || 6;
  const modeLabel = isCumul ? `(${cumulNb} mois cumulés)` : (data.month2 ? `(${data.month||chefMonth1} vs ${data.month2})` : `(${data.month||chefMonth1})`);
  const capLabel  = isCumul ? 'cap. cumulée' : 'cap. mensuelle';

  const lbl = document.getElementById('chef-agent-mode-label');
  if (lbl) lbl.textContent = modeLabel;

  let agComp, agCompM2;
  if (isCumul) {
    agComp  = data.cumulAgentComparison || data.agentComparison || [];
    agCompM2 = [];
  } else {
    agComp  = data.agentComparison || data.hoursByAgent || [];
    agCompM2 = data.agentComparisonMonth2 || [];
  }

  if (agComp.length > 0 && document.getElementById('chartAgentBar333')) {
    const mkDs = (src, suffix, stackSuffix) => [
      { label:'Production'+suffix, data:src.map(a=>+((a.Production||a.total_minutes||0)/60).toFixed(2)), backgroundColor:'#1e3a5f', stack:'sa'+stackSuffix, _cap:src.map(a=>(a.capacity_minutes||480)/60) },
      { label:'Admin & Reporting'+suffix, data:src.map(a=>+((a['Administration & Reporting']||0)/60).toFixed(2)), backgroundColor:'#f59e0b', stack:'sa'+stackSuffix, _cap:src.map(a=>(a.capacity_minutes||480)/60) },
      { label:'Contrôle'+suffix, data:src.map(a=>+((a['Contrôle']||0)/60).toFixed(2)), backgroundColor:'#10b981', stack:'sa'+stackSuffix, _cap:src.map(a=>(a.capacity_minutes||480)/60) },
      { label:'Non productif'+suffix, data:src.map(a=>{ const c=(a.capacity_minutes||480)/60; return +(Math.max(0,c-(a.total_minutes||0)/60).toFixed(2)); }), backgroundColor:'#ef4444cc', stack:'sa'+stackSuffix, _cap:src.map(a=>(a.capacity_minutes||480)/60) }
    ];
    const ds = mkDs(agComp, isCumul ? '' : (data.month2?' ('+data.month+')':''), 'M1');
    if (!isCumul && agCompM2.length) ds.push(...mkDs(agCompM2, ' ('+data.month2+')', 'M2'));
    chefCharts.agentBar = new Chart(document.getElementById('chartAgentBar333'), {
      type: 'bar',
      data: { labels: agComp.map(a => a.agent_name), datasets: ds },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: {
          legend: { position:'bottom', labels:{ font:{size:11}, boxWidth:12 } },
          tooltip: { callbacks: { label: ctx => {
            const val = ctx.raw;
            const cap = ctx.dataset._cap ? ctx.dataset._cap[ctx.dataIndex] : 8;
            const pct = cap > 0 ? Math.round(val/cap*100) : 0;
            const h = Math.floor(val), m = Math.round((val-h)*60);
            const cH = Math.floor(cap), cM = Math.round((cap-cH)*60);
            return ` ${ctx.dataset.label} : ${h}h ${String(m).padStart(2,'0')}m — ${pct}% ${capLabel} (${cH}h${cM>0?String(cM).padStart(2,'0')+'m':''})`;
          }}}
        },
        scales: { x:{ stacked:true, ticks:{callback:v=>v+'h'}, grid:{color:'#f3f4f6'} }, y:{ stacked:true, ticks:{font:{size:11}} } }
      }
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
  if (!data || !data.length) { toast('Aucune donnée à exporter', 'error'); return; }

  // Normalisation catégorie 3-3-3
  const normalize333 = t => {
    if (!t) return 'Production';
    if (t === 'Production' || t === 'Productive') return 'Production';
    if (t === 'Administration & Reporting' || t === 'Non productive') return 'Administration & Reporting';
    if (t === 'Contrôle') return 'Contrôle';
    return 'Production';
  };
  const hhmm = min => { const h = Math.floor(min/60), m = min%60; return `${h}h ${String(m).padStart(2,'0')}m`; };
  const pct = (n, d) => d > 0 ? (n/d*100).toFixed(1)+'%' : '0%';

  // Enrichissement : colonnes calculées + % productivité par agent/mois
  let enriched = data;
  if (name === 'rapports' || name === 'sessions') {
    // 1ère passe : agréger par agent+mois pour calculer les % (sessions validées uniquement)
    const agentMonthMap = {};
    data.forEach(r => {
      if (r.status !== 'Validé') return;
      const key = `${r.agent_name}|${(r.start_time||'').slice(0,7)}`;
      if (!agentMonthMap[key]) agentMonthMap[key] = { prod:0, admin:0, ctrl:0, total:0 };
      const cat = normalize333(r.session_type || r.task_type);
      const dur = r.duration_minutes || 0;
      agentMonthMap[key].total += dur;
      if (cat === 'Production') agentMonthMap[key].prod += dur;
      else if (cat === 'Administration & Reporting') agentMonthMap[key].admin += dur;
      else if (cat === 'Contrôle') agentMonthMap[key].ctrl += dur;
    });

    // 2ème passe : enrichir chaque ligne
    enriched = data.map(r => {
      const dur = r.duration_minutes || 0;
      const cat = normalize333(r.session_type || r.task_type);
      const mois = (r.start_time || '').slice(0, 7);
      const journee = (r.start_time || '').slice(0, 10);
      const key = `${r.agent_name}|${mois}`;
      const am = agentMonthMap[key] || { prod:0, admin:0, ctrl:0, total:0 };
      const np = Math.max(0, am.total - am.prod - am.admin - am.ctrl);
      return {
        ...r,
        heures_decimales: (dur / 60).toFixed(2),
        heures_affichage: hhmm(dur),
        categorie_333: cat,
        mois,
        journee,
        pct_productif_mois: pct(am.prod, am.total),
        pct_admin_reporting_mois: pct(am.admin, am.total),
        pct_controle_mois: pct(am.ctrl, am.total),
        pct_non_productif_mois: pct(np, am.total),
        temps_reporting_mois: hhmm(am.admin + am.ctrl)
      };
    });
  }

  // Labels lisibles
  const labelMap = {
    agent_name: 'Agent', department_name: 'Département', task_name: 'Tâche',
    process_name: 'Processus', objective_name: 'Objectif',
    duration_minutes: 'Durée (min)', start_time: 'Début', end_time: 'Fin',
    status: 'Statut', session_type: 'Type', comment: 'Commentaire',
    heures_decimales: 'Heures (décimal)', heures_affichage: 'Heures (hh:mm)',
    categorie_333: 'Catégorie 3-3-3', mois: 'Mois', journee: 'Journée',
    pct_productif_mois: '% Productif (mois)', pct_admin_reporting_mois: '% Admin-Reporting (mois)',
    pct_controle_mois: '% Contrôle (mois)', pct_non_productif_mois: '% Non productif (mois)',
    temps_reporting_mois: 'Temps Reporting (mois)'
  };
  const headers = Object.keys(enriched[0]).map(k => labelMap[k] || k);
  const rows = enriched.map(r => Object.values(r).map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','));
  // BOM UTF-8 pour Excel
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
