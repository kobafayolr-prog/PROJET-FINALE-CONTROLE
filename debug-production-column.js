// Simulation EXACTE de ce que le navigateur exécute
const minutesToHours = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

// Données de test (simule stats.deptComparison)
const testData = [
  {
    dept_name: 'Direction Commerciale',
    agent_count: 3,
    Production: 89 * 60 + 30, // 89h 30m en minutes
    'Administration & Reporting': 18 * 60 + 30,
    'Contrôle': 10 * 60 + 30,
    total_minutes: 200 * 60,
    capacity_minutes: 144 * 60
  }
];

const stats = {
  deptComparison: testData,
  working_days: 22
};

// CODE EXACT copié de admin.js lignes 542-563
const tableRows = (stats.deptComparison||[]).map(d => {
  const cap = d.capacity_minutes || d.agent_count * (stats.working_days||22) * 480;
  const np  = Math.max(0, cap - d.total_minutes);
  const npPct = cap > 0 ? Math.round(np/cap*100) : 0;
  const aMin = d['Administration & Reporting']||0;
  const cMin = d['Contrôle']||0;
  const repPct = d.total_minutes > 0 ? Math.round((aMin+cMin)/d.total_minutes*100) : 0;
  
  const row = `<tr style="border-bottom:1px solid #f3f4f6">
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
  
  console.log('=== GÉNÉRATION LIGNE ===');
  console.log('Département:', d.dept_name);
  console.log('Production (minutes):', d.Production);
  console.log('Production (formaté):', minutesToHours(d.Production||0));
  console.log('Nombre de <td> dans la ligne:', (row.match(/<td/g) || []).length);
  console.log('\nLigne HTML complète:');
  console.log(row);
  
  return row;
}).join('');

console.log('\n=== RÉSULTAT FINAL ===');
console.log('Nombre total de lignes:', (tableRows.match(/<tr/g) || []).length);
console.log('Nombre de <td> dans PREMIÈRE ligne:', (tableRows.split('</tr>')[0].match(/<td/g) || []).length);
