// ============================================
// TimeTrack BGFIBank - Chef de Service JavaScript
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let csCharts = {};
let chronoInterval = null;
let activeSession = null;
let availableTasks = [];

// Auth check
if (!token || currentUser.role !== 'Chef de Service') {
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
  Object.values(csCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  csCharts = {};
}

// ============================================
// LAYOUT
// ============================================
function renderLayout(page, content) {
  const navItems = [
    { id: 'dashboard', icon: 'tachometer-alt', label: 'Tableau de bord' },
    { id: 'pointage', icon: 'clock', label: 'Mon Pointage' },
    { id: 'sessions', icon: 'list', label: 'Mes Sessions' },
    { id: 'equipe', icon: 'users', label: 'Mon Équipe' }
  ];
  document.getElementById('app').innerHTML = `
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <img src="/static/bgfibank-logo.png" alt="BGFIBank" style="height:36px;margin-right:10px">
        <div>
          <div style="font-weight:700;font-size:13px;color:#1e3a5f">TimeTrack</div>
          <div style="font-size:10px;color:#64748b">Chef de Service</div>
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
            <div style="font-weight:600;font-size:12px">${currentUser.first_name} ${currentUser.last_name}</div>
            <div style="font-size:10px;color:#64748b">Chef de Service</div>
          </div>
        </div>
        <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
      </div>
    </nav>
    <main class="main-content">
      <div id="content">${content}</div>
    </main>
  </div>`;
}

function navigate(page) {
  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'pointage': renderPointage(); break;
    case 'sessions': renderSessions(); break;
    case 'equipe': renderEquipe(); break;
    default: renderDashboard();
  }
}

// ============================================
// DASHBOARD
// ============================================
async function renderDashboard() {
  renderLayout('dashboard', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const stats = await api('/api/chef-service/dashboard');
  renderLayout('dashboard', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-tachometer-alt" style="color:#1e3a5f;margin-right:10px"></i>Mon Tableau de bord</h2>
    <span style="font-size:13px;color:#64748b">${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#dbeafe;color:#1e40af"><i class="fas fa-clock"></i></div>
      <div class="kpi-value">${stats.today_hours||'0h 00m'}</div>
      <div class="kpi-label">Heures aujourd'hui</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#dcfce7;color:#16a34a"><i class="fas fa-chart-bar"></i></div>
      <div class="kpi-value">${stats.total_hours||'0h 00m'}</div>
      <div class="kpi-label">Total heures validées</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#fef3c7;color:#b45309"><i class="fas fa-tasks"></i></div>
      <div class="kpi-value">${stats.total_sessions||0}</div>
      <div class="kpi-label">Sessions totales</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon" style="background:#fee2e2;color:#dc2626"><i class="fas fa-times-circle"></i></div>
      <div class="kpi-value">${stats.rejected_sessions||0}</div>
      <div class="kpi-label">Sessions rejetées</div>
    </div>
  </div>
  <div class="charts-grid">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-users" style="color:#1e3a5f;margin-right:8px"></i>Mon Équipe (Agents)</div>
      ${stats.team && stats.team.length > 0 ? `
      <table class="data-table">
        <thead><tr><th>Agent</th><th>Sessions</th><th>Heures validées</th></tr></thead>
        <tbody>
          ${stats.team.map(a => `<tr>
            <td><div style="font-weight:600;color:#1e3a5f">${a.name}</div><div style="font-size:11px;color:#9ca3af">Agent</div></td>
            <td>${a.total_sessions}</td>
            <td>${minutesToDisplay(a.validated_minutes)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="empty-state">Aucun agent dans votre équipe.</p>'}
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f;margin-right:8px"></i>Mes Heures par Objectif</div>
      ${stats.byObjective && stats.byObjective.length > 0 ? `
      <canvas id="csChartObj" height="220"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
    </div>
  </div>`);
  if (stats.byObjective && stats.byObjective.length > 0) {
    const ctx = document.getElementById('csChartObj');
    if (ctx) {
      csCharts.obj = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: stats.byObjective.map(o => o.name),
          datasets: [{ data: stats.byObjective.map(o => o.total_minutes), backgroundColor: stats.byObjective.map(o => o.color || '#1e3a5f') }]
        },
        options: { plugins: { legend: { position: 'bottom' } }, responsive: true }
      });
    }
  }
}

// ============================================
// POINTAGE
// ============================================
async function renderPointage() {
  renderLayout('pointage', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const [tasks, active] = await Promise.all([
    api('/api/chef-service/tasks'),
    api('/api/chef-service/sessions/active')
  ]);
  availableTasks = Array.isArray(tasks) ? tasks : [];
  activeSession = active;
  if (activeSession && activeSession.id) {
    startChrono();
  }
  renderLayout('pointage', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-clock" style="color:#1e3a5f;margin-right:10px"></i>Mon Pointage</h2>
  </div>
  ${activeSession && activeSession.id ? `
  <div class="active-session-card">
    <div class="session-running">
      <div class="pulse-dot"></div>
      <span>Session en cours</span>
    </div>
    <div class="session-task">${activeSession.task_name}</div>
    <div class="session-timer" id="chrono">00:00:00</div>
    <button class="btn btn-danger" onclick="stopSession()">
      <i class="fas fa-stop-circle" style="margin-right:6px"></i>Terminer la session
    </button>
  </div>` : `
  <div class="pointage-card">
    <div class="form-group">
      <label class="form-label">Sélectionnez une tâche</label>
      <select class="form-control" id="task-select" onchange="selectTask(this.value)" style="margin-bottom:16px">
        <option value="">-- Choisir une tâche --</option>
        ${availableTasks.map(t => `<option value="${t.id}">${t.name} (${t.process_name})</option>`).join('')}
      </select>
    </div>
    <div id="task-detail" style="display:none;margin-bottom:16px">
      <div class="task-info-card" id="task-info"></div>
    </div>
    <button class="btn btn-primary btn-full" id="start-btn" onclick="startSession()" disabled>
      <i class="fas fa-play-circle" style="margin-right:6px"></i>Démarrer la session
    </button>
  </div>`}
  `);
  if (activeSession && activeSession.id) {
    updateChrono();
  }
}

function selectTask(id) {
  const task = availableTasks.find(t => t.id == id);
  const btn = document.getElementById('start-btn');
  const detail = document.getElementById('task-detail');
  const info = document.getElementById('task-info');
  if (task) {
    btn.disabled = false;
    detail.style.display = 'block';
    info.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#f8fafc;border-radius:8px;border-left:4px solid ${task.objective_color||'#1e3a5f'}">
      <div>
        <div style="font-weight:600;color:#1e3a5f">${task.name}</div>
        <div style="font-size:12px;color:#64748b">${task.process_name} • <span class="badge" style="background:${task.objective_color||'#1e3a5f'};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">${task.objective_name}</span></div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px">Type : ${task.task_type||'Production'}</div>
      </div>
    </div>`;
    window._selectedTaskId = id;
  }
}

async function startSession() {
  const taskId = window._selectedTaskId;
  if (!taskId) return toast('Veuillez sélectionner une tâche.', 'warning');
  const r = await api('/api/chef-service/sessions/start', { method: 'POST', body: JSON.stringify({ task_id: taskId }) });
  if (r.error) return toast(r.error, 'error');
  toast('Session démarrée !');
  renderPointage();
}

async function stopSession() {
  const r = await api('/api/chef-service/sessions/stop', { method: 'POST', body: JSON.stringify({}) });
  if (r.error) return toast(r.error, 'error');
  clearInterval(chronoInterval);
  toast(`Session terminée — ${minutesToDisplay(r.duration_minutes || 0)}`);
  renderDashboard();
}

function startChrono() {
  if (chronoInterval) clearInterval(chronoInterval);
  chronoInterval = setInterval(updateChrono, 1000);
}

function updateChrono() {
  if (!activeSession || !activeSession.start_time) return;
  const el = document.getElementById('chrono');
  if (!el) return;
  const elapsed = Math.floor((Date.now() - new Date(activeSession.start_time).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// ============================================
// SESSIONS
// ============================================
async function renderSessions() {
  renderLayout('sessions', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const sessions = await api('/api/chef-service/sessions');
  const statusBadge = s => {
    const map = { 'Validé': 'badge-active', 'Terminé': 'badge-pending', 'En cours': 'badge-inprogress', 'Rejeté': 'badge-rejected', 'En attente': 'badge-pending' };
    return `<span class="badge ${map[s]||'badge-pending'}">${s}</span>`;
  };
  renderLayout('sessions', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-list" style="color:#1e3a5f;margin-right:10px"></i>Mes Sessions</h2>
  </div>
  <div class="card">
    ${sessions && sessions.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Tâche</th><th>Objectif</th><th>Durée</th><th>Statut</th></tr></thead>
      <tbody>
        ${sessions.map(s => `<tr>
          <td>${new Date(s.start_time).toLocaleDateString('fr-FR')}</td>
          <td>${s.task_name}</td>
          <td><span class="badge" style="background:${s.objective_color||'#1e3a5f'};color:#fff">${s.objective_name}</span></td>
          <td>${s.duration_minutes ? minutesToDisplay(s.duration_minutes) : '—'}</td>
          <td>${statusBadge(s.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="empty-state">Aucune session enregistrée.</p>'}
  </div>`);
}

// ============================================
// EQUIPE
// ============================================
async function renderEquipe() {
  renderLayout('equipe', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const stats = await api('/api/chef-service/dashboard');
  renderLayout('equipe', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-users" style="color:#1e3a5f;margin-right:10px"></i>Mon Équipe</h2>
    <span style="font-size:13px;color:#64748b">Département : ${currentUser.department_name||''}</span>
  </div>
  <div class="card">
    <div class="chart-title" style="margin-bottom:16px">Agents du département — ce mois</div>
    ${stats.team && stats.team.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Agent</th><th>Sessions</th><th>Total heures</th><th>Heures validées</th></tr></thead>
      <tbody>
        ${stats.team.map(a => `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="user-avatar" style="width:32px;height:32px;font-size:12px">${a.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}</div>
              <span style="font-weight:600;color:#1e3a5f">${a.name}</span>
            </div>
          </td>
          <td>${a.total_sessions}</td>
          <td>${minutesToDisplay(a.total_minutes)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;background:#e5e7eb;border-radius:4px;height:6px">
                <div style="width:${a.total_minutes>0?Math.round(a.validated_minutes*100/a.total_minutes):0}%;background:#16a34a;height:6px;border-radius:4px"></div>
              </div>
              <span style="font-size:12px;color:#64748b">${minutesToDisplay(a.validated_minutes)}</span>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="empty-state">Aucun agent dans votre équipe.</p>'}
  </div>`);
}

// ============================================
// INIT
// ============================================
renderDashboard();
