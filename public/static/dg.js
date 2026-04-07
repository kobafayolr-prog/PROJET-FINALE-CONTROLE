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
let dgMonth1 = new Date().toISOString().slice(0,7);
let dgMonth2 = '';

async function renderDashboard() {
  renderLayout('dashboard', '<div class="loading"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Chargement...</p></div>');
  await loadDgDashboard();
}

async function loadDgDashboard() {
  const m2p = dgMonth2 ? `&month2=${dgMonth2}` : '';
  const data = await api(`/api/dg/dashboard?month=${dgMonth1}${m2p}`);
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

  <!-- Filtre période -->
  <div class="chart-card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:4px 0">
      <i class="fas fa-calendar-alt" style="color:#1e3a5f"></i>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 1</label>
        <input type="month" id="dgFilterM1" value="${dgMonth1}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#1e3a5f;outline:none">
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label style="font-size:13px;font-weight:600;color:#374151">Mois 2</label>
        <input type="month" id="dgFilterM2" value="${dgMonth2}" style="border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;color:#6b7280;outline:none">
        <button onclick="document.getElementById('dgFilterM2').value='';dgMonth2='';loadDgDashboard()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px" title="Effacer">✕</button>
      </div>
      <button onclick="dgMonth1=document.getElementById('dgFilterM1').value;dgMonth2=document.getElementById('dgFilterM2').value;loadDgDashboard()"
        style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:13px;font-weight:600;cursor:pointer">
        <i class="fas fa-search" style="margin-right:6px"></i>Appliquer
      </button>
      ${data.month2 ? `<span style="background:#eff6ff;color:#1e3a5f;font-size:12px;padding:4px 10px;border-radius:6px;font-weight:600"><i class="fas fa-code-branch" style="margin-right:4px"></i>${data.month||dgMonth1} vs ${data.month2}</span>` : `<span style="color:#9ca3af;font-size:12px">Période : <b>${data.month||dgMonth1}</b></span>`}
    </div>
  </div>

  <!-- Méthode 3-3-3 pie charts -->
  <div class="chart-card" style="margin-bottom:20px">
    <div class="chart-title"><i class="fas fa-chart-pie" style="color:#1e3a5f;margin-right:8px"></i>Méthode 3-3-3 — Répartition du Temps${data.month2?` <span style="font-size:12px;font-weight:400;color:#6b7280">(${data.month||dgMonth1} vs ${data.month2})</span>`:` <span style="font-size:12px;font-weight:400;color:#6b7280">${data.month||dgMonth1}</span>`}</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;margin-top:12px">
      <div style="text-align:center">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">${data.month||dgMonth1}</div>
        <canvas id="dgChart333M1" width="180" height="180"></canvas>
      </div>
      ${data.month2 ? `<div style="text-align:center">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:6px">${data.month2}</div>
        <canvas id="dgChart333M2" width="180" height="180"></canvas>
      </div>` : ''}
      <div style="flex:1;min-width:200px">
        ${(data.ratio333||[]).map(r => {
          const C = {'Production':'#1e3a5f','Administration & Reporting':'#f59e0b','Contrôle':'#10b981'};
          const color = C[r.label||r.type]||'#6b7280';
          const pct2 = data.month2&&data.ratio333Month2 ? (data.ratio333Month2.find(x=>(x.label||x.type)===(r.label||r.type))?.percentage||0) : null;
          const lbl = r.label||r.type;
          return `<div style="margin-bottom:12px">
            <div style="font-weight:600;font-size:12px;color:#374151">${lbl}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              <div style="flex:1;background:#e5e7eb;border-radius:3px;height:7px"><div style="width:${r.percentage}%;background:${color};height:7px;border-radius:3px"></div></div>
              <span style="font-weight:700;color:${color};font-size:12px;width:32px">${r.percentage}%</span>
              <span style="color:#9ca3af;font-size:11px">${r.hours_display}</span>
              ${pct2!==null?`<span style="color:#6b7280;font-size:11px">→ ${pct2}% M2</span>`:''}
            </div>
          </div>`;
        }).join('')}
        <div style="margin-top:12px;padding:10px 14px;background:#eff6ff;border-radius:8px;border-left:4px solid #1e3a5f">
          <div style="font-size:11px;color:#1e3a5f;font-weight:600"><i class="fas fa-info-circle" style="margin-right:4px"></i>Efficience Production</div>
          <div style="font-size:20px;font-weight:800;color:#1e3a5f;margin-top:3px">
            ${(data.ratio333||[]).find(r=>(r.label||r.type)==='Production')?.percentage||0}%
            ${data.month2&&data.ratio333Month2 ? `<span style="font-size:13px;color:#6b7280;font-weight:400"> → ${(data.ratio333Month2||[]).find(r=>(r.label||r.type)==='Production')?.percentage||0}%</span>` : ''}
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Objectif : ≥ 70% en Production</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══ ALERTES 3-3-3 DG ══ -->
  ${(() => {
    const alerts = (data.ratio333||[]).filter(r => {
      const targets = {'Production':70,'Administration & Reporting':20,'Contrôle':10};
      const tgt = targets[r.label||r.type]||0;
      return Math.abs(r.percentage - tgt) > 5;
    });
    if (!alerts.length) return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <i class="fas fa-check-circle" style="color:#16a34a;font-size:18px"></i>
      <span style="color:#15803d;font-size:13px;font-weight:600">Méthode 3-3-3 : toutes les catégories sont dans les cibles ce mois-ci.</span>
    </div>`;
    return `<div style="background:#fff;border-radius:10px;padding:12px 18px;margin-bottom:16px;border-left:4px solid #ef4444;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="font-weight:700;color:#1e3a5f;margin-bottom:8px"><i class="fas fa-exclamation-triangle" style="color:#ef4444;margin-right:6px"></i>Alertes 3-3-3 — ${alerts.length} catégorie(s) hors cible</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${alerts.map(r => {
          const targets = {'Production':70,'Administration & Reporting':20,'Contrôle':10};
          const tgt = targets[r.label||r.type]||0;
          const ecart = r.percentage - tgt;
          const col = ecart > 0 ? '#dc2626' : '#b45309';
          return `<div style="background:${ecart>0?'#fee2e2':'#fef9c3'};border-radius:8px;padding:6px 14px;font-size:12px">
            <b style="color:#1e3a5f">${r.label||r.type}</b>
            <span style="color:${col};font-weight:700;margin-left:8px">${ecart>0?'+':''}${ecart}%</span>
            <span style="color:#6b7280;margin-left:4px">vs cible ${tgt}%</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  })()}

  <!-- ══ CLASSEMENT DÉPARTEMENTS ══ -->
  ${(() => {
    const depts = [...(data.byDept333||data.deptComparison||data.byDept||[])];
    if (!depts.length) return '';
    // Trier par % productif décroissant — utilise capacity_minutes (mensuelle réelle)
    const sorted = depts.map(d => {
      const cap = d.capacity_minutes || (d.agent_count||0)*(data.working_days||22)*480;
      const pct = cap > 0 ? Math.round((d.total_minutes||0)*100/cap) : 0;
      const npPct = Math.max(0,100-pct);
      return {...d, pct_prod: pct, pct_np: npPct, cap_min: cap};
    }).sort((a,b) => b.pct_prod - a.pct_prod);
    const medals = ['🥇','🥈','🥉'];
    return `<div class="chart-card" style="margin-bottom:20px">
      <div class="chart-title"><i class="fas fa-trophy" style="color:#f59e0b;margin-right:8px"></i>Classement des Départements — Taux de Productivité Mensuel</div>
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:#f9fafb">
            <th style="padding:8px;text-align:center">#</th>
            <th style="padding:8px;text-align:left">DÉPARTEMENT</th>
            <th style="padding:8px;text-align:center">AGENTS</th>
            <th style="padding:8px;text-align:center">HEURES POINTÉES</th>
            <th style="padding:8px;text-align:center">CAPACITÉ</th>
            <th style="padding:8px;text-align:center">% PRODUCTIF</th>
            <th style="padding:8px;text-align:center">% NON PRODUCTIF</th>
            <th style="padding:8px;min-width:120px">PROGRESSION</th>
          </tr></thead>
          <tbody>
            ${sorted.map((d,i) => {
              const col = d.pct_prod>=80?'#16a34a':d.pct_prod>=50?'#f59e0b':'#dc2626';
              const bg  = d.pct_prod<50?'#fff5f5':i===0?'#f0fdf4':'#fff';
              const risk = d.pct_prod < 50 ? '<span style="background:#fee2e2;color:#dc2626;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;margin-left:6px">⚠ RISQUE</span>' : '';
              return `<tr style="border-bottom:1px solid #f3f4f6;background:${bg}">
                <td style="padding:8px;text-align:center;font-size:16px">${medals[i]||'#'+(i+1)}</td>
                <td style="padding:8px;font-weight:600;color:#1e3a5f">${d.dept_name}${risk}</td>
                <td style="padding:8px;text-align:center">${d.agent_count||0}</td>
                <td style="padding:8px;text-align:center;font-weight:700">${minutesToDisplay(d.total_minutes||0)}</td>
                <td style="padding:8px;text-align:center;color:#6b7280">${minutesToDisplay(d.cap_min)}</td>
                <td style="padding:8px;text-align:center"><span style="font-size:15px;font-weight:800;color:${col}">${d.pct_prod}%</span></td>
                <td style="padding:8px;text-align:center"><span style="font-size:13px;font-weight:700;color:#ef4444">${d.pct_np}%</span></td>
                <td style="padding:8px">
                  <div style="height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;display:flex">
                    <div style="height:100%;width:${d.pct_prod}%;background:${col}"></div>
                    <div style="height:100%;width:${d.pct_np}%;background:#ef4444cc"></div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  })()}

  <!-- ══ CARTE DES RISQUES ══ -->
  ${(() => {
    const depts = (data.byDept333||data.deptComparison||data.byDept||[]);
    const at_risk = depts.filter(d => {
      const cap = d.capacity_minutes || (d.agent_count||0)*(data.working_days||22)*480;
      const pct = cap > 0 ? Math.round((d.total_minutes||0)*100/cap) : 0;
      return pct < 50;
    });
    if (!at_risk.length) return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <i class="fas fa-shield-alt" style="color:#16a34a;font-size:18px"></i>
      <span style="color:#15803d;font-size:13px;font-weight:600">Aucun département en zone de risque ce mois-ci (&lt;50% productivité).</span>
    </div>`;
    return `<div style="background:#fff;border-radius:10px;padding:14px 18px;margin-bottom:16px;border-left:4px solid #dc2626;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="font-weight:700;color:#1e3a5f;margin-bottom:10px;font-size:14px"><i class="fas fa-fire" style="color:#dc2626;margin-right:6px"></i>Carte des Risques — ${at_risk.length} département(s) en zone critique (&lt;50%)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
        ${at_risk.map(d => {
          const cap = d.capacity_minutes || (d.agent_count||0)*(data.working_days||22)*480;
          const pct = cap > 0 ? Math.round((d.total_minutes||0)*100/cap) : 0;
          const npMin = Math.max(0, cap - (d.total_minutes||0));
          const aMin = d['Administration & Reporting']||0;
          const totalMin = d.total_minutes||0;
          const adminPct = totalMin > 0 ? Math.round(aMin*100/totalMin) : 0;
          return `<div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:10px;padding:12px">
            <div style="font-weight:700;color:#1e3a5f;margin-bottom:6px;font-size:13px">${d.dept_name}</div>
            <div style="font-size:22px;font-weight:800;color:#dc2626;margin-bottom:4px">${pct}% <span style="font-size:12px;font-weight:400;color:#6b7280">productif</span></div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px"><i class="fas fa-clock" style="color:#ef4444"></i> Non-productif : <b style="color:#ef4444">${minutesToDisplay(npMin)}</b></div>
            ${adminPct > 30 ? `<div style="font-size:11px;background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;margin-top:4px"><i class="fas fa-file-alt"></i> Reporting élevé : ${adminPct}% du temps pointé</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;font-size:11px;color:#6b7280"><i class="fas fa-info-circle"></i> Ces départements nécessitent une attention particulière. Vérifier les raisons des heures non-pointées.</div>
    </div>`;
  })()}

  <!-- Barres empilées par Département -->
  <div class="chart-card" style="margin-bottom:20px">
    <div class="chart-title"><i class="fas fa-chart-bar" style="color:#1e3a5f;margin-right:8px"></i>Comparaison par Département — Répartition 3-3-3</div>
    <canvas id="dgChartDeptBar" height="${data.month2?260:200}"></canvas>
    <div style="margin-top:16px;overflow-x:auto">
      <table style="width:100%;font-size:12px">
        <thead><tr style="background:#f9fafb">
          <th style="padding:8px;text-align:left">DÉPARTEMENT</th>
          <th style="padding:8px;text-align:center">AGENTS</th>
          <th style="padding:8px;text-align:center;color:#1e3a5f">PRODUCTION</th>
          <th style="padding:8px;text-align:center;color:#f59e0b">ADMIN & REPORTING</th>
          <th style="padding:8px;text-align:center;color:#10b981">CONTRÔLE</th>
          <th style="padding:8px;text-align:center;color:#ef4444">NON PRODUCTIF</th>
        </tr></thead>
        <tbody>
          ${(data.byDept333||data.byDept||[]).map(d => {
            const cap = d.capacity_minutes || (d.agent_count||0)*480;
            const np  = Math.max(0, cap-(d.total_minutes||0));
            const npPct = cap>0?Math.round(np/cap*100):0;
            const prodPct = cap>0?Math.round((d.Production||d.total_minutes||0)/cap*100):0;
            const aMin = d['Administration & Reporting']||0;
            const cMin = d['Contrôle']||0;
            const pMin = d['Production']||d.total_minutes||0;
            return `<tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px;font-weight:600">${d.dept_name}</td>
              <td style="padding:8px;text-align:center">${d.agent_count||0}</td>
              <td style="padding:8px;text-align:center;color:#1e3a5f;font-weight:700">${minutesToDisplay(pMin)} <small style="color:#9ca3af">(${prodPct}%)</small></td>
              <td style="padding:8px;text-align:center;color:#f59e0b;font-weight:700">${minutesToDisplay(aMin)}</td>
              <td style="padding:8px;text-align:center;color:#10b981;font-weight:700">${minutesToDisplay(cMin)}</td>
              <td style="padding:8px;text-align:center"><span style="font-weight:700;color:#ef4444">${minutesToDisplay(np)}</span> <small style="color:#9ca3af">(${npPct}% cap.)</small></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Barres empilées par Agent -->
  <div class="chart-card" style="margin-bottom:20px">
    <div class="chart-title"><i class="fas fa-users" style="color:#1e3a5f;margin-right:8px"></i>Comparaison par Agent — Temps de Reporting vs Production</div>
    <canvas id="dgChartAgentBar" height="${Math.max(180,(data.byAgent333||[]).length*(data.month2?40:28))}"></canvas>
  </div>

  <!-- KPIs globaux -->
  <div class="kpi-grid" style="margin-top:0">
    <div class="kpi-card kpi-blue">
      <div class="kpi-icon" style="background:#dbeafe;color:#1e40af"><i class="fas fa-users"></i></div>
      <div><div class="kpi-value">${data.total_users||0}</div><div class="kpi-label">Agents actifs</div></div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-icon" style="background:#dcfce7;color:#16a34a"><i class="fas fa-clock"></i></div>
      <div><div class="kpi-value">${data.total_hours_month||'0h 00m'}</div><div class="kpi-label">Heures validées ce mois</div></div>
    </div>
    <div class="kpi-card kpi-orange">
      <div class="kpi-icon" style="background:#fef3c7;color:#b45309"><i class="fas fa-hourglass-half"></i></div>
      <div><div class="kpi-value">${data.to_validate||0}</div><div class="kpi-label">En attente de validation</div></div>
    </div>
    <div class="kpi-card kpi-purple">
      <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><i class="fas fa-building"></i></div>
      <div><div class="kpi-value">${data.byDept?data.byDept.length:0}</div><div class="kpi-label">Départements actifs</div></div>
    </div>
  </div>`);

  // ── Charts DG dashboard
  destroyDgCharts();

  // Pie 333 M1
  const r333 = data.ratio333||[];
  if (r333.length && document.getElementById('dgChart333M1')) {
    dgCharts.p333M1 = new Chart(document.getElementById('dgChart333M1'), {
      type: 'pie',
      data: { labels: r333.map(r=>r.label||r.type), datasets: [{ data: r333.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${r333[ctx.dataIndex].hours_display} (${r333[ctx.dataIndex].percentage}%)` } } } }
    });
  }
  // Pie 333 M2
  const r333M2 = data.ratio333Month2||[];
  if (r333M2.length && document.getElementById('dgChart333M2')) {
    dgCharts.p333M2 = new Chart(document.getElementById('dgChart333M2'), {
      type: 'pie',
      data: { labels: r333M2.map(r=>r.label||r.type), datasets: [{ data: r333M2.map(r=>r.minutes), backgroundColor: ['#1e3a5f','#f59e0b','#10b981'], borderWidth: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${r333M2[ctx.dataIndex].hours_display} (${r333M2[ctx.dataIndex].percentage}%)` } } } }
    });
  }
  // Barres dept (capacité mensuelle réelle via capacity_minutes)
  const depts = data.byDept333||data.deptComparison||data.byDept||[];
  const deptsM2 = data.deptComparisonMonth2||[];
  if (depts.length && document.getElementById('dgChartDeptBar')) {
    const labels = depts.map(d=>d.dept_name.replace('Direction ','Dir. '));
    const mkDs = (src, moisLabel, stackId) => {
      // Calculer la capacité par département
      return [
        {
          label: 'Production' + moisLabel,
          data: src.map(d => +((d.Production||d.total_minutes||0)/60).toFixed(2)),
          backgroundColor: '#1e3a5f',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes||d.agent_count*8*22||1)/60)
        },
        {
          label: 'Admin & Reporting' + moisLabel,
          data: src.map(d => +((d['Administration & Reporting']||0)/60).toFixed(2)),
          backgroundColor: '#f59e0b',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes||d.agent_count*8*22||1)/60)
        },
        {
          label: 'Contrôle' + moisLabel,
          data: src.map(d => +((d['Contrôle']||0)/60).toFixed(2)),
          backgroundColor: '#10b981',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes||d.agent_count*8*22||1)/60)
        },
        {
          label: 'Non productif' + moisLabel,
          data: src.map(d => {
            const cap = (d.capacity_minutes||d.agent_count*8*22||0)/60;
            return +(Math.max(0, cap - (d.total_minutes||0)/60).toFixed(2));
          }),
          backgroundColor: '#ef4444cc',
          stack: stackId,
          _cap: src.map(d => (d.capacity_minutes||d.agent_count*8*22||1)/60)
        }
      ];
    };
    const ds = mkDs(depts, data.month2?' ('+data.month+')':'', 'M1');
    if (deptsM2.length) ds.push(...mkDs(deptsM2, ' ('+data.month2+')', 'M2'));
    dgCharts.deptBar = new Chart(document.getElementById('dgChartDeptBar'), {
      type: 'bar', data: { labels, datasets: ds },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const cap = ctx.dataset._cap ? ctx.dataset._cap[ctx.dataIndex] : 1;
                const pct = cap > 0 ? Math.round(val / cap * 100) : 0;
                const h = Math.floor(val), m = Math.round((val-h)*60);
                const capH = Math.floor(cap), capM = Math.round((cap-capH)*60);
                return ` ${ctx.dataset.label} : ${h}h ${String(m).padStart(2,'0')}m — ${pct}% de la cap. mensuelle (${capH}h${capM>0?String(capM).padStart(2,'0')+'m':''})`;
              }
            }
          }
        },
        scales: { x: { stacked: true, ticks: { callback: v => v+'h' }, grid: { color: '#f3f4f6' } }, y: { stacked: true, ticks: { font: { size: 11 } } } }
      }
    });
  }
  // Barres agent (capacité mensuelle via capacity_minutes)
  const agents = data.byAgent333||data.agentComparison||[];
  const agentsM2 = data.agentComparisonMonth2||[];
  if (agents.length && document.getElementById('dgChartAgentBar')) {
    const mkAgDs = (src, moisLabel, stackId) => [
      {
        label: 'Production' + moisLabel,
        data: src.map(a => +((a.Production||0)/60).toFixed(2)),
        backgroundColor: '#1e3a5f', stack: stackId,
        _cap: src.map(a => (a.capacity_minutes||480)/60)
      },
      {
        label: 'Admin & Reporting' + moisLabel,
        data: src.map(a => +((a['Administration & Reporting']||0)/60).toFixed(2)),
        backgroundColor: '#f59e0b', stack: stackId,
        _cap: src.map(a => (a.capacity_minutes||480)/60)
      },
      {
        label: 'Contrôle' + moisLabel,
        data: src.map(a => +((a['Contrôle']||0)/60).toFixed(2)),
        backgroundColor: '#10b981', stack: stackId,
        _cap: src.map(a => (a.capacity_minutes||480)/60)
      },
      {
        label: 'Non productif' + moisLabel,
        data: src.map(a => {
          const cap = (a.capacity_minutes||480)/60;
          return +(Math.max(0, cap - (a.total_minutes||0)/60).toFixed(2));
        }),
        backgroundColor: '#ef4444cc', stack: stackId,
        _cap: src.map(a => (a.capacity_minutes||480)/60)
      }
    ];
    const agDs = mkAgDs(agents, data.month2?' ('+data.month+')':'', 'M1');
    if (agentsM2.length) agDs.push(...mkAgDs(agentsM2, ' ('+data.month2+')', 'M2'));
    dgCharts.agentBar = new Chart(document.getElementById('dgChartAgentBar'), {
      type: 'bar', data: { labels: agents.map(a=>a.agent_name), datasets: agDs },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const capH = ctx.dataset._cap ? ctx.dataset._cap[ctx.dataIndex] : 8;
                const pct = capH > 0 ? Math.round(val / capH * 100) : 0;
                const h = Math.floor(val), m = Math.round((val-h)*60);
                const cH = Math.floor(capH), cM = Math.round((capH-cH)*60);
                return ` ${ctx.dataset.label} : ${h}h ${String(m).padStart(2,'0')}m — ${pct}% cap. mensuelle (${cH}h${cM>0?String(cM).padStart(2,'0')+'m':''})`;
              }
            }
          }
        },
        scales: { x: { stacked: true, ticks: { callback: v => v+'h' }, grid: { color: '#f3f4f6' } }, y: { stacked: true, ticks: { font: { size: 11 } } } }
      }
    });
  }
}

function destroyDgCharts() {
  Object.values(dgCharts).forEach(c=>{ try{c.destroy();}catch(e){} });
  dgCharts = {};
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
