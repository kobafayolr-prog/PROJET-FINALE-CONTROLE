// Simuler le rendu complet avec données réelles
const fs = require('fs');
const adminJs = fs.readFileSync('dist/static/admin.js', 'utf8');

// Extraire la fonction de génération du tableau
const tableMatch = adminJs.match(/<!-- ══ RANGÉE 3 : Comparaison par Département ══ -->[\s\S]*?<\/div>\s*<\/div>/);

if (!tableMatch) {
  console.log('❌ Impossible de trouver le tableau');
  process.exit(1);
}

console.log('✅ Tableau trouvé');
console.log('');
console.log('🔍 Vérification des en-têtes <th> :');
const thMatches = tableMatch[0].match(/<th[^>]*>([^<]+)<\/th>/g);
console.log(`Nombre de <th> : ${thMatches ? thMatches.length : 0}`);
thMatches?.forEach((th, i) => {
  const text = th.match(/>([^<]+)</)?.[1];
  const hasWidth = th.includes('min-width');
  console.log(`  ${i+1}. ${text} ${hasWidth ? '✅ (width définie)' : '⚠️  (pas de width)'}`);
});

console.log('');
console.log('🔍 Vérification du code <td> pour PRODUCTION :');
const prodTdMatch = adminJs.match(/<td[^>]*>\$\{minutesToHours\(d\.Production/);
if (prodTdMatch) {
  console.log('✅ Cellule PRODUCTION trouvée');
  console.log('Style :', prodTdMatch[0]);
  if (prodTdMatch[0].includes('min-width')) {
    console.log('✅ La cellule a min-width:80px');
  } else {
    console.log('❌ La cellule n\'a PAS de min-width');
  }
} else {
  console.log('❌ Cellule PRODUCTION non trouvée');
}
