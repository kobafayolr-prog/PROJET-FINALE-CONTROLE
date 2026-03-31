#!/bin/bash
# ============================================
# TimeTrack BGFIBank - Démarrage Linux/Mac
# ============================================

# Aller dans le dossier du script
cd "$(dirname "$0")"

# Récupérer l'IP locale
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      TimeTrack BGFIBank - Démarrage      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Rebuild automatique
echo "Construction du projet..."
rm -rf dist
npm run build
cp -r public/static dist/static

# Mise à jour des mots de passe (hash hex)
echo "Mise à jour de la base de données..."
npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', password_encrypted='AwMLAAxQXFg=' WHERE email='admin@bgfibank.com'" > /dev/null 2>&1
npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', password_encrypted='IQ8DDyJTXlkG' WHERE email='chef.commercial@bgfibank.com'" > /dev/null 2>&1
npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='d8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', password_encrypted='IwADBxYhXFsABA==' WHERE email='agent.commercial@bgfibank.com'" > /dev/null 2>&1
npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', password_encrypted='IQ8DDyJTXlkG' WHERE email='maidou@bgfi.com'" > /dev/null 2>&1
npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='d8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', password_encrypted='IwADBxYhXFsABA==' WHERE email='eliel@bgfi.com'" > /dev/null 2>&1

echo ""
echo "════════════════════════════════════════"
echo " Accès depuis CE PC :"
echo " 👉 http://localhost:3000"
echo ""
echo " Accès depuis les AUTRES PCs du réseau :"
echo " 👉 http://$IP:3000"
echo "════════════════════════════════════════"
echo ""
echo "📋 Comptes disponibles :"
echo " Admin    : admin@bgfibank.com            / admin123"
echo " Chef DC  : chef.commercial@bgfibank.com  / Chef@2024"
echo " Agent DC : agent.commercial@bgfibank.com / Agent@2024"
echo " Chef DR  : maidou@bgfi.com               / Chef@2024"
echo " Agent DR : eliel@bgfi.com                / Agent@2024"
echo ""
echo "⚠️  Gardez ce terminal ouvert"
echo "   Ctrl+C pour arrêter"
echo ""

npx wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000
