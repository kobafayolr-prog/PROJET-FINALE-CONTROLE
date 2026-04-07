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

/**
 * Modal de confirmation personnalisé
 * Usage : showConfirmDialog('Message ?', 'Nom élément').then(ok => { if(ok) ... })
 */
function showConfirmDialog(message, itemName) {
  return new Promise(resolve => {
    // Supprimer un éventuel ancien modal
    const old = document.getElementById('confirm-dialog-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease';

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.25);text-align:center">
        <div style="width:56px;height:56px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <i class="fas fa-trash-alt" style="font-size:22px;color:#dc2626"></i>
        </div>
        <h3 style="font-size:17px;font-weight:700;color:#111827;margin-bottom:8px">Confirmer la suppression</h3>
        <p style="font-size:14px;color:#6b7280;margin-bottom:6px">${message}</p>
        ${itemName ? `<p style="font-size:13px;font-weight:600;color:#1e3a5f;background:#f0f4ff;padding:6px 12px;border-radius:6px;display:inline-block;margin-bottom:4px">« ${itemName} »</p>` : ''}
        <p style="font-size:12px;color:#9ca3af;margin-bottom:24px">Cette action ne peut pas être annulée.</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="confirm-no"  style="flex:1;padding:10px 20px;border:2px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;font-size:14px;font-weight:600;cursor:pointer">Annuler</button>
          <button id="confirm-yes" style="flex:1;padding:10px 20px;border:none;border-radius:8px;background:#dc2626;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Oui, supprimer</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Fermer avec Echap
    const onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); } };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('#confirm-no').onclick  = () => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(false); };
    overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(true); };
  });
}

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
  t.innerHTML = '<i class="fas fa-' + (icons[type] || 'check-circle') + ' mr-2"></i>' + msg;
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

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {}
  localStorage.clear();
  window.location = '/login';
}

// ============================================
// NOTIFICATIONS (polling toutes les 30s)
// ============================================
let _notifSince = new Date().toISOString();
let _notifInterval = null;

function startNotifPolling() {
  if (_notifInterval) return;
  _notifInterval = setInterval(pollNotifications, 30000);
}

async function pollNotifications() {
  try {
    const r = await fetch('/api/notifications?since=' + encodeURIComponent(_notifSince), { headers: { 'Authorization': 'Bearer ' + token } });
    if (!r.ok) return;
    const items = await r.json();
    _notifSince = new Date().toISOString();
    items.forEach(n => {
      if (n.status === 'Terminé') {
        toast(`Nouvelle session à valider — ${n.agent_name}: ${n.task_name}`, 'info');
      }
    });
    if (items.length > 0) updateNotifBadge(items.length);
  } catch(e) {}
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = count; badge.style.display = 'inline-block'; }
}

// ============================================
// RECHERCHE GLOBALE
// ============================================

/**
 * Recherche globale : filtre les lignes du tableau actif en temps réel.
 * Fonctionne sur toutes les pages : utilisateurs, sessions, départements,
 * objectifs, processus, tâches, audit.
 */
function handleGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  const page = getCurrentPage();

  // Pages avec tableau standard (tr dans tbody)
  const tablePages = ['users', 'sessions', 'departments', 'objectives', 'processes', 'tasks', 'audit'];

  if (tablePages.includes(page)) {
    // Chercher dans tous les tbody visibles
    const tbodies = document.querySelectorAll('#content tbody');
    tbodies.forEach(tbody => {
      const rows = tbody.querySelectorAll('tr');
      let visibleCount = 0;
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const match = q === '' || text.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      // Afficher un message si aucun résultat
      const emptyRow = tbody.querySelector('.search-empty-row');
      if (emptyRow) emptyRow.remove();
      if (visibleCount === 0 && q !== '') {
        const colspan = tbody.closest('table')?.querySelectorAll('thead th').length || 5;
        const tr = document.createElement('tr');
        tr.className = 'search-empty-row';
        tr.innerHTML = `<td colspan="${colspan}" style="text-align:center;color:#9ca3af;padding:24px;font-style:italic">
          <i class="fas fa-search" style="margin-right:8px"></i>Aucun résultat pour « ${query} »
        </td>`;
        tbody.appendChild(tr);
      }
    });
    return;
  }

  // Page départements (cartes au lieu de tableau)
  if (page === 'departments') {
    const cards = document.querySelectorAll('#content .dept-card');
    cards.forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = (q === '' || text.includes(q)) ? '' : 'none';
    });
    return;
  }

  // Page dashboard ou reports : pas de filtrage
}

// Vider la recherche quand on change de page
function clearSearch() {
  const input = document.getElementById('globalSearch');
  if (input) input.value = '';
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
  clearSearch();
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
      <div class="logo-text"><h2>TimeTrack</h2><p>BGFIBank CA</p></div>
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
        <i class="fas fa-chart-pie"></i> Catégories 3-3-3
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
      <div class="sidebar-search">
        <input type="text" id="globalSearch" placeholder="🔍 Rechercher..." oninput="handleGlobalSearch(this.value)" autocomplete="off">
      </div>
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

// Mois sélectionnés pour le filtre comparatif
let adminMonth1 = new Date().toISOString().slice(0, 7);
let adminMonth2 = '';

async function renderDashboard() {
  renderLayout('Administration', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  await loadDashboardStats();
}

async function loadDashboardStats() {
  const m2Param = adminMonth2 ? `&month2=${adminMonth2}` : '';
  const stats = await api(`/api/admin/stats?month=${adminMonth1}${m2Param}`);
  const totalMin = stats.hoursByObjective.reduce((s, o) => s + o.total_minutes, 0);
  const totalHours = minutesToHours(totalMin);

  // ── Helpers 333
  const C333 = { 'Production': '#1e3a5f', 'Administration & Reporting': '#f59e0b', 'Contrôle': '#10b981' };
  const I333 = { 'Production': 'fa-briefcase', 'Administration & Reporting': 'fa-file-alt', 'Contrôle': 'fa-check-circle' };

  function render333Rows(data, label) {
    if (!data || !data.length) return `<div style="color:#9ca3af;font-size:13px;padding:12px 0">Aucune donnée — ${label}</div>`;
    return data.map(r => {
      const color = C333[r.label] || '#6b7280';
      const pct2 = stats.ratio333Month2 ? (stats.ratio333Month2.find(x=>x.label===r.label)?.percentage || 0) : null;
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="width:12px;height:12px;border-radius:3px;background:${color};flex-shrink:0"></span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:12px;color:#374151"><i class="fas ${I333[r.label]||'fa-circle'}" style="margin-right:4px;color:${color}"></i>${r.label}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
            <div style="flex:1;background:#e5e7eb;border-radius:3px;height:7px;overflow:hidden">
              <div style="width:${r.percentage}%;background:${color};height:7px;border-radius:3px"></div>
            </div>
            <span style="font-weight:700;color:${color};font-size:13px;width:36px">${r.percentage}%</span>
            <span style="color:#9ca3af;font-size:11px">${r.hours_display}</span>
            ${pct2 !== null ? `<span style="font-size:11px;color:#6b7280;margin-left:4px">(${label==='Mois 2'?pct2:pct2}% M2)</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function deptCapHtml(dept) {
    // Utilise capacity_minutes mensuelle réelle (jours ouvrés × agents × 8h)
    // Fallback : si absent, on ne peut pas calculer la capacité mensuelle depuis ici
    const capMin = dept.capacity_minutes || (dept.agent_count * 480); // fallback jour unique si pas de données mensuelle
    const npMin  = Math.max(0, capMin - dept.total_minutes);
    const npPct  = capMin > 0 ? Math.round((npMin / capMin) * 100) : 0;
    const pMin   = dept.Production || 0;
    const aMin   = dept['Administration & Reporting'] || 0;
    const cMin   = dept['Contrôle'] || 0;
    const repPct = dept.total_minutes > 0 ? Math.round(((aMin + cMin) / dept.total_minutes) * 100) : 0;
    return `<div style="font-size:11px;color:#6b7280;margin-top:4px">
      ${dept.agent_count} agent(s) · Cap. mensuelle ${minutesToHours(capMin)} · Non-prod: <b style="color:#ef4444">${minutesToHours(npMin)}</b> (${npPct}%)
      · Reporting+Ctrl: <b style="color:#f59e0b">${repPct}%</b>
    </div>`;
  }

  function agentCapHtml(ag) {
    // Capacité mensuelle de l'agent (tient compte samedi si works_saturday)
    const capMin = ag.capacity_minutes || 480; // fallback 1 jour si pas de données mensuelle
    const npMin  = Math.max(0, capMin - ag.total_minutes);
    const npPct  = capMin > 0 ? Math.round((npMin / capMin) * 100) : 0;
    const aMin   = ag['Administration & Reporting'] || 0;
    const cMin   = ag['Contrôle'] || 0;
    const repPct = ag.total_minutes > 0 ? Math.round(((aMin + cMin) / ag.total_minutes) * 100) : 0;
    return `<small style="color:#9ca3af"> · Cap. mens. ${minutesToHours(capMin)} · Non-prod: <b style="color:#ef4444">${minutesToHours(npMin)}</b> (${npPct}%) · Reporting: <b style="color:#f59e0b">${repPct}%</b></small>`;
  }

  document.getElementById('content').innerHTML = `

  <!-- ══ FILTRE PÉRIODE ══ -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 18px">
      <i class="fas fa-calendar-alt" style="color:#1e3a5f;font-size:16px"></i>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 1</label>
        <input type="month" id="filterM1" value="${adminMonth1}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#1e3a5f;outline:none">
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 2 (comparaison)</label>
        <input type="month" id="filterM2" value="${adminMonth2}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#6b7280;outline:none">
        <button onclick="document.getElementById('filterM2').value='';adminMonth2='';loadDashboardStats()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px" title="Effacer">✕</button>
      </div>
      <button onclick="adminMonth1=document.getElementById('filterM1').value;adminMonth2=document.getElementById('filterM2').value;loadDashboardStats()"
        style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:13px;font-weight:600;cursor:pointer">
        <i class="fas fa-search" style="margin-right:6px"></i>Appliquer
      </button>
      ${stats.month2 ? `<span style="background:#eff6ff;color:#1e3a5f;font-size:12px;padding:4px 10px;border-radius:6px;font-weight:600"><i class="fas fa-code-branch" style="margin-right:4px"></i>Comparaison : ${stats.month} vs ${stats.month2}</span>` : `<span style="color:#9ca3af;font-size:12px">Période : <b>${stats.month}</b></span>`}
    </div>
  </div>

  <!-- ══ BANDEAU ALERTES 3-3-3 ══ -->
  ${(() => {
    const alerts = (stats.hoursByObjective||[]).filter(o => {
      const ecart = o.percentage - o.target_percentage;
      return ecart > 5 || ecart < -5;
    });
    if (!alerts.length) return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <i class="fas fa-check-circle" style="color:#16a34a;font-size:18px"></i>
      <span style="color:#15803d;font-size:13px;font-weight:600">Toutes les catégories 3-3-3 sont dans les cibles ce mois-ci.</span>
    </div>`;
    return `<div style="background:#fff;border-radius:10px;padding:12px 18px;margin-bottom:16px;border-left:4px solid #ef4444;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:16px"></i>
        <span style="font-weight:700;color:#1e3a5f;font-size:14px">Alertes 3-3-3 — ${alerts.length} catégorie(s) hors cible</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${alerts.map(o => {
          const ecart = o.percentage - o.target_percentage;
          const over = ecart > 0;
          const severe = Math.abs(ecart) > 10;
          const bg = severe ? (over ? '#fee2e2' : '#fef9c3') : (over ? '#fff7ed' : '#fffbeb');
          const col = severe ? (over ? '#dc2626' : '#b45309') : '#d97706';
          const icon = over ? 'fa-arrow-up' : 'fa-arrow-down';
          return `<div style="background:${bg};border-radius:8px;padding:6px 14px;display:flex;align-items:center;gap:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${o.color};display:inline-block"></span>
            <span style="font-weight:600;color:#1e3a5f;font-size:13px">${o.name}</span>
            <span style="color:${col};font-size:12px;font-weight:700"><i class="fas ${icon}"></i> ${over?'+':''}${ecart}% vs cible ${o.target_percentage}%</span>
            ${severe ? '<span style="font-size:10px;background:'+col+';color:#fff;padding:1px 6px;border-radius:4px;font-weight:700">⚠ CRITIQUE</span>' : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  })()}

  <!-- ══ RANGÉE 1 : Productivité du jour ══ -->
  <div class="grid-2" style="margin-bottom:20px">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-line" style="color:#1e3a5f"></i> Tendance Mensuelle</div>
      <canvas id="chartTrend" height="200"></canvas>
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Productivité du Jour ${stats.is_weekend ? '<span style="background:#fef3c7;color:#92400e;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px"><i class="fas fa-moon"></i> Week-end</span>' : '(base 8h/agent)'}</div>
      ${stats.is_weekend ? `<div style="text-align:center;padding:30px;color:#92400e;background:#fef9c3;border-radius:10px">
        <i class="fas fa-calendar-times" style="font-size:28px;display:block;margin-bottom:8px"></i>
        <div style="font-weight:700">Week-end — Aucune journée attendue</div></div>` : `
      <div style="display:flex;align-items:center;gap:20px">
        <div style="flex:1"><canvas id="chartProductivity" height="220"></canvas></div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:8px;text-align:center">${stats.productivity.total_agents} agent(s) · Cap. ${Math.floor(stats.productivity.total_capacity_today/60)}h</div>
          <div style="padding:8px;background:#f0fdf4;border-radius:8px;text-align:center;margin-bottom:6px">
            <div style="font-size:16px;font-weight:800;color:#16a34a">${stats.productivity.validated_hours_today||stats.productivity.productive_hours_today}</div>
            <div style="font-size:10px;color:#6b7280">Validées (${stats.productivity.validated_pct||stats.productivity.productive_pct}%)</div>
          </div>
          <div style="padding:8px;background:#fffbeb;border-radius:8px;text-align:center;margin-bottom:6px">
            <div style="font-size:16px;font-weight:800;color:#d97706">${stats.productivity.pending_hours_today||'0h 00m'}</div>
            <div style="font-size:10px;color:#6b7280">En attente (${stats.productivity.pending_pct||0}%)</div>
          </div>
          <div style="padding:8px;background:#fee2e2;border-radius:8px;text-align:center">
            <div style="font-size:16px;font-weight:800;color:#dc2626">${stats.productivity.non_productive_hours_today}</div>
            <div style="font-size:10px;color:#6b7280">Non pointées (${stats.productivity.non_productive_pct}%)</div>
          </div>
        </div>
      </div>`}
    </div>
  </div>

  <!-- ══ RANGÉE 2 : Méthode 3-3-3 ══ -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f"></i> Méthode 3-3-3 — Répartition du temps${stats.month2 ? ` <span style="font-size:12px;font-weight:400;color:#6b7280">(${stats.month} vs ${stats.month2})</span>` : ` <span style="font-size:12px;font-weight:400;color:#6b7280">${stats.month}</span>`}</div>
      <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;margin-top:12px">
        <!-- Pie chart Mois 1 -->
        <div style="text-align:center;flex:0 0 auto">
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">${stats.month}</div>
          <canvas id="chart333M1" width="180" height="180"></canvas>
        </div>
        ${stats.month2 ? `
        <!-- Pie chart Mois 2 -->
        <div style="text-align:center;flex:0 0 auto">
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">${stats.month2}</div>
          <canvas id="chart333M2" width="180" height="180"></canvas>
        </div>` : ''}
        <!-- Légende + détails -->
        <div style="flex:1;min-width:220px">
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">${stats.month}</div>
          ${render333Rows(stats.ratio333, 'Mois 1')}
          ${stats.month2 ? `<div style="height:1px;background:#e5e7eb;margin:14px 0"></div>
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">${stats.month2}</div>
          ${render333Rows(stats.ratio333Month2||[], 'Mois 2')}` : ''}
          <div style="margin-top:14px;padding:10px 14px;background:#eff6ff;border-radius:8px;border-left:4px solid #1e3a5f">
            <div style="font-size:11px;color:#1e3a5f;font-weight:600"><i class="fas fa-info-circle" style="margin-right:4px"></i>Efficience Production</div>
            <div style="font-size:20px;font-weight:800;color:#1e3a5f;margin-top:3px">
              ${(stats.ratio333||[]).find(r=>r.label==='Production')?.percentage||0}%
              ${stats.ratio333Month2 ? `<span style="font-size:13px;color:#6b7280;font-weight:400"> → ${(stats.ratio333Month2||[]).find(r=>r.label==='Production')?.percentage||0}%</span>` : ''}
            </div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">Objectif : ≥ 70% en Production</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ RANGÉE 3 : Comparaison par Département ══ -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f"></i> Comparaison par Département — Productif vs Non-productif${stats.month2 ? ` <span style="font-size:12px;font-weight:400;color:#6b7280">(${stats.month} vs ${stats.month2})</span>` : ''}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151"><span style="width:14px;height:14px;border-radius:3px;background:#1e3a5f;display:inline-block"></span> Heures productives (tout ce qui est pointé)</span>
        <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151"><span style="width:14px;height:14px;border-radius:3px;background:#ef444480;display:inline-block"></span> Heures non-productives (absence / non pointé)</span>
      </div>
      <canvas id="chartDeptBar" height="${stats.month2 ? 260 : 200}"></canvas>
      <!-- Tableau récap heures non-productives par département -->
      <div style="margin-top:16px;overflow-x:auto">
        <table style="width:100%;font-size:12px">
          <thead><tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left">DÉPARTEMENT</th>
            <th style="padding:8px;text-align:center">AGENTS</th>
            <th style="padding:8px;text-align:center;color:#1e3a5f">PRODUCTION</th>
            <th style="padding:8px;text-align:center;color:#f59e0b">ADMIN & REPORTING</th>
            <th style="padding:8px;text-align:center;color:#10b981">CONTRÔLE</th>
            <th style="padding:8px;text-align:center;color:#ef4444">NON PRODUCTIF</th>
            <th style="padding:8px;text-align:center">CAPACITÉ</th>
          </tr></thead>
          <tbody>
            ${(stats.deptComparison||[]).map(d => {
              const cap = d.capacity_minutes || d.agent_count * (stats.working_days||22) * 480;
              const np  = Math.max(0, cap - d.total_minutes);
              const npPct = cap > 0 ? Math.round(np/cap*100) : 0;
              const aMin = d['Administration & Reporting']||0;
              const cMin = d['Contrôle']||0;
              const repPct = d.total_minutes > 0 ? Math.round((aMin+cMin)/d.total_minutes*100) : 0;
              return `<tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:8px;font-weight:600">${d.dept_name}</td>
                <td style="padding:8px;text-align:center">${d.agent_count}</td>
                <td style="padding:8px;text-align:center;color:#1e3a5f;font-weight:700">${minutesToHours(d.Production||0)}</td>
                <td style="padding:8px;text-align:center;color:#f59e0b;font-weight:700">
                  ${minutesToHours(aMin)}
                  <div style="font-size:10px;color:#9ca3af">${repPct}% du total</div>
                </td>
                <td style="padding:8px;text-align:center;color:#10b981;font-weight:700">${minutesToHours(cMin)}</td>
                <td style="padding:8px;text-align:center">
                  <span style="font-weight:700;color:#ef4444">${minutesToHours(np)}</span>
                  <div style="font-size:10px;color:#9ca3af">${npPct}% cap.</div>
                </td>
                <td style="padding:8px;text-align:center;color:#6b7280">${minutesToHours(cap)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ══ RANGÉE 4 : Comparaison par Agent ══ -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-users" style="color:#1e3a5f"></i> Comparaison par Agent — Productif vs Non-productif${stats.month2 ? ` <span style="font-size:12px;font-weight:400;color:#6b7280">(${stats.month} vs ${stats.month2})</span>` : ''}</div>
      <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151"><span style="width:14px;height:14px;border-radius:3px;background:#1e3a5f;display:inline-block"></span> Heures productives (tout ce qui est pointé)</span>
        <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151"><span style="width:14px;height:14px;border-radius:3px;background:#ef444480;display:inline-block"></span> Heures non-productives (base 8h/jour)</span>
      </div>
      <canvas id="chartAgentBar" height="${Math.max(180, (stats.agentComparison||[]).length * (stats.month2?40:28))}"></canvas>
    </div>
  </div>

  <!-- ══ RANGÉE 5 : Productivité par Agent aujourd'hui ══ -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-user-clock" style="color:#1e3a5f"></i> Productivité par Agent — Aujourd'hui ${stats.is_weekend ? '(Week-end)' : '(base 8h)'}</div>
      ${stats.is_weekend ? '<div style="text-align:center;padding:20px;color:#9ca3af">Aucun calcul de productivité les week-ends</div>' : `
      <div style="overflow-x:auto"><table style="width:100%">
        <thead><tr>
          <th>AGENT</th><th>DÉPARTEMENT</th>
          <th style="color:#16a34a">✅ VALIDÉES</th>
          <th style="color:#d97706">⏳ EN ATTENTE</th>
          <th style="color:#ef4444">❌ NON POINTÉES</th>
          <th>PROGRESSION</th><th>STATUT</th>
        </tr></thead>
        <tbody>
          ${(stats.productivity.agents_detail||[]).map(a => {
            const pct = a.productive_pct;
            const valMin = a.validated_minutes||0;
            const pendMin = a.pending_minutes||0;
            const color = pct>=80?'#16a34a':(pct>=50?'#f59e0b':'#dc2626');
            const badge = pct>=80?'badge-active':(pct>=50?'badge-warning':'badge-inactive');
            const label = pct>=80?'Bon':(pct>=50?'Moyen':'Faible');
            const valW = Math.round((valMin/480)*100);
            const pendW = Math.round((pendMin/480)*100);
            return `<tr>
              <td style="font-weight:600">${a.agent_name}</td>
              <td style="color:#6b7280;font-size:12px">${a.department_name||'—'}</td>
              <td><span style="font-weight:700;color:#16a34a">${a.validated_hours||a.productive_hours}</span> <span style="font-size:10px;color:#9ca3af">(${a.validated_pct||a.productive_pct}%)</span></td>
              <td><span style="font-weight:700;color:#d97706">${a.pending_hours||'0h 00m'}</span> <span style="font-size:10px;color:#9ca3af">(${a.pending_pct||0}%)</span></td>
              <td><span style="font-weight:700;color:#dc2626">${a.non_pointed_hours||a.non_productive_hours}</span> <span style="font-size:10px;color:#9ca3af">(${a.non_productive_pct}%)</span></td>
              <td style="min-width:130px">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="flex:1;height:9px;background:#f3f4f6;border-radius:5px;overflow:hidden;display:flex">
                    <div style="height:100%;width:${valW}%;background:#22c55e"></div>
                    <div style="height:100%;width:${pendW}%;background:#f59e0b"></div>
                  </div>
                  <span style="font-size:12px;font-weight:700;color:${color}">${pct}%</span>
                </div>
              </td>
              <td><span class="badge ${badge}">${label}</span></td>
            </tr>`;
          }).join('')}
          ${!(stats.productivity.agents_detail||[]).length ? '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:20px">Aucun agent actif</td></tr>' : ''}
        </tbody>
      </table></div>`}
    </div>
  </div>

  <!-- ══ RANGÉE 6 : Objectifs 3-3-3 ══ -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-body">
      <div class="chart-title"><i class="fas fa-bullseye" style="color:#1e3a5f"></i> Objectifs Banque — Méthode 3-3-3 (Cible vs Réalisé)</div>
      <table style="width:100%">
        <thead><tr>
          <th>CATÉGORIE</th><th>HEURES RÉALISÉES</th><th>% RÉALISÉ</th><th>% CIBLE</th><th>ÉCART</th><th>BARRE</th>
        </tr></thead>
        <tbody>
          ${(stats.hoursByObjective||[]).map(o => {
            const ecart = o.percentage - o.target_percentage;
            const ecartClass = ecart>=0?'pct-ok':(ecart>-10?'pct-warning':'pct-danger');
            return `<tr>
              <td><span class="badge badge-obj" style="background:${o.color}">${o.name}</span></td>
              <td style="font-weight:700">${o.hours_display}</td>
              <td><span style="font-weight:700;color:${o.color}">${o.percentage}%</span></td>
              <td style="color:#6b7280">${o.target_percentage}%</td>
              <td class="${ecartClass}">${ecart>=0?'+':''}${ecart}%</td>
              <td style="min-width:120px">
                <div class="progress-bar"><div class="progress-fill" style="width:${o.percentage}%;background:${o.color}"></div></div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // ── Initialiser tous les graphiques
  destroyCharts();

  // Tendance mensuelle
  if (stats.monthlyTrend && stats.monthlyTrend.length > 0) {
    adminCharts.trend = new Chart(document.getElementById('chartTrend'), {
      type: 'line',
      data: {
        labels: stats.monthlyTrend.map(m => m.month).reverse(),
        datasets: [{ data: stats.monthlyTrend.map(m => (m.total_minutes/60).toFixed(2)).reverse(), borderColor: '#1e3a5f', backgroundColor: 'rgba(30,58,95,0.1)', tension: 0.4, fill: true, label: 'Heures' }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v+'h' } } } }
    });
  }

  // Donut productivité
  if (!stats.is_weekend && document.getElementById('chartProductivity')) {
    const cap = stats.productivity.total_capacity_today || 1;
    adminCharts.productivity = new Chart(document.getElementById('chartProductivity'), {
      type: 'doughnut',
      data: {
        labels: ['Validées', 'En attente', 'Non pointées'],
        datasets: [{ data: [stats.productivity.validated_minutes_today||0, stats.productivity.pending_minutes_today||0, stats.productivity.non_productive_minutes_today||0], backgroundColor: ['#22c55e','#f59e0b','#ef4444'], borderWidth: 2 }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const h=Math.floor(ctx.raw/60),m=ctx.raw%60; return ` ${h}h${String(m).padStart(2,'0')} (${Math.round(ctx.raw/cap*100)}%)`; } } } }, cutout: '60%' }
    });
  }

  // Pie chart 3-3-3 Mois 1
  if (stats.ratio333 && stats.ratio333.length && document.getElementById('chart333M1')) {
    adminCharts.chart333M1 = new Chart(document.getElementById('chart333M1'), {
      type: 'pie',
      data: { labels: stats.ratio333.map(r=>r.label), datasets: [{ data: stats.ratio333.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const r=stats.ratio333[ctx.dataIndex]; return ` ${r.hours_display} (${r.percentage}%)`; } } } } }
    });
  }

  // Pie chart 3-3-3 Mois 2
  if (stats.ratio333Month2 && stats.ratio333Month2.length && document.getElementById('chart333M2')) {
    adminCharts.chart333M2 = new Chart(document.getElementById('chart333M2'), {
      type: 'pie',
      data: { labels: stats.ratio333Month2.map(r=>r.label), datasets: [{ data: stats.ratio333Month2.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => { const r=stats.ratio333Month2[ctx.dataIndex]; return ` ${r.hours_display} (${r.percentage}%)`; } } } } }
    });
  }

  // ── Barre empilée par Département : UNE SEULE barre bicolore par département
  // Dataset 1 (bleu) = heures productives | Dataset 2 (rouge) = non-productives
  // Même stack ID → les deux se superposent sur la même barre
  if (stats.deptComparison && stats.deptComparison.length && document.getElementById('chartDeptBar')) {
    const depts   = stats.deptComparison;
    const deptsM2 = stats.deptComparisonMonth2 || [];
    const labels  = depts.map(d => d.dept_name.replace('Direction ','Dir. ').replace('Département','Dept'));

    // Précalcul des capacités par département pour les pourcentages (capacité mensuelle réelle)
    const deptCapMap = {};
    depts.forEach(d => { deptCapMap[d.dept_name] = (d.capacity_minutes || d.agent_count * (stats.working_days||22) * 480) / 60; });

    const mkDeptDs = (src, moisLabel, stackId, wd) => {
      const wdFinal = wd || stats.working_days || 22;
      return [
        {
          label: 'Heures productives' + moisLabel,
          data: src.map(d => +(d.total_minutes / 60).toFixed(2)),
          backgroundColor: '#1e3a5f',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes || d.agent_count * wdFinal * 480) / 60)
        },
        {
          label: 'Heures non-productives' + moisLabel,
          data: src.map(d => {
            const cap = (d.capacity_minutes || d.agent_count * wdFinal * 480) / 60;
            return +(Math.max(0, cap - d.total_minutes / 60).toFixed(2));
          }),
          backgroundColor: '#ef4444cc',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes || d.agent_count * wdFinal * 480) / 60)
        }
      ];
    };

    // Sans mois2 → stack unique → 1 barre bicolore par département
    // Avec mois2 → 2 stacks distincts → 2 barres bicolores côte à côte par département
    const datasets = mkDeptDs(depts, stats.month2 ? ' ('+stats.month+')' : '', 'M1', stats.working_days);
    if (deptsM2.length) datasets.push(...mkDeptDs(deptsM2, ' ('+stats.month2+')', 'M2', stats.working_days_month2));

    adminCharts.deptBar = new Chart(document.getElementById('chartDeptBar'), {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 14, padding: 16 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const cap = ctx.dataset._cap ? ctx.dataset._cap[ctx.dataIndex] : 8;
                const pct = cap > 0 ? Math.round(val / cap * 100) : 0;
                const h = Math.floor(val), m = Math.round((val - h) * 60);
                return ` ${ctx.dataset.label} : ${h}h ${String(m).padStart(2,'0')}m  (${pct}% des ${cap}h cap.)`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { callback: v => v + 'h' }, grid: { color: '#f3f4f6' } },
          y: { stacked: true, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // ── Barre empilée par Agent : UNE SEULE barre bicolore par agent
  // Capacité = jours_ouvrables_du_mois × 8h (donné par l'API via capacity_minutes)
  if (stats.agentComparison && stats.agentComparison.length && document.getElementById('chartAgentBar')) {
    const agents   = stats.agentComparison;
    const agentsM2 = stats.agentComparisonMonth2 || [];
    const agLabels = agents.map(a => a.agent_name);

    const mkAgentDs = (src, moisLabel, stackId) => [
      {
        label: 'Heures productives' + moisLabel,
        data: src.map(a => +(a.total_minutes / 60).toFixed(2)),
        backgroundColor: '#1e3a5f',
        stack: stackId,
        _cap: src.map(a => a.capacity_minutes / 60)  // capacité mensuelle en heures
      },
      {
        label: 'Heures non-productives' + moisLabel,
        data: src.map(a => +(Math.max(0, a.capacity_minutes / 60 - a.total_minutes / 60).toFixed(2))),
        backgroundColor: '#ef4444cc',
        stack: stackId,
        _cap: src.map(a => a.capacity_minutes / 60)
      }
    ];

    const agDatasets = mkAgentDs(agents, stats.month2 ? ' ('+stats.month+')' : '', 'M1');
    if (agentsM2.length) agDatasets.push(...mkAgentDs(agentsM2, ' ('+stats.month2+')', 'M2'));

    adminCharts.agentBar = new Chart(document.getElementById('chartAgentBar'), {
      type: 'bar',
      data: { labels: agLabels, datasets: agDatasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 14, padding: 16 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const capH = ctx.dataset._cap ? ctx.dataset._cap[ctx.dataIndex] : 8;
                const pct = capH > 0 ? Math.round(val / capH * 100) : 0;
                const h = Math.floor(val), m = Math.round((val - h) * 60);
                const capHf = Math.floor(capH), capMf = Math.round((capH - capHf) * 60);
                return ` ${ctx.dataset.label} : ${h}h ${String(m).padStart(2,'0')}m  — ${pct}% de la cap. mensuelle (${capHf}h${capMf>0?String(capMf).padStart(2,'0')+'m':''})`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { callback: v => v + 'h' }, grid: { color: '#f3f4f6' } },
          y: { stacked: true, ticks: { font: { size: 11 } } }
        }
      }
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
            <th>DATE</th><th>DURÉE</th><th>STATUT</th><th>MOTIF REJET</th>
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
              <td>${s.rejected_reason ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;padding:3px 8px;border-radius:5px;display:inline-block;max-width:200px;word-break:break-word"><i class="fas fa-comment-alt" style="margin-right:4px"></i>${s.rejected_reason}</span>` : '<span style="color:#d1d5db;font-size:11px">—</span>'}</td>
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

  // Enrichissement pour les sessions : ajout colonnes calculées + % productivité par agent/mois
  let enriched = data;
  if (name === 'sessions' || name === 'rapports') {
    // 1ère passe : agréger par agent+mois (sessions validées)
    const agentMonthMap = {};
    data.forEach(r => {
      if (r.status !== 'Validé') return;
      const agName = r.agent_name || r.user_name || '';
      const key = `${agName}|${(r.start_time||'').slice(0,7)}`;
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
      const agName = r.agent_name || r.user_name || '';
      const key = `${agName}|${mois}`;
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

  // Colonnes lisibles (remplacer les noms techniques)
  const labelMap = {
    agent_name: 'Agent', dept_name: 'Département', department_name: 'Département',
    task_name: 'Tâche', process_name: 'Processus', objective_name: 'Objectif',
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
          <thead><tr><th>NOM</th><th>EMAIL</th><th>RÔLE</th><th>DÉPARTEMENT</th><th style="text-align:center">SAMEDI</th><th>STATUT</th><th>DERNIÈRE CONNEXION</th><th>ACTIONS</th></tr></thead>
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
                <td style="text-align:center">${u.works_saturday ? '<span title="Travaille le samedi" style="color:#1e3a5f;font-size:16px">✅</span>' : '<span title="Ne travaille pas le samedi" style="color:#d1d5db;font-size:16px">—</span>'}</td>
                <td><span class="badge ${u.status==='Actif'?'badge-active':'badge-inactive'}">${u.status}</span></td>
                <td>${formatDate(u.last_login)}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-sm btn-outline" onclick="showUserModal(${u.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-sm" style="margin-left:4px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d" onclick="showResetCodeModal(${u.id}, '${u.first_name} ${u.last_name}')" title="Générer code reset"><i class="fas fa-key"></i></button>
                  ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${u.first_name} ${u.last_name}')" style="margin-left:4px" title="D\u00e9sactiver"><i class="fas fa-trash"></i></button>` : ''}
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
  const cls = role === 'Administrateur' ? 'role-admin' : role === 'Chef de Département' ? 'role-chef' : role === 'Chef de Service' ? 'role-chef-service' : role === 'Directeur de Département' ? 'role-dir-dept' : role === 'Directeur Général' ? 'role-dg' : 'role-agent';
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
        <div style="position:relative">
          <input class="form-control" type="password" id="u_pwd" placeholder="••••••••" ${!userId ? 'required' : ''} style="padding-right:40px">
          <button type="button" onclick="togglePwdVisibility('u_pwd', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Rôle</label>
          <select class="form-control" id="u_role">
            <option value="Agent" ${user?.role==='Agent'?'selected':''}>Agent</option>
            <option value="Chef de Service" ${user?.role==='Chef de Service'?'selected':''}>Chef de Service</option>
            <option value="Chef de Département" ${user?.role==='Chef de Département'?'selected':''}>Chef de Département</option>
            <option value="Directeur de Département" ${user?.role==='Directeur de Département'?'selected':''}>Directeur de Département</option>
            <option value="Directeur Général" ${user?.role==='Directeur Général'?'selected':''}>Directeur Général</option>
            <option value="Administrateur" ${user?.role==='Administrateur'?'selected':''}>Administrateur</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Département</label>
          <select class="form-control" id="u_dept">
            <option value="">-- Aucun --</option>${deptsOptions}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Statut</label>
          <select class="form-control" id="u_status">
            <option value="Actif" ${user?.status==='Actif'?'selected':''}>Actif</option>
            <option value="Inactif" ${user?.status==='Inactif'?'selected':''}>Inactif</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Travaille le samedi</label>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
              <div style="position:relative;display:inline-block;width:44px;height:24px">
                <input type="checkbox" id="u_saturday" ${user?.works_saturday ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute">
                <span id="u_saturday_track" style="position:absolute;inset:0;background:${user?.works_saturday ? '#1e3a5f' : '#d1d5db'};border-radius:24px;transition:.3s;cursor:pointer" onclick="this.style.background=document.getElementById('u_saturday').checked?'#d1d5db':'#1e3a5f';document.getElementById('u_saturday').checked=!document.getElementById('u_saturday').checked"></span>
                <span style="position:absolute;left:${user?.works_saturday ? '22px' : '2px'};top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.3s;pointer-events:none" id="u_saturday_thumb"></span>
              </div>
              <span id="u_saturday_label" style="color:${user?.works_saturday ? '#1e3a5f' : '#6b7280'};font-weight:${user?.works_saturday ? '600' : '400'}">${user?.works_saturday ? 'Oui' : 'Non'}</span>
            </label>
          </div>
        </div>
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
    const pwd = document.getElementById('u_pwd').value;
    // Validation côté client : minimum 8 caractères si un mot de passe est saisi
    if (!userId && pwd.length < 8) { toast('Mot de passe trop court (minimum 8 caractères)', 'error'); return; }
    if (userId && pwd && pwd.length < 8) { toast('Mot de passe trop court (minimum 8 caractères)', 'error'); return; }
    const data = {
      first_name: document.getElementById('u_first').value,
      last_name: document.getElementById('u_last').value,
      email: document.getElementById('u_email').value,
      password: pwd,
      role: document.getElementById('u_role').value,
      department_id: document.getElementById('u_dept').value || null,
      status: document.getElementById('u_status').value,
      works_saturday: document.getElementById('u_saturday').checked
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

// Suppression processus + tâches
async function deleteProcess(id, name) {
  name = name || id;
  const ok = await showConfirmDialog('Voulez-vous vraiment désactiver ce processus ?', name);
  if (!ok) return;
  const r = await api('/api/admin/processes/' + id, { method: 'DELETE' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Processus désactivé');
  renderProcesses();
}

async function deleteTask(id, name) {
  name = name || id;
  const ok = await showConfirmDialog('Voulez-vous vraiment désactiver cette tâche ?', name);
  if (!ok) return;
  const r = await api('/api/admin/tasks/' + id, { method: 'DELETE' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Tâche désactivée');
  renderTasks();
}

async function deleteUser(id, name) {
  const ok = await showConfirmDialog('Voulez-vous vraiment désactiver cet utilisateur ?', name || '');
  if (!ok) return;
  const r = await api('/api/admin/users/' + id, { method: 'DELETE' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Utilisateur désactivé');
  renderUsers();
}

// Générer un code de réinitialisation de mot de passe
async function showResetCodeModal(userId, userName) {
  const result = await api('/api/auth/reset-request', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  if (result.error) { toast(result.error, 'error'); return; }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-key mr-2"></i>Code de réinitialisation</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div style="padding:20px">
      <div style="margin-bottom:12px;font-size:14px;color:#374151">
        Transmettez ce code à <strong>${result.user_name}</strong> :<br>
        <span style="font-size:12px;color:#6b7280">(valable 30 minutes)</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:16px;background:#f0fdf4;border:2px solid #22c55e;border-radius:10px;margin-bottom:14px">
        <span id="reset-code-val" style="font-size:28px;font-weight:900;letter-spacing:6px;color:#15803d;font-family:monospace">${result.code}</span>
        <button onclick="navigator.clipboard.writeText('${result.code}').then(()=>toast('Code copié !'))" style="background:none;border:none;cursor:pointer;color:#15803d;font-size:18px" title="Copier">
          <i class="fas fa-copy"></i>
        </button>
      </div>
      <div style="padding:10px;background:#fef3c7;border-radius:6px;font-size:12px;color:#92400e;margin-bottom:14px">
        <i class="fas fa-info-circle mr-1"></i>
        L'utilisateur devra entrer ce code + son nouveau mot de passe sur la page de connexion.
      </div>
      <div style="text-align:right">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fermer</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

// Afficher/masquer le mot de passe dans le formulaire
function togglePwdVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
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
      <div style="position:absolute;top:12px;right:12px;display:flex;gap:4px">
        <button onclick="showDeptModal(${d.id})" style="background:rgba(0,0,0,0.05);border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;color:#6b7280" title="Modifier"><i class="fas fa-edit" style="font-size:11px"></i></button>
        <button class="btn-delete-dept" data-id="${d.id}" data-name="${d.name}" style="background:rgba(239,68,68,0.1);border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;color:#ef4444" title="Désactiver"><i class="fas fa-trash" style="font-size:11px;pointer-events:none"></i></button>
      </div>
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

  // Attacher les événements de suppression après rendu DOM
  document.querySelectorAll('.btn-delete-dept').forEach(btn => {
    btn.addEventListener('click', () => deleteDept(btn.dataset.id, btn.dataset.name));
  });
}

async function deleteDept(id, name) {
  name = name || id;
  const ok = await showConfirmDialog('Voulez-vous vraiment désactiver ce département ?', name);
  if (!ok) return;
  const r = await api('/api/admin/departments/' + id, { method: 'DELETE' });
  if (r.error) { toast(r.error, 'error'); return; }
  toast('Département désactivé');
  renderDepartments();
}

function _keepRenderDepartments() { // alias factice pour éviter doublon
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
  renderLayout('Catégories 3-3-3', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');

  // Récupérer les catégories depuis l'API (avec leurs cibles réelles en DB) + stats du mois
  const month = new Date().toISOString().slice(0,7);
  const [objsFromDB, stats] = await Promise.all([
    api('/api/admin/objectives'),
    api(`/api/admin/stats?month=${month}`)
  ]);
  const ratio = stats.ratio333 || [];

  // Métadonnées fixes (icône, description)
  const META = {
    'Production':                 { icon: 'fa-briefcase',    desc: 'Activités directement productives : traitement des opérations, service client, production bancaire.' },
    'Administration & Reporting': { icon: 'fa-file-alt',     desc: 'Activités administratives, reporting, réunions, formation et tâches de support.' },
    'Contrôle':                   { icon: 'fa-check-circle', desc: 'Activités de contrôle, audit, conformité, supervision et vérification.' }
  };

  // Ordre fixe
  const ORDER = ['Production', 'Administration & Reporting', 'Contrôle'];
  const objs = ORDER.map(name => objsFromDB.find(o => o.name === name)).filter(Boolean);

  const cards = objs.map(o => {
    const meta   = META[o.name] || { icon: 'fa-circle', desc: '' };
    const r      = ratio.find(x => x.label === o.name) || { percentage: 0, hours_display: '0h 00m', minutes: 0 };
    const ecart  = r.percentage - o.target_percentage;
    const ecartColor = ecart >= 0 ? '#16a34a' : (ecart > -15 ? '#f59e0b' : '#ef4444');
    return `
    <div style="border-radius:14px;border:2px solid ${o.color}30;background:#fff;padding:24px;position:relative;box-shadow:0 2px 10px ${o.color}15">
      <!-- En-tête : icône + nom + bouton modifier -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="width:48px;height:48px;border-radius:12px;background:${o.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas ${meta.icon}" style="color:${o.color};font-size:20px"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800;color:${o.color}">${o.name}</div>
          <div style="font-size:11px;color:#9ca3af">Catégorie 3-3-3 · Cible : <b style="color:${o.color}">${o.target_percentage}%</b></div>
        </div>
        <button onclick="showEditTargetModal(${o.id},'${o.name.replace(/'/g,"\\'")}',${ o.target_percentage},'${o.color}')"
          style="background:${o.color}10;border:1.5px solid ${o.color}40;color:${o.color};border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">
          <i class="fas fa-sliders-h"></i> Modifier la cible
        </button>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:16px;line-height:1.5">${meta.desc}</p>
      <!-- KPIs -->
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <div style="text-align:center;flex:1;padding:10px;background:${o.color}08;border-radius:8px">
          <div style="font-size:18px;font-weight:800;color:${o.color}">${r.hours_display}</div>
          <div style="font-size:10px;color:#9ca3af">Réalisé ce mois</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:#f9fafb;border-radius:8px">
          <div style="font-size:18px;font-weight:800;color:${o.color}">${r.percentage}%</div>
          <div style="font-size:10px;color:#9ca3af">% Réalisé</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:#eff6ff;border-radius:8px">
          <div style="font-size:18px;font-weight:800;color:#1e3a5f">${o.target_percentage}%</div>
          <div style="font-size:10px;color:#9ca3af">% Cible</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:${ecartColor}10;border-radius:8px">
          <div style="font-size:18px;font-weight:800;color:${ecartColor}">${ecart>=0?'+':''}${ecart}%</div>
          <div style="font-size:10px;color:#9ca3af">Écart</div>
        </div>
      </div>
      <!-- Barre de progression avec marqueur cible -->
      <div style="position:relative;margin-bottom:4px">
        <div style="background:#f3f4f6;border-radius:6px;height:10px;overflow:hidden">
          <div style="height:100%;width:${Math.min(r.percentage,100)}%;background:${o.color};border-radius:6px;transition:width .5s"></div>
        </div>
        <!-- Marqueur cible -->
        <div style="position:absolute;top:-3px;left:${o.target_percentage}%;transform:translateX(-50%);width:2px;height:16px;background:#374151;border-radius:2px" title="Cible : ${o.target_percentage}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:10px;color:#9ca3af">
        <span>0%</span>
        <span style="color:#374151;font-weight:600">▲ Cible : ${o.target_percentage}%</span>
        <span>100%</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-chart-pie"></i><h2>Méthode 3-3-3 — Catégories & Objectifs</h2></div>
    <span style="background:#f0fdf4;color:#16a34a;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600">
      <i class="fas fa-edit" style="margin-right:4px"></i>Cibles modifiables
    </span>
  </div>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#1e40af">
    <i class="fas fa-info-circle" style="margin-right:6px"></i>
    Ces 3 catégories constituent les objectifs de BGFIBank CA selon la <b>méthode 3-3-3</b>.
    Les <b>noms et IDs sont fixes</b> mais les <b>cibles (%) sont ajustables</b> à tout moment via le bouton « Modifier la cible ».
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px">
    ${cards}
  </div>`;
}

// Modal pour modifier uniquement la cible d'une catégorie 3-3-3
function showEditTargetModal(id, name, currentTarget, color) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal" style="max-width:420px">
    <div class="modal-header" style="border-left:4px solid ${color}">
      <span class="modal-title" style="color:${color}"><i class="fas fa-sliders-h" style="margin-right:8px"></i>Modifier la cible — ${name}</span>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div style="padding:20px">
      <div style="background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#6b7280">
        <i class="fas fa-info-circle" style="color:${color};margin-right:6px"></i>
        Définissez le pourcentage cible pour la catégorie <b style="color:${color}">${name}</b>.
        La somme des 3 cibles doit idéalement être égale à <b>100%</b>.
      </div>
      <div class="form-group">
        <label class="form-label">Cible en % <span style="color:#9ca3af;font-weight:400">(valeur actuelle : ${currentTarget}%)</span></label>
        <div style="display:flex;align-items:center;gap:12px">
          <input class="form-control" type="number" id="edit_target_val" min="1" max="99" value="${currentTarget}"
            style="font-size:22px;font-weight:800;color:${color};text-align:center;max-width:100px" oninput="updateTargetPreview(this.value,'${color}')">
          <span style="font-size:22px;font-weight:800;color:${color}">%</span>
          <div style="flex:1">
            <input type="range" id="edit_target_range" min="1" max="99" value="${currentTarget}"
              style="width:100%;accent-color:${color}"
              oninput="document.getElementById('edit_target_val').value=this.value;updateTargetPreview(this.value,'${color}')">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af"><span>1%</span><span>99%</span></div>
          </div>
        </div>
      </div>
      <!-- Prévisualisation barre -->
      <div style="margin:12px 0 8px;font-size:12px;color:#6b7280">Aperçu :</div>
      <div style="background:#f3f4f6;border-radius:6px;height:12px;overflow:hidden">
        <div id="target_preview_bar" style="height:100%;width:${currentTarget}%;background:${color};border-radius:6px;transition:width .2s"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
        <button class="btn btn-primary" style="background:${color};border-color:${color}" onclick="saveTarget(${id},'${name.replace(/'/g,"\\'")}')"><i class="fas fa-save" style="margin-right:6px"></i>Enregistrer</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  // Sync slider ↔ input
  document.getElementById('edit_target_val').addEventListener('input', function() {
    document.getElementById('edit_target_range').value = this.value;
  });
}

function updateTargetPreview(val, color) {
  const bar = document.getElementById('target_preview_bar');
  if (bar) { bar.style.width = Math.min(Math.max(val,0),100) + '%'; bar.style.background = color; }
}

async function saveTarget(id, name) {
  const val = parseInt(document.getElementById('edit_target_val').value);
  if (isNaN(val) || val < 1 || val > 99) { toast('Valeur invalide (1-99%)', 'error'); return; }
  // Récupérer les données complètes de l'objectif avant de le modifier
  const objs = await api('/api/admin/objectives');
  const o = objs.find(x => x.id === id);
  if (!o) { toast('Catégorie introuvable', 'error'); return; }
  const r = await api('/api/admin/objectives/' + id, {
    method: 'PUT',
    body: JSON.stringify({ name: o.name, description: o.description, color: o.color, target_percentage: val, status: o.status })
  });
  if (r.error) { toast(r.error, 'error'); return; }
  toast(`Cible ${name} mise à jour : ${val}%`);
  document.querySelector('.modal-overlay')?.remove();
  renderObjectives();
}

async function deleteObjective(id, name) {
  toast('Les catégories 3-3-3 ne peuvent pas être supprimées.', 'error');
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
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" onclick="showProcModal(${p.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger btn-delete-proc" style="margin-left:4px" data-id="${p.id}" data-name="${p.name}" title="Désactiver"><i class="fas fa-trash" style="pointer-events:none"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('.btn-delete-proc').forEach(btn => {
    btn.addEventListener('click', () => deleteProcess(btn.dataset.id, btn.dataset.name));
  });
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
      <div class="form-group"><label class="form-label">Catégorie 3-3-3</label>
        <select class="form-control" id="p_obj">
          <option value="10" ${(!p?.objective_id||p?.objective_id===10)?'selected':''}>🔵 Production</option>
          <option value="11" ${p?.objective_id===11?'selected':''}>🟡 Administration & Reporting</option>
          <option value="12" ${p?.objective_id===12?'selected':''}>🟢 Contrôle</option>
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
          <thead><tr><th>TÂCHE</th><th>PROCESSUS</th><th>ACTIVITÉS</th><th>OBJECTIF</th><th>TYPE</th><th>STATUT</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${allTasksData.map(t => `<tr>
              <td>
                <div style="font-weight:600;color:#1e3a5f">${t.name}</div>
                <div style="font-size:11px;color:#9ca3af">${t.description||''}</div>
              </td>
              <td><a style="color:#1e3a5f">${t.process_name}</a></td>
              <td>${t.department_name}</td>
              <td><span class="badge badge-obj" style="background:${t.objective_color}">${t.objective_name}</span></td>
              <td><span class="badge ${t.task_type==='Production'||t.task_type==='Productive'?'badge-active':t.task_type==='Contr\u00f4le'?'badge-validation':'badge-inactive'}" style="font-size:11px">${t.task_type==='Productive'?'Production':t.task_type==='Non productive'?'Administration & Reporting':t.task_type||'Production'}</span></td>
              <td><span class="badge ${t.status==='Actif'?'badge-active':'badge-inactive'}">${t.status}</span></td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" onclick="showTaskModal(${t.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger btn-delete-task" style="margin-left:4px" data-id="${t.id}" data-name="${t.name}" title="Désactiver"><i class="fas fa-trash" style="pointer-events:none"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id, btn.dataset.name));
  });
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
        <div class="form-group"><label class="form-label">Activités</label>
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
      <input type="hidden" id="t_obj" value="${t?.objective_id||10}">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Catégorie 3-3-3 (= Objectif)</label>
          <select class="form-control" id="t_type" onchange="syncObjFromType(this.value)">
            <option value="Production" ${(!t?.task_type||t?.task_type==='Production'||t?.task_type==='Productive')?'selected':''}>🔵 Production</option>
            <option value="Administration & Reporting" ${(t?.task_type==='Administration & Reporting'||t?.task_type==='Non productive')?'selected':''}>🟡 Administration & Reporting</option>
            <option value="Contrôle" ${t?.task_type==='Contrôle'?'selected':''}>🟢 Contrôle</option>
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

// Synchronise l'objective_id caché selon la catégorie 3-3-3 choisie
// Production=10, Administration & Reporting=11, Contrôle=12
function syncObjFromType(type) {
  const map = { 'Production': 10, 'Administration & Reporting': 11, 'Contrôle': 12 };
  const el = document.getElementById('t_obj');
  if (el) el.value = map[type] || 10;
}

// ============================================
// REPORTS (avec filtres période + export CSV)
// ============================================
let _reportsDateFrom = '', _reportsDateTo = '', _reportsDept = '', _reportsStatus = '';

async function renderReports() {
  renderLayout('Rapports & Export', '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');
  const depts = await api('/api/admin/departments');

  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(); firstDay.setDate(1);
  const firstDayStr = firstDay.toISOString().split('T')[0];
  if (!_reportsDateFrom) _reportsDateFrom = firstDayStr;
  if (!_reportsDateTo)   _reportsDateTo   = today;

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-chart-bar"></i><h2>Rapports & Export</h2></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="downloadReportCSV()" title="Télécharger les données filtrées en CSV">
        <i class="fas fa-file-csv"></i> Exporter CSV
      </button>
      <button class="btn btn-outline" onclick="printReport()" title="Imprimer le rapport">
        <i class="fas fa-print"></i> Imprimer
      </button>
    </div>
  </div>
  <!-- FILTRES -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-body" style="padding:14px 20px">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Du</label>
          <input type="date" id="r_from" value="${_reportsDateFrom}" class="form-control" style="width:140px">
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Au</label>
          <input type="date" id="r_to" value="${_reportsDateTo}" class="form-control" style="width:140px">
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Département</label>
          <select id="r_dept" class="form-control" style="width:200px">
            <option value="">Tous</option>
            ${depts.map(d => `<option value="${d.id}" ${_reportsDept==d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Statut</label>
          <select id="r_status" class="form-control" style="width:130px">
            <option value="">Tous</option>
            <option value="Validé" ${_reportsStatus==='Validé'?'selected':''}>Validé</option>
            <option value="Terminé" ${_reportsStatus==='Terminé'?'selected':''}>Terminé</option>
            <option value="Rejeté" ${_reportsStatus==='Rejeté'?'selected':''}>Rejeté</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="applyReportFilters()" style="height:38px">
          <i class="fas fa-filter"></i> Filtrer
        </button>
        <button class="btn btn-outline" onclick="resetReportFilters()" style="height:38px">
          <i class="fas fa-times"></i> Réinitialiser
        </button>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-body">
      <div id="report-summary" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap"></div>
      <div class="table-wrapper">
        <table id="report-table">
          <thead><tr><th>AGENT</th><th>DÉPARTEMENT</th><th>TÂCHE</th><th>PROCESSUS</th><th>OBJECTIF</th><th>DATE</th><th>HEURES</th><th>TYPE</th><th>STATUT</th><th>MOTIF REJET</th></tr></thead>
          <tbody id="report-tbody"><tr><td colspan="10" style="text-align:center;color:#9ca3af"><i class="fas fa-spinner fa-spin"></i> Chargement...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>`;

  loadReportData();
}

async function loadReportData() {
  _reportsDateFrom = document.getElementById('r_from')?.value || _reportsDateFrom;
  _reportsDateTo   = document.getElementById('r_to')?.value   || _reportsDateTo;
  _reportsDept     = document.getElementById('r_dept')?.value  || '';
  _reportsStatus   = document.getElementById('r_status')?.value || '';

  let url = '/api/admin/reports?';
  if (_reportsDateFrom) url += 'date_from=' + _reportsDateFrom + '&';
  if (_reportsDateTo)   url += 'date_to='   + _reportsDateTo   + '&';
  if (_reportsDept)     url += 'dept_id='   + _reportsDept     + '&';
  if (_reportsStatus)   url += 'status='    + encodeURIComponent(_reportsStatus) + '&';

  const data = await api(url);
  window.reportsData = data;

  // Résumé
  const totalH = data.reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const validatedH = data.filter(r => r.status === 'Validé').reduce((s, r) => s + (r.duration_minutes || 0), 0);
  const summary = document.getElementById('report-summary');
  if (summary) summary.innerHTML = `
    <div style="padding:10px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
      <div style="font-size:20px;font-weight:800;color:#16a34a">${data.length}</div>
      <div style="font-size:11px;color:#6b7280">Sessions</div>
    </div>
    <div style="padding:10px 16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">
      <div style="font-size:20px;font-weight:800;color:#1d4ed8">${minutesToHours(totalH)}</div>
      <div style="font-size:11px;color:#6b7280">Heures totales</div>
    </div>
    <div style="padding:10px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
      <div style="font-size:20px;font-weight:800;color:#16a34a">${minutesToHours(validatedH)}</div>
      <div style="font-size:11px;color:#6b7280">Heures validées</div>
    </div>
    <div style="padding:10px 16px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a">
      <div style="font-size:20px;font-weight:800;color:#d97706">${data.filter(r=>r.status==='Rejeté').length}</div>
      <div style="font-size:11px;color:#6b7280">Rejetées</div>
    </div>`;

  const tbody = document.getElementById('report-tbody');
  if (tbody) tbody.innerHTML = data.length === 0
    ? '<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:20px">Aucune session pour cette période</td></tr>'
    : data.map(r => `<tr>
      <td style="font-weight:600;color:#1e3a5f">${r.agent_name}</td>
      <td>${r.department_name}</td>
      <td>${r.task_name}</td>
      <td>${r.process_name}</td>
      <td><span class="badge badge-obj" style="background:${r.objective_color}">${r.objective_name}</span></td>
      <td>${formatDateShort(r.start_time)}</td>
      <td style="font-weight:700">${minutesToHours(r.duration_minutes || 0)}</td>
      <td><span class="badge ${r.session_type==='Manuelle'?'badge-warning':'badge-info'}">${r.session_type}</span></td>
      <td>${getStatusBadge(r.status)}</td>
      <td>${r.rejected_reason ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;padding:3px 8px;border-radius:5px;display:inline-block"><i class="fas fa-comment-alt" style="margin-right:4px"></i>${r.rejected_reason}</span>` : '<span style="color:#d1d5db;font-size:11px">—</span>'}</td>
    </tr>`).join('');
}

function applyReportFilters() { loadReportData(); }
function resetReportFilters() {
  _reportsDateFrom = ''; _reportsDateTo = ''; _reportsDept = ''; _reportsStatus = '';
  renderReports();
}

function downloadReportCSV() {
  let url = '/api/admin/reports?export=csv&';
  if (_reportsDateFrom) url += 'date_from=' + _reportsDateFrom + '&';
  if (_reportsDateTo)   url += 'date_to='   + _reportsDateTo   + '&';
  if (_reportsDept)     url += 'dept_id='   + _reportsDept     + '&';
  if (_reportsStatus)   url += 'status='    + encodeURIComponent(_reportsStatus) + '&';
  // Téléchargement via lien avec token
  fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rapport_timetrack_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    });
}

function printReport() {
  const table = document.getElementById('report-table');
  if (!table) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Rapport TimeTrack – BGFIBank CA</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{color:#1e3a5f}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e3a5f;color:white;padding:8px;text-align:left;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}.footer{margin-top:20px;font-size:11px;color:#9ca3af;text-align:center}</style></head><body>
    <h2><img src="/static/bgfibank-logo.png" height="40" style="vertical-align:middle;margin-right:10px"> Rapport TimeTrack BGFIBank CA</h2>
    <p style="color:#6b7280">Période : ${_reportsDateFrom || '—'} au ${_reportsDateTo || '—'} — Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    ${table.outerHTML}
    <div class="footer">© ${new Date().getFullYear()} BGFIBank — Document confidentiel — TimeTrack</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ============================================
// AUDIT (avec filtres, export CSV)
// ============================================
async function renderAudit() {
  renderLayout("Journal d'Audit", '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>');

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7*24*3600*1000).toISOString().split('T')[0];

  document.getElementById('content').innerHTML = `
  <div class="page-header">
    <div class="page-title"><i class="fas fa-shield-alt"></i><h2>Journal d'Audit Sécurité</h2></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" onclick="downloadAuditCSV()">
        <i class="fas fa-file-csv"></i> Exporter CSV
      </button>
    </div>
  </div>
  <!-- Filtres -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-body" style="padding:14px 20px">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Du</label>
          <input type="date" id="a_from" value="${weekAgo}" class="form-control" style="width:140px">
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Au</label>
          <input type="date" id="a_to" value="${today}" class="form-control" style="width:140px">
        </div>
        <div>
          <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px">Action</label>
          <select id="a_action" class="form-control" style="width:160px">
            <option value="">Toutes</option>
            <option>LOGIN</option><option>LOGIN_FAILED</option><option>LOGOUT</option>
            <option>VALIDATION</option><option>REJET</option>
            <option>CREATE_USER</option><option>UPDATE_USER</option><option>DELETE</option>
            <option>RESET_PASSWORD_REQUEST</option><option>RESET_PASSWORD_DONE</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="loadAuditData()" style="height:38px">
          <i class="fas fa-filter"></i> Filtrer
        </button>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>DATE/HEURE</th><th>UTILISATEUR</th><th>ACTION</th><th>DÉTAILS</th><th>IP</th></tr></thead>
          <tbody id="audit-tbody"><tr><td colspan="5" style="text-align:center;color:#9ca3af"><i class="fas fa-spinner fa-spin"></i></td></tr></tbody>
        </table>
      </div>
    </div>
  </div>`;

  loadAuditData();
}

async function loadAuditData() {
  const from   = document.getElementById('a_from')?.value   || '';
  const to     = document.getElementById('a_to')?.value     || '';
  const action = document.getElementById('a_action')?.value || '';

  let url = '/api/admin/audit?';
  if (from)   url += 'date_from=' + from + '&';
  if (to)     url += 'date_to='   + to   + '&';
  if (action) url += 'action='    + encodeURIComponent(action) + '&';

  const logs = await api(url);
  window.auditData = { from, to, action };

  const tbody = document.getElementById('audit-tbody');
  if (tbody) tbody.innerHTML = logs.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px">Aucune entrée pour cette période</td></tr>'
    : logs.map(l => `<tr>
      <td style="font-size:12px;color:#1e3a5f;white-space:nowrap">${formatDate(l.created_at)}</td>
      <td style="font-weight:600;color:#1e3a5f">${l.user_name || '<span style="color:#9ca3af">Système</span>'}</td>
      <td>${getAuditBadge(l.action)}</td>
      <td style="font-size:12px;color:#6b7280;max-width:320px;overflow:hidden;text-overflow:ellipsis" title="${(l.details||'').replace(/"/g,'&quot;')}">${l.details || ''}</td>
      <td style="font-size:11px;color:#9ca3af;font-family:monospace">${l.ip_address || '-'}</td>
    </tr>`).join('');
}

function downloadAuditCSV() {
  const d = window.auditData || {};
  let url = '/api/admin/audit?export=csv&';
  if (d.from)   url += 'date_from=' + d.from + '&';
  if (d.to)     url += 'date_to='   + d.to   + '&';
  if (d.action) url += 'action='    + encodeURIComponent(d.action) + '&';
  fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'audit_timetrack_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    });
}

function getAuditBadge(action) {
  const map = {
    'LOGIN':                     ['action-login',      'LOGIN'],
    'LOGOUT':                    ['action-update',     'LOGOUT'],
    'LOGIN_FAILED':              ['action-rejet',      'ÉCHEC LOGIN'],
    'VALIDATION':                ['action-validation', 'VALIDATION'],
    'REJET':                     ['action-rejet',      'REJET'],
    'CREATE_USER':               ['action-create',     'CRÉATION'],
    'UPDATE_USER':               ['action-update',     'MODIF. USER'],
    'DELETE_DEPT':               ['action-delete',     'SUPPR. DEPT'],
    'DELETE_OBJECTIVE':          ['action-delete',     'SUPPR. OBJECTIF'],
    'DELETE_PROCESS':            ['action-delete',     'SUPPR. PROCESSUS'],
    'DELETE_TASK':               ['action-delete',     'SUPPR. TÂCHE'],
    'RESET_PASSWORD_REQUEST':    ['action-update',     'RESET MDP'],
    'RESET_PASSWORD_DONE':       ['action-create',     'MDP CHANGÉ']
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
startNotifPolling();

// Page de reset mot de passe (pour les agents qui ont un code)
function renderResetPassword() {
  // Cette fonction est accessible depuis la page login via un lien
  renderLayout('Réinitialisation du mot de passe', `
  <div style="max-width:440px;margin:40px auto">
    <div class="card">
      <div class="card-body">
        <h3 style="font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:16px">
          <i class="fas fa-key mr-2"></i>Changer votre mot de passe
        </h3>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-control" type="email" id="rp_email" placeholder="votre@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Code temporaire (fourni par l'admin)</label>
          <input class="form-control" id="rp_code" placeholder="ex: AB1C2D" style="letter-spacing:4px;font-weight:700">
        </div>
        <div class="form-group">
          <label class="form-label">Nouveau mot de passe</label>
          <input class="form-control" type="password" id="rp_newpwd" placeholder="Minimum 8 caractères">
        </div>
        <div id="rp_error" style="display:none;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:13px;color:#dc2626;margin-bottom:12px"></div>
        <div id="rp_ok" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;font-size:13px;color:#16a34a;margin-bottom:12px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-outline" onclick="window.location='/login'">Annuler</button>
          <button class="btn btn-primary" onclick="submitResetPassword()">
            <i class="fas fa-check mr-1"></i>Confirmer
          </button>
        </div>
      </div>
    </div>
  </div>`);
}

async function submitResetPassword() {
  const email  = document.getElementById('rp_email')?.value?.trim();
  const code   = document.getElementById('rp_code')?.value?.trim();
  const newpwd = document.getElementById('rp_newpwd')?.value;
  const err    = document.getElementById('rp_error');
  const ok     = document.getElementById('rp_ok');
  err.style.display = 'none'; ok.style.display = 'none';
  if (!email || !code || !newpwd) { err.textContent = 'Tous les champs sont requis'; err.style.display = 'block'; return; }
  if (newpwd.length < 8) { err.textContent = 'Mot de passe trop court (minimum 8 caractères)'; err.style.display = 'block'; return; }
  const r = await fetch('/api/auth/reset-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, new_password: newpwd }) });
  const d = await r.json();
  if (!r.ok) { err.textContent = d.error || 'Erreur'; err.style.display = 'block'; }
  else { ok.textContent = 'Mot de passe modifié avec succès ! Redirection...'; ok.style.display = 'block'; setTimeout(() => window.location = '/login', 2000); }
}
