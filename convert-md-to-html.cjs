const fs = require('fs');
const path = require('path');

// Lire le fichier Markdown
const mdContent = fs.readFileSync('GUIDE_COMPLET_DASHBOARD_ADMIN.md', 'utf8');

// Conversion Markdown simple vers HTML
function convertMarkdownToHTML(md) {
  let html = md;
  
  // Titres
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Gras et italique
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code inline
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Blocs de code
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // Liens
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Listes
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  
  // Tableaux (simple)
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
  });
  
  // Paragraphes
  html = html.split('\n\n').map(p => {
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || 
        p.startsWith('<ol') || p.startsWith('<li') || p.startsWith('<table') ||
        p.startsWith('<tr') || p.trim() === '') {
      return p;
    }
    return `<p>${p}</p>`;
  }).join('\n');
  
  return html;
}

const htmlContent = convertMarkdownToHTML(mdContent);

// Template HTML avec style
const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guide Complet Dashboard Administrateur - TimeTrack BGFIBank</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        h1 {
            color: #1e3a5f;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 10px;
            font-size: 28px;
            margin-top: 30px;
            page-break-before: always;
        }
        
        h1:first-of-type {
            page-break-before: avoid;
            margin-top: 0;
        }
        
        h2 {
            color: #1e3a5f;
            border-left: 4px solid #3b82f6;
            padding-left: 15px;
            font-size: 22px;
            margin-top: 25px;
            page-break-after: avoid;
        }
        
        h3 {
            color: #374151;
            font-size: 18px;
            margin-top: 20px;
            page-break-after: avoid;
        }
        
        p {
            margin: 10px 0;
            text-align: justify;
        }
        
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #dc2626;
        }
        
        pre {
            background: #1f2937;
            color: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            page-break-inside: avoid;
            margin: 15px 0;
        }
        
        pre code {
            background: transparent;
            color: #10b981;
            padding: 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
            font-size: 13px;
        }
        
        th {
            background: #1e3a5f;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #3b5998;
        }
        
        td {
            padding: 10px 8px;
            border: 1px solid #e5e7eb;
        }
        
        tr:nth-child(even) {
            background: #f9fafb;
        }
        
        ul, ol {
            margin: 10px 0;
            padding-left: 30px;
        }
        
        li {
            margin: 5px 0;
        }
        
        strong {
            color: #1e3a5f;
            font-weight: 600;
        }
        
        em {
            color: #6b7280;
        }
        
        a {
            color: #3b82f6;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        .toc {
            background: #eff6ff;
            border: 2px solid #3b82f6;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            page-break-inside: avoid;
        }
        
        .toc h2 {
            margin-top: 0;
            border: none;
            padding: 0;
        }
        
        .note {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        
        .warning {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        
        .success {
            background: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .no-print {
                display: none;
            }
        }
        
        .cover-page {
            text-align: center;
            padding: 100px 0;
            page-break-after: always;
        }
        
        .cover-page h1 {
            font-size: 36px;
            margin-bottom: 20px;
            border: none;
            page-break-before: avoid;
        }
        
        .cover-page p {
            font-size: 18px;
            color: #6b7280;
        }
        
        .cover-page .subtitle {
            font-size: 24px;
            color: #1e3a5f;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <div class="cover-page">
        <h1>📊 GUIDE COMPLET</h1>
        <div class="subtitle">Dashboard Administrateur</div>
        <div class="subtitle">TimeTrack BGFIBank</div>
        <p style="margin-top: 50px; font-size: 16px;">
            Documentation complète des graphiques, tableaux et calculs
        </p>
        <p style="margin-top: 30px;">
            <strong>Version 1.0</strong><br>
            Avril 2026
        </p>
    </div>
    
    ${htmlContent}
    
    <div class="no-print" style="position: fixed; bottom: 20px; right: 20px; background: #3b82f6; color: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); cursor: pointer;" onclick="window.print()">
        🖨️ Imprimer en PDF
    </div>
</body>
</html>`;

fs.writeFileSync('GUIDE_DASHBOARD_ADMIN.html', fullHTML, 'utf8');
console.log('✅ Fichier HTML créé : GUIDE_DASHBOARD_ADMIN.html');
console.log('📄 Taille : ' + Math.round(fullHTML.length / 1024) + ' KB');
console.log('\n📝 Instructions pour créer le PDF :');
console.log('1. Ouvre le fichier HTML dans ton navigateur');
console.log('2. Appuie sur Ctrl+P (ou Cmd+P sur Mac)');
console.log('3. Choisis "Enregistrer en PDF"');
console.log('4. Clique sur "Enregistrer"');
