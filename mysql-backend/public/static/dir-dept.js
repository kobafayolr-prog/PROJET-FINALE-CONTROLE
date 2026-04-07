// ============================================
// TimeTrack BGFIBank - Directeur de Département
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let ddCharts = {};

// Auth check
if (!token || currentUser.role !== 'Directeur de Département') {
  window.location = '/login';
}

async function checkAuth() {
  const r = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) { logout(); }
}
checkAuth();

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
  t.innerHTML = `<i class="fas fa-${type==='error'?'exclamation-circle':'check-circle'}" style="margin-right:6px"></i>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location = '/login';
}

function minutesToDisplay(m) {
  const h = Math.floor(m / 60), mn = m % 60;
  return `${h}h ${mn.toString().padStart(2,'0')}m`;
}

function destroyCharts() {
  Object.values(ddCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  ddCharts = {};
}

// ============================================
// LAYOUT
// ============================================
function renderLayout(page, content) {
  const navItems = [
    { id: 'dashboard', icon: 'tachometer-alt', label: 'Vue d\'ensemble' },
    { id: 'equipe', icon: 'users', label: 'Mon Équipe' },
    { id: 'sessions', icon: 'list', label: 'Activité' },
    { id: 'objectifs', icon: 'bullseye', label: 'Objectifs' }
  ];
  document.getElementById('app').innerHTML = `
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <img src="/static/bgfibank-logo.png" alt="BGFIBank" style="height:36px;margin-right:10px">
        <div>
          <div style="font-weight:700;font-size:13px;color:#1e3a5f">TimeTrack</div>
          <div style="font-size:10px;color:#64748b">Direction</div>
        </div>
      </div>
      <ul class="nav-list">
        ${navItems.map(n => `
        <li class="nav-item ${page===n.id?'active':''}" onclick="navigate('${n.id}')">
          <i class="fas fa-${n.icon} nav-icon"></i>${n.label}
        </li>`).join('')}
      </ul>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${(currentUser.first_name||'?')[0]}${(currentUser.last_name||'?')[0]}</div>
          <div>
            <div style="font-weight:600;font-size:12px;color:white">${currentUser.first_name} ${currentUser.last_name}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5)">Directeur de Département</div>
          </div>
        </div>
        <button class="btn-logout" onclick="logout()" title="Déconnexion"><i class="fas fa-sign-out-alt"></i></button>
      </div>
    </nav>
    <main class="main-content">
      <div id="content">${content}</div>
    </main>
  </div>`;
}

function navigate(page) {
  destroyCharts();
  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'equipe': renderEquipe(); break;
    case 'sessions': renderSessions(); break;
    case 'objectifs': renderObjectifs(); break;
    default: renderDashboard();
  }
}

// ============================================
// DASHBOARD
// ============================================
async function renderDashboard() {
  renderLayout('dashboard', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dir-dept/dashboard');
  renderLayout('dashboard', `
  <div class="page-header">
    <div>
      <h2 class="page-title"><i class="fas fa-building" style="color:#1e3a5f;margin-right:10px"></i>${data.department_name || 'Mon Département'}</h2>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Vue en lecture seule — Directeur de Département</div>
    </div>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#dbeafe;color:#1e40af"><i class="fas fa-users"></i></div>
      <div><div class="kpi-value">${data.active_agents||0}</div><div class="kpi-label">Agents actifs aujourd'hui</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#dcfce7;color:#16a34a"><i class="fas fa-clock"></i></div>
      <div><div class="kpi-value">${data.total_hours||'0h 00m'}</div><div class="kpi-label">Heures validées ce mois</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#fef3c7;color:#b45309"><i class="fas fa-hourglass-half"></i></div>
      <div><div class="kpi-value">${data.to_validate||0}</div><div class="kpi-label">Sessions en attente de validation</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><i class="fas fa-bullseye"></i></div>
      <div><div class="kpi-value">${data.byObjective ? data.byObjective.length : 0}</div><div class="kpi-label">Objectifs actifs</div></div>
    </div>
  </div>
  <div class="charts-grid">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f;margin-right:8px"></i>Objectifs — Cibles vs Réalisé</div>
      ${data.byObjective && data.byObjective.length > 0 ? `
      <table class="data-table">
        <thead><tr><th>Objectif</th><th>Heures</th><th>% Réalisé</th><th>% Cible</th><th>Écart</th></tr></thead>
        <tbody>
          ${data.byObjective.map(o => {
            const ecart = o.percentage - (o.target_percentage||0);
            const ecartClass = ecart >= 0 ? 'color:#16a34a' : 'color:#dc2626';
            return `<tr>
              <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color||'#1e3a5f'};margin-right:6px"></span>${o.name}</td>
              <td>${o.hours_display}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:60px;background:#e5e7eb;border-radius:4px;height:6px">
                    <div style="width:${Math.min(o.percentage,100)}%;background:${o.color||'#1e3a5f'};height:6px;border-radius:4px"></div>
                  </div>
                  ${o.percentage}%
                </div>
              </td>
              <td>${o.target_percentage||0}%</td>
              <td style="${ecartClass};font-weight:600">${ecart>=0?'+':''}${Math.round(ecart)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <canvas id="ddChartObj" height="180" style="margin-top:20px"></canvas>` : '<p class="empty-state">Aucune donnée disponible pour ce mois.</p>'}
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-users" style="color:#1e3a5f;margin-right:8px"></i>Performances de l'équipe</div>
      ${data.agentPerf && data.agentPerf.length > 0 ? `
      <canvas id="ddChartAgents" height="250"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
    </div>
  </div>`);
  // Charts
  if (data.byObjective && data.byObjective.length > 0) {
    const ctx = document.getElementById('ddChartObj');
    if (ctx) {
      ddCharts.obj = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.byObjective.map(o => o.name),
          datasets: [
            { label: '% Réalisé', data: data.byObjective.map(o => o.percentage), backgroundColor: data.byObjective.map(o => o.color||'#1e3a5f') },
            { label: '% Cible', data: data.byObjective.map(o => o.target_percentage||0), backgroundColor: 'rgba(245,158,11,0.3)', borderColor: '#f59e0b', borderWidth: 2, type: 'line', fill: false }
          ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }
  }
  if (data.agentPerf && data.agentPerf.length > 0) {
    const ctx2 = document.getElementById('ddChartAgents');
    if (ctx2) {
      ddCharts.agents = new Chart(ctx2, {
        type: 'horizontalBar',
        data: {
          labels: data.agentPerf.map(a => a.name),
          datasets: [{ label: 'Heures travaillées', data: data.agentPerf.map(a => Math.round(a.total_minutes/60*10)/10), backgroundColor: '#1e3a5f' }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
      });
    }
  }
}

// ============================================
// ÉQUIPE
// ============================================
async function renderEquipe() {
  renderLayout('equipe', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dir-dept/dashboard');
  renderLayout('equipe', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-users" style="color:#1e3a5f;margin-right:10px"></i>Mon Équipe</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  <div class="card">
    ${data.agentPerf && data.agentPerf.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Membre</th><th>Rôle</th><th>Sessions</th><th>Heures totales</th><th>Heures validées</th><th>% Validé</th></tr></thead>
      <tbody>
        ${data.agentPerf.map(a => {
          const pct = a.total_minutes > 0 ? Math.round(a.validated_minutes * 100 / a.total_minutes) : 0;
          const totalH = Math.round(a.total_minutes/60*10)/10;
          const validH = Math.round(a.validated_minutes/60*10)/10;
          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="user-avatar" style="width:32px;height:32px;background:#e0f2fe;color:#0369a1;font-size:11px">${a.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}</div>
                <span style="font-weight:600;color:#1e3a5f">${a.name}</span>
              </div>
            </td>
            <td><span class="badge badge-role">${a.role}</span></td>
            <td>${a.sessions}</td>
            <td>${totalH}h</td>
            <td>${validH}h</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:80px;background:#e5e7eb;border-radius:4px;height:6px">
                  <div style="width:${pct}%;background:#16a34a;height:6px;border-radius:4px"></div>
                </div>
                <span style="font-size:12px;font-weight:600;color:${pct>=80?'#16a34a':pct>=50?'#f59e0b':'#dc2626'}">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>` : '<p class="empty-state">Aucun membre dans votre département.</p>'}
  </div>`);
}

// ============================================
// ACTIVITÉ RÉCENTE
// ============================================
async function renderSessions() {
  renderLayout('sessions', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dir-dept/dashboard');
  const statusBadge = s => {
    const map = { 'Validé': 'badge-active', 'Terminé': 'badge-pending', 'En cours': 'badge-inprogress', 'Rejeté': 'badge-rejected', 'En attente': 'badge-pending' };
    return `<span class="badge ${map[s]||'badge-pending'}">${s}</span>`;
  };
  renderLayout('sessions', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-list" style="color:#1e3a5f;margin-right:10px"></i>Activité du Département</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  <div class="card">
    ${data.recentSessions && data.recentSessions.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Agent</th><th>Tâche</th><th>Objectif</th><th>Durée</th><th>Statut</th></tr></thead>
      <tbody>
        ${data.recentSessions.map(s => `<tr>
          <td>${new Date(s.start_time).toLocaleDateString('fr-FR')}</td>
          <td style="font-weight:600;color:#1e3a5f">${s.agent_name}</td>
          <td>${s.task_name}</td>
          <td>${s.objective_name}</td>
          <td>${s.duration_minutes ? minutesToDisplay(s.duration_minutes) : '—'}</td>
          <td>${statusBadge(s.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="empty-state">Aucune session récente.</p>'}
  </div>`);
}

// ============================================
// OBJECTIFS
// ============================================
async function renderObjectifs() {
  renderLayout('objectifs', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dir-dept/dashboard');
  renderLayout('objectifs', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-bullseye" style="color:#1e3a5f;margin-right:10px"></i>Objectifs Stratégiques</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  ${data.byObjective && data.byObjective.length > 0 ? data.byObjective.map(o => {
    const pct = o.percentage || 0;
    const target = o.target_percentage || 0;
    const ecart = pct - target;
    return `
    <div class="obj-card">
      <div class="obj-header" style="border-left-color:${o.color||'#1e3a5f'}">
        <span class="obj-dot" style="background:${o.color||'#1e3a5f'}"></span>
        <span class="obj-name">${o.name}</span>
        <span style="margin-left:auto;font-weight:700;font-size:20px;color:${o.color||'#1e3a5f'}">${pct}%</span>
      </div>
      <div class="obj-body">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">
          <span>Réalisé : <strong>${o.hours_display}</strong></span>
          <span>Cible : <strong>${target}%</strong></span>
          <span style="font-weight:700;color:${ecart>=0?'#16a34a':'#dc2626'}">Écart : ${ecart>=0?'+':''}${Math.round(ecart)}%</span>
        </div>
        <div style="background:#e5e7eb;border-radius:6px;height:12px">
          <div style="width:${Math.min(pct,100)}%;background:${o.color||'#1e3a5f'};height:12px;border-radius:6px;transition:width 0.8s"></div>
        </div>
        ${target > 0 ? `<div style="position:relative;margin-top:-12px;height:0">
          <div style="position:absolute;left:${Math.min(target,100)}%;width:2px;height:12px;background:#f59e0b;margin-left:-1px"></div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">Aucun objectif actif pour ce département.</div>'}
  `);
}

// ============================================
// INIT
// ============================================
renderDashboard();
