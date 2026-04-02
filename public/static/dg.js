// ============================================
// TimeTrack BGFIBank - Directeur Général
// ============================================

const API = '';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let dgCharts = {};

// Auth check
if (!token || currentUser.role !== 'Directeur Général') {
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
  Object.values(dgCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  dgCharts = {};
}

// ============================================
// LAYOUT
// ============================================
function renderLayout(page, content) {
  const navItems = [
    { id: 'dashboard', icon: 'globe', label: 'Vue Globale' },
    { id: 'departements', icon: 'building', label: 'Départements' },
    { id: 'objectifs', icon: 'bullseye', label: 'Objectifs' },
    { id: 'efficience', icon: 'chart-pie', label: 'Efficience 3-3-3' },
    { id: 'tendance', icon: 'chart-line', label: 'Tendance' }
  ];
  document.getElementById('app').innerHTML = `
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <img src="/static/bgfibank-logo.png" alt="BGFIBank" style="height:36px;margin-right:10px">
        <div>
          <div style="font-weight:700;font-size:13px;color:#1e3a5f">TimeTrack</div>
          <div style="font-size:10px;color:#64748b">Direction Générale</div>
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
          <div class="user-avatar">${(currentUser.first_name||'D')[0]}${(currentUser.last_name||'G')[0]}</div>
          <div>
            <div style="font-weight:600;font-size:12px;color:white">${currentUser.first_name} ${currentUser.last_name}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5)">Directeur Général</div>
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
    case 'departements': renderDepartements(); break;
    case 'objectifs': renderObjectifs(); break;
    case 'efficience': renderEfficience(); break;
    case 'tendance': renderTendance(); break;
    default: renderDashboard();
  }
}

// ============================================
// DASHBOARD GLOBAL
// ============================================
async function renderDashboard() {
  renderLayout('dashboard', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement du tableau de bord global...</p></div>');
  const data = await api('/api/dg/dashboard');
  renderLayout('dashboard', `
  <div class="page-header">
    <div>
      <h2 class="page-title"><i class="fas fa-globe" style="color:#1e3a5f;margin-right:10px"></i>Direction Générale — BGFIBank CA</h2>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Vue consolidée de toute la banque — Lecture seule</div>
    </div>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>

  <!-- KPIs globaux -->
  <div class="kpi-grid">
    <div class="kpi-card kpi-blue">
      <div class="kpi-icon" style="background:#dbeafe;color:#1e40af"><i class="fas fa-users"></i></div>
      <div><div class="kpi-value">${data.total_users||0}</div><div class="kpi-label">Agents actifs (banque)</div></div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-icon" style="background:#dcfce7;color:#16a34a"><i class="fas fa-clock"></i></div>
      <div><div class="kpi-value">${data.total_hours_month||'0h 00m'}</div><div class="kpi-label">Heures validées ce mois</div></div>
    </div>
    <div class="kpi-card kpi-orange">
      <div class="kpi-icon" style="background:#fef3c7;color:#b45309"><i class="fas fa-hourglass-half"></i></div>
      <div><div class="kpi-value">${data.to_validate||0}</div><div class="kpi-label">Sessions en attente (banque)</div></div>
    </div>
    <div class="kpi-card kpi-purple">
      <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><i class="fas fa-building"></i></div>
      <div><div class="kpi-value">${data.byDept ? data.byDept.length : 0}</div><div class="kpi-label">Départements actifs</div></div>
    </div>
  </div>

  <!-- Charts globaux -->
  <div class="charts-grid">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f;margin-right:8px"></i>Heures par Département — Ce mois</div>
      ${data.byDept && data.byDept.length > 0 ? `<canvas id="dgChartDepts" height="250"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-bullseye" style="color:#1e3a5f;margin-right:8px"></i>Heures par Objectif Stratégique</div>
      ${data.byObjective && data.byObjective.length > 0 ? `<canvas id="dgChartObj" height="250"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
    </div>
  </div>

  <!-- Tableau résumé départements -->
  <div class="chart-card" style="margin-top:20px">
    <div class="chart-title"><i class="fas fa-table" style="color:#1e3a5f;margin-right:8px"></i>Résumé par Département</div>
    ${data.byDept && data.byDept.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Département</th><th>Agents</th><th>Heures ce mois</th><th>% de l'activité</th></tr></thead>
      <tbody>
        ${data.byDept.map(d => `<tr>
          <td style="font-weight:600;color:#1e3a5f">${d.dept_name}</td>
          <td>${d.agent_count}</td>
          <td>${d.hours_display||'0h 00m'}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:100px;background:#e5e7eb;border-radius:4px;height:6px">
                <div style="width:${d.percentage}%;background:#1e3a5f;height:6px;border-radius:4px"></div>
              </div>
              <span style="font-size:12px;font-weight:600">${d.percentage}%</span>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="empty-state">Aucun département actif.</p>'}
  </div>`);

  // Charts
  if (data.byDept && data.byDept.length > 0) {
    const ctx = document.getElementById('dgChartDepts');
    if (ctx) {
      dgCharts.depts = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.byDept.map(d => d.dept_name),
          datasets: [{ label: 'Heures', data: data.byDept.map(d => Math.round(d.total_minutes/60*10)/10), backgroundColor: '#1e3a5f' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }
  if (data.byObjective && data.byObjective.length > 0) {
    const ctx2 = document.getElementById('dgChartObj');
    if (ctx2) {
      dgCharts.obj = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: data.byObjective.map(o => o.name),
          datasets: [{ data: data.byObjective.map(o => o.total_minutes), backgroundColor: data.byObjective.map(o => o.color||'#1e3a5f') }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }
}

// ============================================
// DÉPARTEMENTS DÉTAILLÉS
// ============================================
async function renderDepartements() {
  renderLayout('departements', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dg/dashboard');
  renderLayout('departements', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-building" style="color:#1e3a5f;margin-right:10px"></i>Tous les Départements</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  ${data.byDept && data.byDept.length > 0 ? `
  <div class="dept-grid">
    ${data.byDept.map((d, i) => `
    <div class="dept-card">
      <div class="dept-card-header">
        <i class="fas fa-building" style="font-size:24px;opacity:0.6;margin-bottom:8px;display:block"></i>
        <div class="dept-name">${d.dept_name}</div>
        <div class="dept-agents">${d.agent_count} agent${d.agent_count>1?'s':''}</div>
      </div>
      <div class="dept-card-body">
        <div class="dept-stat">
          <span class="dept-stat-label">Heures ce mois</span>
          <span class="dept-stat-value">${d.hours_display||'0h 00m'}</span>
        </div>
        <div class="dept-stat">
          <span class="dept-stat-label">Part d'activité</span>
          <span class="dept-stat-value" style="color:${['#1e3a5f','#16a34a','#b45309','#7c3aed','#0369a1'][i%5]}">${d.percentage}%</span>
        </div>
        <div style="background:#e5e7eb;border-radius:4px;height:6px;margin-top:8px">
          <div style="width:${d.percentage}%;background:${['#1e3a5f','#16a34a','#b45309','#7c3aed','#0369a1'][i%5]};height:6px;border-radius:4px"></div>
        </div>
      </div>
    </div>`).join('')}
  </div>` : '<p class="empty-state">Aucun département actif.</p>'}
  `);
}

// ============================================
// OBJECTIFS STRATÉGIQUES
// ============================================
async function renderObjectifs() {
  renderLayout('objectifs', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dg/dashboard');
  renderLayout('objectifs', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-bullseye" style="color:#1e3a5f;margin-right:10px"></i>Objectifs Stratégiques — Banque</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  <div class="chart-card" style="margin-bottom:20px">
    <div class="chart-title">Répartition des heures par objectif</div>
    ${data.byObjective && data.byObjective.length > 0 ? `<canvas id="dgChartObj2" height="150"></canvas>` : '<p class="empty-state">Aucune donnée.</p>'}
  </div>
  ${data.byObjective && data.byObjective.length > 0 ? data.byObjective.map(o => `
  <div class="obj-card">
    <div class="obj-header" style="border-left-color:${o.color||'#1e3a5f'}">
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${o.color||'#1e3a5f'};flex-shrink:0"></span>
      <span style="font-size:15px;font-weight:700;color:#1e3a5f">${o.name}</span>
      <span style="margin-left:auto;font-size:18px;font-weight:800;color:${o.color||'#1e3a5f'}">${o.hours_display}</span>
    </div>
  </div>`).join('') : '<p class="empty-state">Aucun objectif actif.</p>'}
  `);
  if (data.byObjective && data.byObjective.length > 0) {
    const ctx = document.getElementById('dgChartObj2');
    if (ctx) {
      dgCharts.obj2 = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.byObjective.map(o => o.name),
          datasets: [{ label: 'Heures', data: data.byObjective.map(o => Math.round(o.total_minutes/60*10)/10), backgroundColor: data.byObjective.map(o => o.color||'#1e3a5f') }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }
}

// ============================================
// EFFICIENCE 3-3-3
// ============================================
async function renderEfficience() {
  renderLayout('efficience', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dg/dashboard');
  const r333 = data.ratio333 || [];
  const prodItem = r333.find(r => r.label === 'Production') || { percentage: 0, hours_display: '0h 00m', minutes: 0 };
  renderLayout('efficience', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-chart-pie" style="color:#1e3a5f;margin-right:10px"></i>Méthode 3-3-3 — Ratio d'Efficience Global</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f;margin-right:8px"></i>Répartition du Temps — Banque Entière</div>
      ${r333.length > 0 ? `<canvas id="dgChart333" height="280"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
      <div class="efficience-summary">
        <div class="efficience-pct ${prodItem.percentage>=70?'efficience-ok':prodItem.percentage>=50?'efficience-warning':'efficience-danger'}">
          ${prodItem.percentage}% Production
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Objectif : ≥ 70% de temps productif</div>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title"><i class="fas fa-list" style="color:#1e3a5f;margin-right:8px"></i>Détail par Catégorie</div>
      ${r333.map(r => {
        const colors = { 'Production': '#16a34a', 'Administration & Reporting': '#f59e0b', 'Contrôle': '#7c3aed' };
        const icons = { 'Production': 'briefcase', 'Administration & Reporting': 'file-alt', 'Contrôle': 'check-double' };
        const color = colors[r.label] || '#1e3a5f';
        const icon = icons[r.label] || 'circle';
        return `
        <div class="ratio-row">
          <div class="ratio-icon" style="background:${color}20;color:${color}"><i class="fas fa-${icon}"></i></div>
          <div class="ratio-info">
            <div class="ratio-label">${r.label}</div>
            <div class="ratio-bar">
              <div class="ratio-bar-fill" style="width:${r.percentage}%;background:${color}"></div>
            </div>
          </div>
          <div class="ratio-values">
            <div class="ratio-pct" style="color:${color}">${r.percentage}%</div>
            <div class="ratio-hours">${r.hours_display}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="chart-card" style="margin-top:20px">
    <div class="chart-title"><i class="fas fa-info-circle" style="color:#1e3a5f;margin-right:8px"></i>Interprétation — Méthode 3-3-3</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:8px">
      <div style="text-align:center;padding:16px;background:#f0fdf4;border-radius:8px">
        <i class="fas fa-briefcase" style="font-size:24px;color:#16a34a;margin-bottom:8px;display:block"></i>
        <div style="font-weight:700;color:#16a34a;font-size:15px">Production</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Activités à valeur directe<br>Objectif : 70% du temps</div>
      </div>
      <div style="text-align:center;padding:16px;background:#fef9c3;border-radius:8px">
        <i class="fas fa-file-alt" style="font-size:24px;color:#f59e0b;margin-bottom:8px;display:block"></i>
        <div style="font-weight:700;color:#f59e0b;font-size:15px">Administration & Reporting</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Gestion et rapports<br>Objectif : 20% du temps</div>
      </div>
      <div style="text-align:center;padding:16px;background:#f3e8ff;border-radius:8px">
        <i class="fas fa-check-double" style="font-size:24px;color:#7c3aed;margin-bottom:8px;display:block"></i>
        <div style="font-weight:700;color:#7c3aed;font-size:15px">Contrôle</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Vérification et conformité<br>Objectif : 10% du temps</div>
      </div>
    </div>
  </div>`);
  if (r333.length > 0) {
    const ctx = document.getElementById('dgChart333');
    if (ctx) {
      const colors333 = { 'Production': '#16a34a', 'Administration & Reporting': '#f59e0b', 'Contrôle': '#7c3aed' };
      dgCharts.ratio333 = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: r333.map(r => r.label),
          datasets: [{ data: r333.map(r => r.minutes), backgroundColor: r333.map(r => colors333[r.label]||'#1e3a5f') }]
        },
        options: {
          cutout: '60%', responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}min (${r333[ctx.dataIndex].percentage}%)` } }
          }
        }
      });
    }
  }
}

// ============================================
// TENDANCE MENSUELLE
// ============================================
async function renderTendance() {
  renderLayout('tendance', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  const data = await api('/api/dg/dashboard');
  const trend = (data.monthlyTrend || []).reverse();
  renderLayout('tendance', `
  <div class="page-header">
    <h2 class="page-title"><i class="fas fa-chart-line" style="color:#1e3a5f;margin-right:10px"></i>Tendance Mensuelle — Banque</h2>
    <div class="read-only-badge"><i class="fas fa-eye" style="margin-right:6px"></i>Lecture seule</div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Évolution des heures validées (6 derniers mois)</div>
    ${trend.length > 0 ? `<canvas id="dgChartTrend" height="200"></canvas>` : '<p class="empty-state">Aucune donnée disponible.</p>'}
  </div>
  ${trend.length > 0 ? `
  <div class="chart-card" style="margin-top:20px">
    <div class="chart-title">Détail mensuel</div>
    <table class="data-table">
      <thead><tr><th>Mois</th><th>Heures validées</th></tr></thead>
      <tbody>
        ${trend.map(t => `<tr>
          <td style="font-weight:600">${t.month}</td>
          <td>${minutesToDisplay(t.total_minutes)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}
  `);
  if (trend.length > 0) {
    const ctx = document.getElementById('dgChartTrend');
    if (ctx) {
      dgCharts.trend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trend.map(t => t.month),
          datasets: [{
            label: 'Heures validées',
            data: trend.map(t => Math.round(t.total_minutes/60*10)/10),
            borderColor: '#1e3a5f', backgroundColor: 'rgba(30,58,95,0.1)',
            fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#1e3a5f'
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }
}

// ============================================
// INIT
// ============================================
renderDashboard();
