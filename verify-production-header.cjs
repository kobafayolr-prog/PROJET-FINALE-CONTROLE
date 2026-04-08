// Script de vérification de l'en-tête PRODUCTION
// Ce script vérifie que le fichier admin.js contient bien la colonne PRODUCTION

const fs = require('fs');
const path = require('path');

const adminJsPath = path.join(__dirname, 'public', 'static', 'admin.js');

console.log('🔍 Vérification du fichier admin.js...\n');
console.log('📁 Chemin :', adminJsPath);
console.log('');

if (!fs.existsSync(adminJsPath)) {
    console.log('❌ ERREUR : Le fichier admin.js n\'existe pas !');
    process.exit(1);
}

const content = fs.readFileSync(adminJsPath, 'utf8');
const lines = content.split('\n');

console.log('📊 Statistiques :');
console.log(`   - Nombre de lignes : ${lines.length}`);
console.log(`   - Taille : ${(content.length / 1024).toFixed(2)} KB`);
console.log('');

// Chercher la ligne avec PRODUCTION
const productionLines = [];
lines.forEach((line, index) => {
    if (line.includes('PRODUCTION')) {
        productionLines.push({ lineNumber: index + 1, content: line.trim() });
    }
});

console.log(`🔎 Occurrences de "PRODUCTION" trouvées : ${productionLines.length}\n`);

productionLines.forEach((item, idx) => {
    console.log(`   ${idx + 1}. Ligne ${item.lineNumber} :`);
    console.log(`      ${item.content.substring(0, 100)}...`);
    console.log('');
});

// Vérifier spécifiquement la ligne 535 (tableau des départements)
if (lines.length >= 535) {
    const line535 = lines[534]; // Index 534 = ligne 535
    console.log('📍 Ligne 535 (en-tête du tableau) :');
    console.log(`   ${line535.trim()}`);
    console.log('');
    
    if (line535.includes('PRODUCTION')) {
        console.log('✅ L\'en-tête PRODUCTION est présent à la ligne 535 !');
    } else {
        console.log('❌ L\'en-tête PRODUCTION est ABSENT de la ligne 535 !');
    }
} else {
    console.log(`⚠️  Le fichier ne contient que ${lines.length} lignes (ligne 535 attendue)`);
}

// Vérifier les lignes autour (530-540)
console.log('\n📋 Contexte (lignes 530-540) :');
for (let i = 529; i <= 539 && i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const marker = line.includes('PRODUCTION') ? ' ← PRODUCTION' : '';
    console.log(`   ${lineNum}: ${line.trim()}${marker}`);
}

// Compter les <th> dans le tableau
const tableHeaderRegex = /<th[^>]*>(.*?)<\/th>/g;
const tableSection = lines.slice(529, 545).join('\n');
const headers = [];
let match;
while ((match = tableHeaderRegex.exec(tableSection)) !== null) {
    headers.push(match[1]);
}

console.log('\n📊 En-têtes du tableau détectés :');
headers.forEach((header, idx) => {
    console.log(`   ${idx + 1}. ${header}`);
});

console.log(`\n📈 Total : ${headers.length} colonnes`);

if (headers.length === 7) {
    console.log('✅ Le tableau contient bien 7 colonnes !');
} else {
    console.log(`❌ Le tableau contient ${headers.length} colonnes au lieu de 7 !`);
}

if (headers.includes('PRODUCTION')) {
    console.log('✅ L\'en-tête PRODUCTION est présent dans le tableau !');
} else {
    console.log('❌ L\'en-tête PRODUCTION est ABSENT du tableau !');
}
