#!/bin/bash
# ============================================
# TimeTrack BGFIBank - Démarrage Linux/Mac
# ============================================

# Récupérer l'IP locale
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      TimeTrack BGFIBank - Démarrage      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "════════════════════════════════════════"
echo " Accès depuis CE PC :"
echo " 👉 http://localhost:3000"
echo ""
echo " Accès depuis les AUTRES PCs du réseau :"
echo " 👉 http://$IP:3000"
echo "════════════════════════════════════════"
echo ""
echo "📋 Comptes par défaut :"
echo " Admin       : admin@bgfibank.com / Admin@2024"
echo " Chef Comm.  : chef.commercial@bgfibank.com / Chef@2024"
echo " Agent       : agent.commercial@bgfibank.com / Agent@2024"
echo ""
echo "⚠️  Gardez ce terminal ouvert"
echo "   Ctrl+C pour arrêter"
echo ""

npx wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000
