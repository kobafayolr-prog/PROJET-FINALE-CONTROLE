#!/bin/bash
# ============================================
# TimeTrack BGFIBank - Installation Linux/Mac
# chmod +x install.sh && ./install.sh
# ============================================

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     TimeTrack BGFIBank - Installation    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé !"
    echo "Installez Node.js depuis https://nodejs.org/ (version 18+)"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install
echo "✅ Dépendances installées"

# Créer la base de données
echo ""
echo "🗄️  Création de la base de données..."
npx wrangler d1 migrations apply timetrack-production --local
echo "✅ Base de données créée"

# Insérer les données initiales
echo ""
echo "📊 Insertion des données initiales..."
npx wrangler d1 execute timetrack-production --local --file=./seed.sql
echo "✅ Données initiales insérées"

# Builder le projet
echo ""
echo "🔨 Construction du projet..."
npm run build
cp -r public/static dist/static
echo "✅ Projet construit"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Installation terminée ! ✅        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Pour démarrer : ./start.sh"
echo ""
