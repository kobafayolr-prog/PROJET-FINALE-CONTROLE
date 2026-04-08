const fs = require('fs');

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 AUDIT COMPLET - COLONNE PRODUCTION MANQUANTE');
console.log('═══════════════════════════════════════════════════════\n');

// 1. Vérifier le fichier source
console.log('📁 1. VÉRIFICATION FICHIER SOURCE (public/static/admin.js)');
const sourceFile = 'public/static/admin.js';
if (fs.existsSync(sourceFile)) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const thProd = source.match(/<th[^>]*>PRODUCTION<\/th>/g);
  const tdProd = source.match(/<td[^>]*>\$\{minutesToHours\(d\.Production[^}]*\}\)/g);
  
  console.log(`   ✅ Fichier existe (${Math.round(source.length/1024)} KB)`);
  console.log(`   <th>PRODUCTION</th> : ${thProd ? '✅ Trouvé' : '❌ ABSENT'}`);
  if (thProd) {
    console.log(`      → ${thProd[0].substring(0, 100)}...`);
  }
  console.log(`   <td>Production</td> : ${tdProd ? '✅ Trouvé' : '❌ ABSENT'}`);
  if (tdProd) {
    console.log(`      → ${tdProd[0].substring(0, 100)}...`);
  }
} else {
  console.log(`   ❌ Fichier n'existe pas`);
}

console.log('\n📁 2. VÉRIFICATION FICHIER COMPILÉ (dist/static/admin.js)');
const distFile = 'dist/static/admin.js';
if (fs.existsSync(distFile)) {
  const dist = fs.readFileSync(distFile, 'utf8');
  const thProd = dist.match(/<th[^>]*>PRODUCTION<\/th>/g);
  const tdProd = dist.match(/<td[^>]*>\$\{minutesToHours\(d\.Production[^}]*\}\)/g);
  
  console.log(`   ✅ Fichier existe (${Math.round(dist.length/1024)} KB)`);
  console.log(`   <th>PRODUCTION</th> : ${thProd ? '✅ Trouvé' : '❌ ABSENT'}`);
  if (thProd) {
    console.log(`      → ${thProd[0].substring(0, 100)}...`);
  }
  console.log(`   <td>Production</td> : ${tdProd ? '✅ Trouvé' : '❌ ABSENT'}`);
  if (tdProd) {
    console.log(`      → ${tdProd[0].substring(0, 100)}...`);
  }
} else {
  console.log(`   ❌ Fichier n'existe pas`);
}

console.log('\n🔍 3. ANALYSE DÉTAILLÉE DU TABLEAU');
if (fs.existsSync(distFile)) {
  const dist = fs.readFileSync(distFile, 'utf8');
  
  // Trouver le tableau département
  const tableStart = dist.indexOf('Comparaison par Département');
  if (tableStart > 0) {
    console.log(`   ✅ Section "Comparaison par Département" trouvée à position ${tableStart}`);
    
    // Extraire la section du tableau
    const tableSection = dist.substring(tableStart, tableStart + 5000);
    
    // Compter les <th>
    const thMatches = tableSection.match(/<th[^>]*>([^<]+)<\/th>/g);
    console.log(`\n   📊 En-têtes <th> trouvés : ${thMatches ? thMatches.length : 0}`);
    if (thMatches) {
      thMatches.forEach((th, i) => {
        const text = th.match(/>([^<]+)</)[1];
        const style = th.match(/style="([^"]*)"/)?.[1] || 'aucun style';
        const hasWidth = style.includes('min-width');
        console.log(`      ${i+1}. ${text.padEnd(20)} ${hasWidth ? '✅ width:' + style.match(/width:(\d+px)/)?.[1] : '⚠️  pas de width'}`);
      });
    }
    
    // Vérifier les <td> générées
    console.log(`\n   📊 Cellules <td> générées dynamiquement :`);
    const tdMatches = tableSection.match(/return `<tr[^`]*`/s);
    if (tdMatches) {
      const trContent = tdMatches[0];
      const tdCount = (trContent.match(/<td/g) || []).length;
      console.log(`      Nombre de <td> dans le template : ${tdCount}`);
      
      // Extraire chaque <td>
      const tdLines = trContent.split('<td').slice(1);
      tdLines.forEach((td, i) => {
        const content = td.substring(0, 100);
        console.log(`      ${i+1}. ${content.substring(0, 80)}...`);
      });
    }
  } else {
    console.log(`   ❌ Section "Comparaison par Département" NON trouvée`);
  }
}

console.log('\n🌐 4. VÉRIFICATION SERVEUR HTTP');
console.log(`   Lancement curl pour tester le serveur...`);

