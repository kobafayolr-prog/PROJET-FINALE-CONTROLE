const fs = require('fs');

const md = fs.readFileSync('GUIDE_SIMPLE_DASHBOARD_ADMIN.md', 'utf-8');

// Conversion Markdown très simple vers HTML
let html = md
  // Titres
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  
  // Gras et italique
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  
  // Listes
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
  
  // Code blocks
  .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Liens
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  
  // Tableaux simples
  .replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
  })
  
  // Paragraphes
  .replace(/\n\n/g, '</p><p>')
  
  // Emojis et icônes
  .replace(/✅/g, '<span style="color:#10b981">✅</span>')
  .replace(/🔴/g, '<span style="color:#ef4444">🔴</span>')
  .replace(/🟡/g, '<span style="color:#f59e0b">🟡</span>')
  .replace(/🟢/g, '<span style="color:#10b981">🟢</span>')
  .replace(/⚠️/g, '<span style="color:#f59e0b">⚠️</span>')
  .replace(/➡️/g, '<span style="color:#3b82f6">➡️</span>');

const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guide Simple Dashboard Admin - TimeTrack</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.8;
            color: #1f2937;
            background: #f9fafb;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        
        /* En-tête */
        .header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 40px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        /* Bouton PDF */
        .pdf-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            margin: 20px 0;
            cursor: pointer;
            border: none;
            font-size: 1.1em;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            transition: all 0.3s;
        }
        .pdf-button:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
        }
        
        /* Titres */
        h1 {
            color: #1e3a5f;
            font-size: 2.2em;
            margin: 30px 0 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #2563eb;
        }
        h2 {
            color: #1e3a5f;
            font-size: 1.8em;
            margin: 25px 0 15px;
            padding-left: 15px;
            border-left: 5px solid #2563eb;
        }
        h3 {
            color: #2563eb;
            font-size: 1.4em;
            margin: 20px 0 10px;
        }
        h4 {
            color: #3b82f6;
            font-size: 1.2em;
            margin: 15px 0 10px;
        }
        
        /* Paragraphes */
        p {
            margin: 12px 0;
            text-align: justify;
        }
        
        /* Listes */
        ul, ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        li {
            margin: 8px 0;
            line-height: 1.6;
        }
        
        /* Tableaux */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 0.95em;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th {
            background: #1e3a5f;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        tr:hover {
            background: #f3f4f6;
        }
        
        /* Code */
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #dc2626;
            font-size: 0.9em;
        }
        pre {
            background: #1f2937;
            color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            line-height: 1.5;
        }
        pre code {
            background: none;
            color: #f9fafb;
            padding: 0;
        }
        
        /* Encadrés colorés */
        .box {
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 5px solid;
        }
        .box-success {
            background: #d1fae5;
            border-color: #10b981;
            color: #065f46;
        }
        .box-warning {
            background: #fef3c7;
            border-color: #f59e0b;
            color: #92400e;
        }
        .box-danger {
            background: #fee2e2;
            border-color: #ef4444;
            color: #991b1b;
        }
        .box-info {
            background: #dbeafe;
            border-color: #3b82f6;
            color: #1e40af;
        }
        
        /* Badges */
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            margin: 0 5px;
        }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        
        /* Responsive */
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; padding: 20px; }
            .pdf-button { display: none; }
            .no-print { display: none; }
        }
        
        @media (max-width: 768px) {
            .container { padding: 20px; }
            h1 { font-size: 1.8em; }
            h2 { font-size: 1.5em; }
            table { font-size: 0.85em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Guide Simple du Dashboard</h1>
            <p>TimeTrack - BGFIBank CA</p>
            <p style="font-size:0.9em;margin-top:10px;opacity:0.8">
                Guide pratique pour comprendre et interpréter le tableau de bord administrateur
            </p>
        </div>
        
        <div style="text-align:center;margin:30px 0;">
            <button class="pdf-button no-print" onclick="window.print()">
                🖨️ Imprimer en PDF
            </button>
        </div>
        
        <div class="content">
            <p>${html}</p>
        </div>
        
        <div style="text-align:center;margin:40px 0;padding:20px;background:#f9fafb;border-radius:8px;">
            <p style="color:#6b7280;font-size:0.9em;">
                Document généré automatiquement par TimeTrack<br>
                BGFIBank CA - Dashboard Administrateur<br>
                Version 1.0 - Avril 2026
            </p>
        </div>
    </div>
</body>
</html>`;

fs.writeFileSync('GUIDE_SIMPLE_DASHBOARD_ADMIN.html', fullHtml);
console.log('✅ HTML généré : GUIDE_SIMPLE_DASHBOARD_ADMIN.html');
console.log('📄 Taille :', (fullHtml.length / 1024).toFixed(2), 'KB');
