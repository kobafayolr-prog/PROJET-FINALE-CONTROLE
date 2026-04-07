// ============================================
// TimeTrack BGFIBank - Agent JavaScript
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let agentCharts = {};
let chronoInterval = null;
let chronoStart = null;
let activeSession = null;
let selectedTaskId = null;
let availableTasks = [];

// Auth check
if (!token || currentUser.role !== 'Agent') {
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

function formatChrono(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {}
  localStorage.clear();
  window.location = '/login';
}

// ============================================
// NOTIFICATIONS AGENT (polling 20s)
// ============================================
let _agentNotifSince = new Date().toISOString();

function startAgentNotifPolling() {
  setInterval(async () => {
    try {
      const r = await fetch('/api/notifications?since=' + encodeURIComponent(_agentNotifSince), { headers: { 'Authorization': 'Bearer ' + token } });
      if (!r.ok) return;
      const items = await r.json();
      _agentNotifSince = new Date().toISOString();
      items.forEach(n => {
        if (n.status === 'Valid\u00e9') {
          toast('\u2713 Session valid\u00e9e : ' + n.task_name, 'success');
        } else if (n.status === 'Rejet\u00e9') {
          const reason = n.rejected_reason ? ' \u2014 Motif : ' + n.rejected_reason : '';
          toast('\u2717 Session rejet\u00e9e : ' + n.task_name + reason, 'error');
        }
      });
    } catch(e) {}
  }, 20000);
}

// ============================================
// ROUTING
// ============================================
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('pointage')) return 'pointage';
  if (path.includes('sessions')) return 'sessions';
  if (path.includes('stats')) return 'stats';
  return 'dashboard';
}

function navigate(page) {
  history.pushState({}, '', '/agent/' + page);
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
      <div class="sidebar-section-title">Mon Espace</div>
      <a class="sidebar-item ${page==='dashboard'?'active':''}" onclick="navigate('dashboard')">
        <i class="fas fa-tachometer-alt"></i> Tableau de bord
      </a>
      <a class="sidebar-item ${page==='pointage'?'active':''}" onclick="navigate('pointage')">
        <i class="fas fa-clock"></i> Pointage
      </a>
      <a class="sidebar-item ${page==='sessions'?'active':''}" onclick="navigate('sessions')">
        <i class="fas fa-list-alt"></i> Mes Sessions
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Statistiques</div>
      <a class="sidebar-item ${page==='stats'?'active':''}" onclick="navigate('stats')">
        <i class="fas fa-chart-bar"></i> Mes Statistiques
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
          <div class="role">Agent</div>
        </div>
      </div>
    </div>
    <div class="content-area" id="content">${content}</div>
  </div>`;
}

// ============================================
// DASHBOARD AGENT
// ============================================
async function renderDashboard() {
  renderLayout('Tableau de bord', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const stats = await api('/api/agent/dashboard');
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('content').innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:8px">
      <i class="fas fa-tachometer-alt" style="color:#1e3a5f;font-size:18px"></i>
      <h2 style="font-size:20px;font-weight:700;color:#1e3a5f">Mon Tableau de bord</h2>
    </div>
    <span style="font-size:13px;color:#6b7280">${today}</span>
  </div>

  <!-- KPIs -->
  <div class="grid-4" style="margin-bottom:24px">
    <div class="kpi-card" style="border-left-color:#1e3a5f">
      <div>
        <div class="kpi-value">${stats.today_hours}</div>
        <div class="kpi-label">Aujourd'hui</div>
      </div>
      <div class="kpi-icon" style="background:#f0f4f8">
        <i class="fas fa-cog" style="color:#1e3a5f"></i>
      </div>
    </div>
    <div class="kpi-card" style="border-left-color:#f59e0b">
      <div>
        <div class="kpi-value">${stats.total_hours}</div>
        <div class="kpi-label">Total cumulé</div>
      </div>
      <div class="kpi-icon" style="background:#fef9c3">
        <i class="fas fa-clock" style="color:#d97706"></i>
      </div>
    </div>
    <div class="kpi-card" style="border-left-color:#22c55e">
      <div>
        <div class="kpi-value">${stats.total_sessions}</div>
        <div class="kpi-label">Sessions totales</div>
      </div>
      <div class="kpi-icon" style="background:#f0fdf4">
        <i class="fas fa-list-alt" style="color:#16a34a"></i>
      </div>
    </div>
    <div class="kpi-card" style="border-left-color:#ef4444">
      <div>
        <div class="kpi-value">${stats.rejected_sessions}</div>
        <div class="kpi-label">Sessions rejetées</div>
      </div>
      <div class="kpi-icon" style="background:#fee2e2">
        <i class="fas fa-times-circle" style="color:#dc2626"></i>
      </div>
    </div>
  </div>

  <!-- Répartition par Objectif -->
  <div class="chart-card">
    <div class="chart-title">
      <i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Répartition par Objectif Stratégique
    </div>
    ${stats.byObjective.length > 0 ? `
    <div style="display:flex;align-items:center;gap:32px">
      <div style="width:220px;height:220px">
        <canvas id="chartDash"></canvas>
      </div>
      <div style="flex:1">
        ${stats.byObjective.map(o => `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:12px;height:12px;border-radius:2px;background:${o.color};display:inline-block"></span>
            <span style="font-size:13px;color:#374151">${o.name}</span>
          </div>
          <div style="text-align:right">
            <span style="font-size:14px;font-weight:800;color:${o.color}">${o.percentage}%</span>
            <span style="font-size:11px;color:#6b7280;margin-left:4px">${o.hours_display}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>` : `<div style="text-align:center;padding:40px;color:#9ca3af"><i class="fas fa-chart-pie" style="font-size:40px;margin-bottom:12px;display:block"></i>Aucune session enregistrée</div>`}
  </div>

  <!-- Méthode 3-3-3 — Mon Ratio d'Efficience -->
  <div class="chart-card">
    <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Ma Méthode 3-3-3 — Mon Ratio d'Efficience</div>
    ${(stats.ratio333||[]).every(r=>r.minutes===0) ? `
    <div style="text-align:center;padding:30px;color:#9ca3af">
      <i class="fas fa-info-circle" style="font-size:32px;margin-bottom:10px;display:block"></i>
      Aucune session validée pour calculer le ratio
    </div>` : `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <div style="flex:0 0 160px"><canvas id="chart333Agent" height="160"></canvas></div>
      <div style="flex:1;min-width:160px">
        ${(stats.ratio333||[]).map(r => {
          const color = r.type==='Production'?'#1e3a5f':r.type==='Administration & Reporting'?'#f59e0b':'#10b981';
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0"></span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:12px;color:#374151">${r.type}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                <div style="flex:1;background:#e5e7eb;border-radius:4px;height:6px">
                  <div style="width:${r.percentage}%;background:${color};height:6px;border-radius:4px"></div>
                </div>
                <span style="font-weight:700;color:${color};font-size:12px;width:32px">${r.percentage}%</span>
                <span style="color:#6b7280;font-size:11px">${r.hours_display}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
        <div style="margin-top:10px;padding:8px 12px;background:#eff6ff;border-radius:8px;border-left:3px solid #1e3a5f">
          <div style="font-size:11px;color:#6b7280">Mon Ratio d'Efficience</div>
          <div style="font-size:18px;font-weight:800;color:#1e3a5f">
            ${(stats.ratio333||[]).find(r=>r.type==='Production')?.percentage||0}%
            <span style="font-size:11px;font-weight:400;color:#6b7280">en Production</span>
          </div>
        </div>
      </div>
    </div>`}
  </div>`;

  // Charts
  destroyCharts();
  if (stats.byObjective.length > 0) {
    agentCharts.dash = new Chart(document.getElementById('chartDash'), {
      type: 'doughnut',
      data: {
        labels: stats.byObjective.map(o => o.name),
        datasets: [{ data: stats.byObjective.map(o => o.total_minutes), backgroundColor: stats.byObjective.map(o => o.color), borderWidth: 2 }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const o = stats.byObjective[ctx.dataIndex];
                return ` ${o.name} : ${o.percentage}% (${o.hours_display})`;
              }
            }
          }
        },
        cutout: '55%'
      }
    });
  }
  if (stats.ratio333 && stats.ratio333.some(r=>r.minutes>0) && document.getElementById('chart333Agent')) {
    agentCharts.chart333 = new Chart(document.getElementById('chart333Agent'), {
      type: 'doughnut',
      data: {
        labels: stats.ratio333.map(r => r.type),
        datasets: [{ data: stats.ratio333.map(r => r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false } }, cutout: '60%' }
    });
  }
}

// ============================================
// POINTAGE
// ============================================
async function renderPointage() {
  renderLayout('Pointage', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const [tasks, active] = await Promise.all([
    api('/api/agent/tasks'),
    api('/api/agent/sessions/active')
  ]);
  availableTasks = tasks;
  activeSession = active;

  // Grouper par objectif
  const grouped = {};
  tasks.forEach(t => {
    if (!grouped[t.objective_name]) grouped[t.objective_name] = { color: t.objective_color, tasks: [] };
    grouped[t.objective_name].tasks.push(t);
  });

  const taskGroups = Object.entries(grouped).map(([name, g]) => `
    <div class="obj-group">
      <div class="obj-group-title">
        <span class="obj-dot" style="background:${g.color}"></span>
        <span style="color:${g.color};text-transform:uppercase;font-size:12px">${name}</span>
      </div>
      <div class="task-items">
        ${g.tasks.map(t => `
        <div class="task-item ${activeSession && activeSession.task_id === t.id ? 'selected' : ''}" onclick="selectTask(${t.id})">
          <h4>${t.name}</h4>
          <p>${t.process_name}</p>
        </div>`).join('')}
      </div>
    </div>`).join('');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16);

  document.getElementById('content').innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
    <i class="fas fa-clock" style="color:#1e3a5f;font-size:18px"></i>
    <h2 style="font-size:20px;font-weight:700;color:#1e3a5f">Pointage des Activités</h2>
  </div>

  <div class="grid-2" style="margin-bottom:24px">
    <!-- Chronomètre -->
    <div class="chrono-container">
      <div style="font-size:13px;opacity:0.7;letter-spacing:2px;text-transform:uppercase">Chronomètre</div>
      <div class="chrono-display" id="chrono-display">${activeSession ? '-- : -- : --' : '00:00:00'}</div>
      <div class="chrono-label" id="chrono-label">${activeSession ? 'Session en cours : ' + (activeSession.task_name || '') : 'Aucune session en cours'}</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        ${activeSession ? `
          <button class="btn-chrono btn-stop" onclick="stopSession()">
            <i class="fas fa-stop"></i> Arrêter
          </button>` : `
          <button class="btn-chrono btn-start" id="start-btn" onclick="startSession()" ${!selectedTaskId ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            <i class="fas fa-play"></i> Démarrer
          </button>`}
      </div>
    </div>

    <!-- Saisie Manuelle -->
    <div class="manual-form">
      <div class="chart-title" style="margin-bottom:16px">
        <i class="fas fa-edit" style="color:#1e3a5f"></i> Saisie manuelle
      </div>
      <div class="form-group">
        <label class="form-label">Tâche</label>
        <select class="form-control" id="manual-task">
          <option value="">Choisir...</option>
          ${tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Début</label>
          <input type="datetime-local" class="form-control" id="manual-start" value="${dateStr}">
        </div>
        <div class="form-group">
          <label class="form-label">Fin</label>
          <input type="datetime-local" class="form-control" id="manual-end" value="${dateStr}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Commentaire (optionnel)</label>
        <textarea class="form-control" id="manual-comment" rows="2" placeholder="Détails de l'activité..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="saveManual()" style="width:100%">
        <i class="fas fa-save"></i> Enregistrer
      </button>
    </div>
  </div>

  <!-- Tâches disponibles -->
  <div class="tasks-section">
    <div class="chart-title" style="margin-bottom:16px">
      <i class="fas fa-list" style="color:#1e3a5f"></i> Tâches disponibles dans votre département
    </div>
    ${taskGroups || '<div style="color:#9ca3af;text-align:center;padding:20px">Aucune tâche disponible</div>'}
  </div>`;

  // Démarrer le chrono si session active
  if (activeSession) {
    startChronoFromSession(activeSession.start_time);
  }
}

function selectTask(id) {
  selectedTaskId = id;
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  const btn = document.getElementById('start-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
}

function startChronoFromSession(startTime) {
  const start = new Date(startTime);
  chronoInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
    const el = document.getElementById('chrono-display');
    if (el) el.textContent = formatChrono(elapsed);
  }, 1000);
}

async function startSession() {
  if (!selectedTaskId) { toast('Sélectionnez une tâche d\'abord', 'error'); return; }
  const r = await api('/api/agent/sessions/start', { method: 'POST', body: JSON.stringify({ task_id: selectedTaskId }) });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Session démarrée !');
  renderPointage();
}

async function stopSession() {
  const r = await api('/api/agent/sessions/stop', { method: 'POST' });
  if (r.error) { toast(r.error, 'error'); return; }
  if (chronoInterval) { clearInterval(chronoInterval); chronoInterval = null; }
  toast('Session terminée ! ' + minutesToHours(r.duration_minutes || 0));
  renderPointage();
}

async function saveManual() {
  const task_id = document.getElementById('manual-task').value;
  const start_time = document.getElementById('manual-start').value;
  const end_time = document.getElementById('manual-end').value;
  const comment = document.getElementById('manual-comment').value;

  if (!task_id) { toast('Sélectionnez une tâche', 'error'); return; }
  if (!start_time || !end_time) { toast('Renseignez les dates', 'error'); return; }

  const r = await api('/api/agent/sessions/manual', { method: 'POST', body: JSON.stringify({ task_id, start_time, end_time, comment }) });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Session enregistrée !');
  renderPointage();
}

// ============================================
// MES SESSIONS
// ============================================
async function renderSessions() {
  renderLayout('Mes Sessions', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const sessions = await api('/api/agent/sessions');

  document.getElementById('content').innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
    <i class="fas fa-history" style="color:#1e3a5f;font-size:18px"></i>
    <h2 style="font-size:20px;font-weight:700;color:#1e3a5f">Mes Sessions de Travail</h2>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>DATE</th><th>TÂCHE</th><th>OBJECTIF</th>
            <th>DÉBUT</th><th>FIN</th><th>DURÉE</th><th>STATUT</th><th>TYPE</th>
          </tr></thead>
          <tbody>
            ${sessions.map(s => `<tr>
              <td style="color:#6b7280;font-size:12px">${formatDate(s.start_time)}</td>
              <td style="font-weight:600;color:#1e3a5f">${s.task_name}</td>
              <td><span class="badge-obj" style="background:${s.objective_color}">${s.objective_name}</span></td>
              <td style="font-size:12px">${formatTime(s.start_time)}</td>
              <td style="font-size:12px">${s.end_time ? formatTime(s.end_time) : '-'}</td>
              <td style="font-weight:700">${minutesToHours(s.duration_minutes || 0)}</td>
              <td>${getStatusBadge(s.status)}</td>
              <td><span class="badge-type">${s.session_type || 'Auto'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function getStatusBadge(status) {
  const cls = { 'Validé': 'status-valide', 'Terminé': 'status-termine', 'Rejeté': 'status-rejete', 'En cours': 'status-en-cours' };
  const icon = status === 'Validé' ? '✓ ' : status === 'Terminé' ? '✓ ' : status === 'Rejeté' ? '✗ ' : '';
  return `<span class="status-badge ${cls[status]||'status-en-cours'}">${icon}${status}</span>`;
}

// ============================================
// MES STATISTIQUES
// ============================================
async function renderStats() {
  renderLayout('Mes Statistiques', '<div style="text-align:center;padding:32px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:#9ca3af"></i></div>');
  const stats = await api('/api/agent/stats');

  // Calcul heures productives vs non productives (8h = 480 min par jour)
  const totalMin = stats.byObjective.reduce((s, o) => s + o.total_minutes, 0);
  const prodMin = totalMin; // supposé productif pour simplification
  const nonProdMin = 0;

  document.getElementById('content').innerHTML = `
  <!-- KPIs -->
  <div class="grid-4" style="margin-bottom:24px">
    <div class="kpi-card" style="border-left-color:#1e3a5f">
      <div class="kpi-value">${stats.today_hours}</div><div class="kpi-label">Aujourd'hui</div>
    </div>
    <div class="kpi-card" style="border-left-color:#f59e0b">
      <div class="kpi-value">${stats.total_hours}</div><div class="kpi-label">Total cumulé</div>
    </div>
    <div class="kpi-card" style="border-left-color:#22c55e">
      <div class="kpi-value">${stats.validated_hours}</div><div class="kpi-label">Heures validées</div>
    </div>
    <div class="kpi-card" style="border-left-color:#3b82f6">
      <div class="kpi-value">${stats.total_sessions}</div><div class="kpi-label">Sessions totales</div>
    </div>
  </div>

  <div class="grid-2">
    <!-- Graphique par objectif -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f"></i> Par Objectif Stratégique</div>
      ${stats.byObjective.length > 0 ? `<canvas id="chartStats" height="220"></canvas>` : `<div style="text-align:center;padding:40px;color:#9ca3af">Aucune donnée</div>`}
    </div>
    <!-- Détail par objectif -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-list" style="color:#1e3a5f"></i> Détail par Objectif</div>
      ${stats.byObjective.map(o => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:13px;font-weight:700;color:${o.color}">${o.name}</span>
          <div style="text-align:right">
            <span style="font-size:14px;font-weight:800;color:${o.color}">${o.percentage}%</span>
            <span style="font-size:11px;color:#6b7280;margin-left:4px">${o.hours_display}</span>
          </div>
        </div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">${o.session_count} session(s)</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${o.percentage}%;background:${o.color}"></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;

  if (stats.byObjective.length > 0) {
    destroyCharts();
    agentCharts.stats = new Chart(document.getElementById('chartStats'), {
      type: 'bar',
      data: {
        labels: stats.byObjective.map(o => o.name.substring(0, 20)),
        datasets: [{
          data: stats.byObjective.map(o => (o.total_minutes / 60).toFixed(2)),
          backgroundColor: stats.byObjective.map(o => o.color)
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const o = stats.byObjective[ctx.dataIndex];
                return ` ${o.name} : ${o.percentage}% (${o.hours_display})`;
              }
            }
          }
        },
        scales: { y: { ticks: { callback: v => v + 'h' } } }
      }
    });
  }
}

function destroyCharts() {
  Object.values(agentCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  agentCharts = {};
}

// ============================================
// RENDER
// ============================================
function renderPage(page) {
  destroyCharts();
  const p = page || getCurrentPage();
  if (p === 'dashboard') renderDashboard();
  else if (p === 'pointage') renderPointage();
  else if (p === 'sessions') renderSessions();
  else if (p === 'stats') renderStats();
  else renderDashboard();
}

renderPage();
window.addEventListener('popstate', () => renderPage());
startAgentNotifPolling();
