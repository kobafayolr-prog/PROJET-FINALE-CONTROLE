// ============================================
// TimeTrack BGFIBank - Admin JavaScript
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let adminCharts = {};

// Auth check
if (!token || currentUser.role !== 'Administrateur') {
  window.location = '/login';
}

// Vérifier que le token est encore valide au démarrage
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
  t.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check' : 'exclamation') + '-circle mr-2"></i>' + msg;
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
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function minutesToHours(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h + 'h ' + String(m).padStart(2, '0') + 'm';
}

function getPctClass(pct, target) {
  const ratio = target > 0 ? pct / target : 1;
  if (ratio >= 0.9) return 'pct-ok';
  if (ratio >= 0.6) return 'pct-warning';
  return 'pct-danger';
}

function logout() {
  localStorage.clear();
  window.location = '/login';
}

// ============================================
// ROUTING
// ============================================
function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('dashboard')) return 'dashboard';
  if (path.includes('sessions')) return 'sessions';
  if (path.includes('users')) return 'users';
  if (path.includes('departments')) return 'departments';
  if (path.includes('objectives')) return 'objectives';
  if (path.includes('processes')) return 'processes';
  if (path.includes('tasks')) return 'tasks';
  if (path.includes('reports')) return 'reports';
  if (path.includes('audit')) return 'audit';
  return 'dashboard';
}

function navigate(page) {
  history.pushState({}, '', '/admin/' + page);
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
      <a class="sidebar-item ${page==='sessions'?'active':''}" onclick="navigate('sessions')">
        <i class="fas fa-list-alt"></i> Toutes les sessions
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Gestion</div>
      <a class="sidebar-item ${page==='users'?'active':''}" onclick="navigate('users')">
        <i class="fas fa-users"></i> Utilisateurs
      </a>
      <a class="sidebar-item ${page==='departments'?'active':''}" onclick="navigate('departments')">
        <i class="fas fa-building"></i> Départements
      </a>
      <a class="sidebar-item ${page==='objectives'?'active':''}" onclick="navigate('objectives')">
        <i class="fas fa-bullseye"></i> Objectifs Stratégiques
      </a>
      <a class="sidebar-item ${page==='processes'?'active':''}" onclick="navigate('processes')">
        <i class="fas fa-sitemap"></i> Processus
      </a>
      <a class="sidebar-item ${page==='tasks'?'active':''}" onclick="navigate('tasks')">
        <i class="fas fa-tasks"></i> Tâches
      </a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Rapports</div>
      <a class="sidebar-item ${page==='reports'?'active':''}" onclick="navigate('reports')">
        <i class="fas fa-chart-bar"></i> Rapports & Export
      </a>
      <a class="sidebar-item ${page==='audit'?'active':''}" onclick="navigate('audit')">
        <i class="fas fa-file-alt"></i> Journal d'audit
      </a>
    </div>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="avatar" style="background:${avatarColor}">${initials}</div>
        <div>
          <div class="name">${name}</div>
          <div class="role">Direction Générale</div>
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
          <div class="role">Administrateur</div>
        </div>
      </div>
    </div>
    <div class="content-area" id="content">${content}</div>
  </div>`;
}

// ============================================
// DASHBOARD
// ============================================
async function renderDashboard() {
  renderLayout('Administration', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  const stats = await api('/api/admin/stats');

  const totalMin = stats.hoursByObjective.reduce((s, o) => s + o.total_minutes, 0);
  const totalHours = minutesToHours(totalMin);

  document.getElementById('content').innerHTML = `
  <div class="grid-2" style="margin-bottom:20px">
    <!-- Heures par Objectif -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f"></i> Heures par Objectif Stratégique</div>
      <canvas id="chartObjectives" height="200"></canvas>
    </div>
    <!-- Heures par Département -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f"></i> Heures par Département</div>
      <canvas id="chartDepts" height="200"></canvas>
    </div>
  </div>
  <div class="grid-2" style="margin-bottom:20px">
    <!-- Tendance Mensuelle -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-line" style="color:#1e3a5f"></i> Tendance Mensuelle</div>
      <canvas id="chartTrend" height="200"></canvas>
    </div>
    <!-- Productivité -->
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Productivité</div>
      <div style="display:flex;align-items:center;gap:20px">
        <div style="flex:1"><canvas id="chartProductivity" height="220"></canvas></div>
        <div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="width:12px;height:12px;border-radius:50%;background:#22c55e;display:inline-block"></span>
            <span style="font-size:12px;color:#555">Productives</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:12px;height:12px;border-radius:50%;background:#ef4444;display:inline-block"></span>
            <span style="font-size:12px;color:#555">Non productives</span>
          </div>
          <div style="margin-top:16px;padding:10px;background:#f0fdf4;border-radius:8px;text-align:center">
            <div style="font-size:16px;font-weight:800;color:#16a34a">${stats.productivity.productive_hours}</div>
            <div style="font-size:11px;color:#6b7280">Productives</div>
          </div>
          <div style="margin-top:8px;padding:10px;background:#fee2e2;border-radius:8px;text-align:center">
            <div style="font-size:16px;font-weight:800;color:#dc2626">${stats.productivity.non_productive_hours}</div>
            <div style="font-size:11px;color:#6b7280">Non productives</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Tableau Objectifs avec % cible vs réel -->
  <div class="card">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-bullseye" style="color:#1e3a5f"></i> Objectifs Stratégiques - Cibles vs Réalisé</div>
      <table style="width:100%">
        <thead><tr>
          <th>OBJECTIF</th><th>HEURES</th><th>% RÉALISÉ</th><th>% CIBLE</th><th>ÉCART</th><th>STATUT</th>
        </tr></thead>
        <tbody>
          ${stats.hoursByObjective.map(o => {
            const ecart = o.percentage - o.target_percentage;
            const ecartClass = ecart >= 0 ? 'pct-ok' : (ecart > -10 ? 'pct-warning' : 'pct-danger');
            return `<tr>
              <td><span class="badge badge-obj" style="background:${o.color}">${o.name}</span></td>
              <td style="font-weight:700">${o.hours_display}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar" style="width:100px">
                    <div class="progress-fill" style="width:${o.percentage}%;background:${o.color}"></div>
                  </div>
                  <span style="font-weight:700;color:${o.color}">${o.percentage}%</span>
                </div>
              </td>
              <td style="font-weight:700;color:#6b7280">${o.target_percentage}%</td>
              <td class="${ecartClass}">${ecart >= 0 ? '+' : ''}${ecart}%</td>
              <td><span class="badge badge-active">Actif</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // Charts
  destroyCharts();

  // Objectifs chart
  if (stats.hoursByObjective.length > 0) {
    adminCharts.objectives = new Chart(document.getElementById('chartObjectives'), {
      type: 'bar',
      data: {
        labels: stats.hoursByObjective.map(o => o.name.substring(0, 20)),
        datasets: [{
          data: stats.hoursByObjective.map(o => (o.total_minutes / 60).toFixed(2)),
          backgroundColor: stats.hoursByObjective.map(o => o.color)
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + 'h' } } } }
    });
  }

  // Depts chart
  if (stats.hoursByDept.length > 0) {
    adminCharts.depts = new Chart(document.getElementById('chartDepts'), {
      type: 'bar',
      data: {
        labels: stats.hoursByDept.map(d => d.name.replace('Direction ', 'Dir. ')),
        datasets: [{ data: stats.hoursByDept.map(d => (d.total_minutes / 60).toFixed(2)), backgroundColor: '#22c55e' }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { callback: v => v + 'h' } } }, indexAxis: 'y' }
    });
  }

  // Trend chart
  if (stats.monthlyTrend.length > 0) {
    adminCharts.trend = new Chart(document.getElementById('chartTrend'), {
      type: 'line',
      data: {
        labels: stats.monthlyTrend.map(m => m.month).reverse(),
        datasets: [{ data: stats.monthlyTrend.map(m => (m.total_minutes / 60).toFixed(2)).reverse(), borderColor: '#1e3a5f', backgroundColor: 'rgba(30,58,95,0.1)', tension: 0.4, fill: true }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + 'h' } } } }
    });
  }

  // Productivity pie
  const prodMin = stats.productivity.productive_minutes;
  const nonProdMin = stats.productivity.non_productive_minutes;
  if (prodMin + nonProdMin > 0) {
    adminCharts.productivity = new Chart(document.getElementById('chartProductivity'), {
      type: 'doughnut',
      data: {
        labels: ['Productives', 'Non productives'],
        datasets: [{ data: [prodMin, nonProdMin], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false } }, cutout: '60%' }
    });
  }
}

function destroyCharts() {
  Object.values(adminCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  adminCharts = {};
}

// ============================================
// SESSIONS
// ============================================
async function renderSessions() {
  renderLayout('Toutes les Sessions', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  const sessions = await api('/api/admin/sessions');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-list-alt"></i><h2>Toutes les Sessions</h2></div>
    <button class="btn btn-primary" onclick="exportCSV(adminSessionsData, 'sessions')">
      <i class="fas fa-file-export"></i> Exporter
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>AGENT</th><th>DÉPARTEMENT</th><th>TÂCHE</th><th>OBJECTIF</th>
            <th>DATE</th><th>DURÉE</th><th>STATUT</th>
          </tr></thead>
          <tbody>
            ${sessions.map(s => `<tr>
              <td style="font-weight:600;color:#1e3a5f">${s.agent_name}</td>
              <td>${s.department_name}</td>
              <td><a style="color:#1e3a5f;cursor:pointer">${s.task_name}</a></td>
              <td><span class="badge badge-obj" style="background:${s.objective_color}">${s.objective_name}</span></td>
              <td>${formatDateShort(s.start_time)}</td>
              <td style="font-weight:700">${minutesToHours(s.duration_minutes || 0)}</td>
              <td>${getStatusBadge(s.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  window.adminSessionsData = sessions;
}

function getStatusBadge(status) {
  const map = { 'Validé': 'status-valide ✓', 'Terminé': 'status-termine ✓', 'Rejeté': 'status-rejete ✗', 'En cours': 'status-en-cours' };
  const cls = map[status] ? map[status].split(' ')[0] : 'status-en-cours';
  const icon = status === 'Validé' ? '✓ ' : status === 'Terminé' ? '✓ ' : status === 'Rejeté' ? '✗ ' : '';
  return `<span class="status-badge ${cls}">${icon}${status}</span>`;
}

function exportCSV(data, name) {
  if (!data || !data.length) { toast('Aucune donnée à exporter', 'error'); return; }
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
// USERS
// ============================================
let allUsers = [], allDepts = [];

async function renderUsers() {
  renderLayout('Gestion des Utilisateurs', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  [allUsers, allDepts] = await Promise.all([api('/api/admin/users'), api('/api/admin/departments')]);

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-users"></i><h2>Gestion des Utilisateurs</h2></div>
    <button class="btn btn-primary" onclick="showUserModal()">
      <i class="fas fa-plus"></i> Nouvel utilisateur
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>NOM</th><th>EMAIL</th><th>RÔLE</th><th>DÉPARTEMENT</th><th>STATUT</th><th>DERNIÈRE CONNEXION</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${allUsers.map(u => {
              const initials = getInitials(u.first_name + ' ' + u.last_name);
              const avatarColor = getAvatarColor(u.first_name + ' ' + u.last_name);
              return `<tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar-circle" style="background:${avatarColor};width:34px;height:34px;font-size:12px">${initials}</div>
                  <span style="font-weight:600;color:#1e3a5f">${u.first_name} ${u.last_name}</span>
                </div></td>
                <td>${u.email}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td>${u.department_name || '-'}</td>
                <td><span class="badge ${u.status==='Actif'?'badge-active':'badge-inactive'}">${u.status}</span></td>
                <td>${formatDate(u.last_login)}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="showUserModal(${u.id})"><i class="fas fa-edit"></i></button>
                  ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" style="margin-left:4px"><i class="fas fa-trash"></i></button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function getRoleBadge(role) {
  const cls = role === 'Administrateur' ? 'role-admin' : role === 'Chef de Département' ? 'role-chef' : 'role-agent';
  return `<span class="status-badge ${cls}">${role}</span>`;
}

function showUserModal(userId = null) {
  const user = userId ? allUsers.find(u => u.id === userId) : null;
  const deptsOptions = allDepts.map(d => `<option value="${d.id}" ${user && user.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user mr-2"></i>${userId ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="user-form">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Prénom</label><input class="form-control" id="u_first" value="${user?.first_name || ''}" required></div>
        <div class="form-group"><label class="form-label">Nom</label><input class="form-control" id="u_last" value="${user?.last_name || ''}" required></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-control" type="email" id="u_email" value="${user?.email || ''}" required></div>
      <div class="form-group"><label class="form-label">Mot de passe ${userId ? '(laisser vide pour ne pas changer)' : ''}</label>
        <input class="form-control" type="password" id="u_pwd" placeholder="••••••••" ${!userId ? 'required' : ''}></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Rôle</label>
          <select class="form-control" id="u_role">
            <option value="Agent" ${user?.role==='Agent'?'selected':''}>Agent</option>
            <option value="Chef de Département" ${user?.role==='Chef de Département'?'selected':''}>Chef de Département</option>
            <option value="Administrateur" ${user?.role==='Administrateur'?'selected':''}>Administrateur</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Département</label>
          <select class="form-control" id="u_dept">
            <option value="">-- Aucun --</option>${deptsOptions}
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Statut</label>
        <select class="form-control" id="u_status">
          <option value="Actif" ${user?.status==='Actif'?'selected':''}>Actif</option>
          <option value="Inactif" ${user?.status==='Inactif'?'selected':''}>Inactif</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>Enregistrer</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      first_name: document.getElementById('u_first').value,
      last_name: document.getElementById('u_last').value,
      email: document.getElementById('u_email').value,
      password: document.getElementById('u_pwd').value,
      role: document.getElementById('u_role').value,
      department_id: document.getElementById('u_dept').value || null,
      status: document.getElementById('u_status').value
    };
    try {
      const r = userId ? await api('/api/admin/users/' + userId, { method: 'PUT', body: JSON.stringify(data) })
                      : await api('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
      if (r.error) throw new Error(r.error);
      toast(userId ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      modal.remove();
      renderUsers();
    } catch(err) { toast(err.message, 'error'); }
  });
}

async function deleteUser(id) {
  if (!confirm('Supprimer cet utilisateur ?')) return;
  await api('/api/admin/users/' + id, { method: 'DELETE' });
  toast('Utilisateur supprimé');
  renderUsers();
}

// ============================================
// DEPARTMENTS
// ============================================
let allDeptsData = [];

async function renderDepartments() {
  renderLayout('Gestion des Départements', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  allDeptsData = await api('/api/admin/departments');

  const cards = allDeptsData.map(d => `
    <div class="dept-card">
      <button class="edit-btn" onclick="showDeptModal(${d.id})" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.05);border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280">
        <i class="fas fa-edit" style="font-size:12px"></i>
      </button>
      <h3 style="font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:4px;padding-right:36px">${d.name}</h3>
      <p style="font-size:12px;color:#6b7280;margin-bottom:8px">Code: ${d.code}</p>
      ${d.description ? `<p style="font-size:11px;color:#9ca3af;margin-bottom:8px">${d.description}</p>` : ''}
      <span class="badge ${d.status==='Actif'?'badge-active':'badge-inactive'}">${d.status}</span>
    </div>`).join('');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-building"></i><h2>Gestion des Départements</h2></div>
    <button class="btn btn-primary" onclick="showDeptModal()"><i class="fas fa-plus"></i> Nouveau département</button>
  </div>
  <div class="grid-auto">${cards}</div>`;
}

function showDeptModal(id = null) {
  const d = id ? allDeptsData.find(x => x.id === id) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">${id ? 'Modifier le département' : 'Nouveau département'}</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="dept-form">
      <div class="form-group"><label class="form-label">Nom</label><input class="form-control" id="d_name" value="${d?.name||''}" required></div>
      <div class="form-group"><label class="form-label">Code</label><input class="form-control" id="d_code" value="${d?.code||''}" required></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="d_desc" rows="3">${d?.description||''}</textarea></div>
      <div class="form-group"><label class="form-label">Statut</label>
        <select class="form-control" id="d_status">
          <option value="Actif" ${d?.status==='Actif'?'selected':''}>Actif</option>
          <option value="Inactif" ${d?.status==='Inactif'?'selected':''}>Inactif</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>Enregistrer</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('dept-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { name: document.getElementById('d_name').value, code: document.getElementById('d_code').value, description: document.getElementById('d_desc').value, status: document.getElementById('d_status').value };
    const r = id ? await api('/api/admin/departments/' + id, { method: 'PUT', body: JSON.stringify(data) })
                 : await api('/api/admin/departments', { method: 'POST', body: JSON.stringify(data) });
    if (r.error) { toast(r.error, 'error'); return; }
    toast('Département enregistré');
    modal.remove();
    renderDepartments();
  });
}

// ============================================
// OBJECTIVES
// ============================================
let allObjsData = [];

async function renderObjectives() {
  renderLayout('Objectifs Stratégiques', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  allObjsData = await api('/api/admin/objectives');

  const cards = allObjsData.map(o => `
    <div class="objective-card" style="border-left-color:${o.color}">
      <button class="edit-btn" onclick="showObjModal(${o.id})"><i class="fas fa-edit"></i></button>
      <h3 style="color:${o.color}">${o.name}</h3>
      <p>${o.description || ''}</p>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;color:#6b7280">Cible :</span>
        <span style="font-weight:700;color:${o.color}">${o.target_percentage}%</span>
      </div>
      <span class="badge ${o.status==='Actif'?'badge-active':'badge-inactive'}">${o.status}</span>
    </div>`).join('');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-bullseye"></i><h2>Objectifs Stratégiques</h2></div>
    <button class="btn btn-primary" onclick="showObjModal()"><i class="fas fa-plus"></i> Nouvel objectif</button>
  </div>
  <div class="grid-auto">${cards}</div>`;
}

function showObjModal(id = null) {
  const o = id ? allObjsData.find(x => x.id === id) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">${id ? "Modifier l'objectif" : 'Nouvel objectif'}</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="obj-form">
      <div class="form-group"><label class="form-label">Nom</label><input class="form-control" id="o_name" value="${o?.name||''}" required></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="o_desc" rows="3">${o?.description||''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Couleur</label><input class="form-control" type="color" id="o_color" value="${o?.color||'#1e3a5f'}"></div>
        <div class="form-group"><label class="form-label">% Cible à atteindre</label><input class="form-control" type="number" id="o_target" min="0" max="100" value="${o?.target_percentage||0}"></div>
      </div>
      <div class="form-group"><label class="form-label">Statut</label>
        <select class="form-control" id="o_status">
          <option value="Actif" ${o?.status==='Actif'?'selected':''}>Actif</option>
          <option value="Inactif" ${o?.status==='Inactif'?'selected':''}>Inactif</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>Enregistrer</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('obj-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { name: document.getElementById('o_name').value, description: document.getElementById('o_desc').value, color: document.getElementById('o_color').value, target_percentage: parseFloat(document.getElementById('o_target').value), status: document.getElementById('o_status').value };
    const r = id ? await api('/api/admin/objectives/' + id, { method: 'PUT', body: JSON.stringify(data) })
                 : await api('/api/admin/objectives', { method: 'POST', body: JSON.stringify(data) });
    if (r.error) { toast(r.error, 'error'); return; }
    toast('Objectif enregistré');
    modal.remove();
    renderObjectives();
  });
}

// ============================================
// PROCESSES
// ============================================
let allProcsData = [], allProcsObjs = [];

async function renderProcesses() {
  renderLayout('Gestion des Processus', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  [allProcsData, allDepts, allProcsObjs] = await Promise.all([api('/api/admin/processes'), api('/api/admin/departments'), api('/api/admin/objectives')]);

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-sitemap"></i><h2>Gestion des Processus</h2></div>
    <button class="btn btn-primary" onclick="showProcModal()"><i class="fas fa-plus"></i> Nouveau processus</button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>PROCESSUS</th><th>DÉPARTEMENT</th><th>OBJECTIF</th><th>STATUT</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${allProcsData.map(p => `<tr>
              <td style="font-weight:600;color:#1e3a5f">${p.name}</td>
              <td><a style="color:#1e3a5f">${p.department_name}</a></td>
              <td><span class="badge badge-obj" style="background:${p.objective_color}">${p.objective_name}</span></td>
              <td><span class="badge ${p.status==='Actif'?'badge-active':'badge-inactive'}">${p.status}</span></td>
              <td><button class="btn btn-sm btn-outline" onclick="showProcModal(${p.id})"><i class="fas fa-edit"></i></button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function showProcModal(id = null) {
  const p = id ? allProcsData.find(x => x.id === id) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Processus</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="proc-form">
      <div class="form-group"><label class="form-label">Nom</label><input class="form-control" id="p_name" value="${p?.name||''}" required></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="p_desc" rows="2">${p?.description||''}</textarea></div>
      <div class="form-group"><label class="form-label">Département</label>
        <select class="form-control" id="p_dept">
          ${allDepts.map(d => `<option value="${d.id}" ${p?.department_id===d.id?'selected':''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Objectif Stratégique</label>
        <select class="form-control" id="p_obj">
          ${allProcsObjs.map(o => `<option value="${o.id}" ${p?.objective_id===o.id?'selected':''}>${o.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Statut</label>
        <select class="form-control" id="p_status">
          <option value="Actif" ${p?.status==='Actif'?'selected':''}>Actif</option>
          <option value="Inactif" ${p?.status==='Inactif'?'selected':''}>Inactif</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>Enregistrer</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('proc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { name: document.getElementById('p_name').value, description: document.getElementById('p_desc').value, department_id: document.getElementById('p_dept').value, objective_id: document.getElementById('p_obj').value, status: document.getElementById('p_status').value };
    const r = id ? await api('/api/admin/processes/' + id, { method: 'PUT', body: JSON.stringify(data) })
                 : await api('/api/admin/processes', { method: 'POST', body: JSON.stringify(data) });
    if (r.error) { toast(r.error, 'error'); return; }
    toast('Processus enregistré');
    modal.remove();
    renderProcesses();
  });
}

// ============================================
// TASKS
// ============================================
let allTasksData = [], allTasksProcs = [], allTasksObjs = [];

async function renderTasks() {
  renderLayout('Gestion des Tâches', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  [allTasksData, allDepts, allTasksProcs, allTasksObjs] = await Promise.all([
    api('/api/admin/tasks'), api('/api/admin/departments'),
    api('/api/admin/processes'), api('/api/admin/objectives')
  ]);

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-tasks"></i><h2>Gestion des Tâches Prédéfinies</h2></div>
    <button class="btn btn-primary" onclick="showTaskModal()"><i class="fas fa-plus"></i> Nouvelle tâche</button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>TÂCHE</th><th>PROCESSUS</th><th>DÉPARTEMENT</th><th>OBJECTIF</th><th>TYPE</th><th>STATUT</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${allTasksData.map(t => `<tr>
              <td>
                <div style="font-weight:600;color:#1e3a5f">${t.name}</div>
                <div style="font-size:11px;color:#9ca3af">${t.description||''}</div>
              </td>
              <td><a style="color:#1e3a5f">${t.process_name}</a></td>
              <td>${t.department_name}</td>
              <td><span class="badge badge-obj" style="background:${t.objective_color}">${t.objective_name}</span></td>
              <td><span class="badge ${t.task_type==='Productive'?'badge-active':'badge-inactive'}">${t.task_type}</span></td>
              <td><span class="badge ${t.status==='Actif'?'badge-active':'badge-inactive'}">${t.status}</span></td>
              <td><button class="btn btn-sm btn-outline" onclick="showTaskModal(${t.id})"><i class="fas fa-edit"></i></button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function showTaskModal(id = null) {
  const t = id ? allTasksData.find(x => x.id === id) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Tâche</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="task-form">
      <div class="form-group"><label class="form-label">Nom de la tâche</label><input class="form-control" id="t_name" value="${t?.name||''}" required></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" id="t_desc" rows="2">${t?.description||''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Département</label>
          <select class="form-control" id="t_dept" onchange="filterProcessesByDept(this.value)">
            ${allDepts.map(d => `<option value="${d.id}" ${t?.department_id===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Processus</label>
          <select class="form-control" id="t_proc">
            ${allTasksProcs.filter(p => !t || p.department_id == t.department_id).map(p => `<option value="${p.id}" ${t?.process_id===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Objectif Stratégique</label>
        <select class="form-control" id="t_obj">
          ${allTasksObjs.map(o => `<option value="${o.id}" ${t?.objective_id===o.id?'selected':''}>${o.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Productive ?</label>
          <select class="form-control" id="t_type">
            <option value="Productive" ${t?.task_type==='Productive'?'selected':''}>Productive</option>
            <option value="Non productive" ${t?.task_type==='Non productive'?'selected':''}>Non productive</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Statut</label>
          <select class="form-control" id="t_status">
            <option value="Actif" ${t?.status==='Actif'?'selected':''}>Actif</option>
            <option value="Inactif" ${t?.status==='Inactif'?'selected':''}>Inactif</option>
          </select>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save mr-1"></i>Enregistrer</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { name: document.getElementById('t_name').value, description: document.getElementById('t_desc').value, department_id: document.getElementById('t_dept').value, process_id: document.getElementById('t_proc').value, objective_id: document.getElementById('t_obj').value, task_type: document.getElementById('t_type').value, status: document.getElementById('t_status').value };
    const r = id ? await api('/api/admin/tasks/' + id, { method: 'PUT', body: JSON.stringify(data) })
                 : await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(data) });
    if (r.error) { toast(r.error, 'error'); return; }
    toast('Tâche enregistrée');
    modal.remove();
    renderTasks();
  });
}

function filterProcessesByDept(deptId) {
  const sel = document.getElementById('t_proc');
  sel.innerHTML = allTasksProcs.filter(p => p.department_id == deptId).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// ============================================
// REPORTS
// ============================================
async function renderReports() {
  renderLayout('Rapports & Export', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  const data = await api('/api/admin/reports');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-chart-bar"></i><h2>Rapports & Export</h2></div>
    <button class="btn btn-primary" onclick="exportCSV(window.reportsData,'rapports')">
      <i class="fas fa-file-csv"></i> Exporter CSV
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>AGENT</th><th>DÉPARTEMENT</th><th>TÂCHE</th><th>PROCESSUS</th><th>OBJECTIF</th><th>DATE</th><th>HEURES</th><th>STATUT</th></tr></thead>
          <tbody>
            ${data.map(r => `<tr>
              <td style="font-weight:600;color:#1e3a5f">${r.agent_name}</td>
              <td>${r.department_name}</td>
              <td>${r.task_name}</td>
              <td>${r.process_name}</td>
              <td><span class="badge badge-obj" style="background:${r.objective_color}">${r.objective_name}</span></td>
              <td>${formatDateShort(r.start_time)}</td>
              <td style="font-weight:700">${minutesToHours(r.duration_minutes || 0)}</td>
              <td>${getStatusBadge(r.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  window.reportsData = data;
}

// ============================================
// AUDIT
// ============================================
async function renderAudit() {
  renderLayout("Journal d'Audit", '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  const logs = await api('/api/admin/audit');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-file-alt"></i><h2>Journal d'Audit</h2></div>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>DATE/HEURE</th><th>UTILISATEUR</th><th>ACTION</th><th>DÉTAILS</th></tr></thead>
          <tbody>
            ${logs.map(l => `<tr>
              <td style="font-size:12px;color:#1e3a5f">${formatDate(l.created_at)}</td>
              <td style="font-weight:600;color:#1e3a5f">${l.user_name || '-'}</td>
              <td>${getAuditBadge(l.action)}</td>
              <td style="font-size:12px;color:#6b7280">${l.details || ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function getAuditBadge(action) {
  const map = {
    'LOGIN': ['action-login', 'LOGIN'],
    'LOGIN_FAILED': ['action-rejet', 'ÉCHEC'],
    'VALIDATION': ['action-validation', 'VALIDATION'],
    'REJET': ['action-rejet', 'REJET'],
    'CREATE_USER': ['action-create', 'CRÉATION'],
    'UPDATE_USER': ['action-update', 'MODIF.'],
    'DELETE': ['action-delete', 'SUPPRESSION']
  };
  const [cls, label] = map[action] || ['action-login', action];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

// ============================================
// RENDER PAGE
// ============================================
function renderPage(page) {
  destroyCharts();
  const p = page || getCurrentPage();
  if (p === 'dashboard') renderDashboard();
  else if (p === 'sessions') renderSessions();
  else if (p === 'users') renderUsers();
  else if (p === 'departments') renderDepartments();
  else if (p === 'objectives') renderObjectives();
  else if (p === 'processes') renderProcesses();
  else if (p === 'tasks') renderTasks();
  else if (p === 'reports') renderReports();
  else if (p === 'audit') renderAudit();
  else renderDashboard();
}

// Init
renderPage();
window.addEventListener('popstate', () => renderPage());
