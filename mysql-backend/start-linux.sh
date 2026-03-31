#!/bin/bash
# ============================================================
# TimeTrack BGFIBank - Démarrage Linux/Mac (MySQL)
# ============================================================

set -e

cd "$(dirname "$0")"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# IP locale
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || \
LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1) || \
LOCAL_IP="127.0.0.1"

echo ""
echo -e "${BLUE} ============================================================${NC}"
echo -e "${BLUE}  TimeTrack BGFIBank - MySQL Backend${NC}"
echo -e "${BLUE} ============================================================${NC}"
echo ""

# Vérifier Node.js
if ! command -v node &>/dev/null; then
    echo -e "${RED}  ERREUR: Node.js non trouvé !${NC}"
    echo "  Installez Node.js: https://nodejs.org/"
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules/express" ]; then
    echo -e "${YELLOW}  Installation des dépendances...${NC}"
    npm install --production
fi

# Créer le dossier logs si nécessaire
mkdir -p logs

# Vérifier la présence des fichiers statiques
if [ ! -f "public/static/admin.js" ]; then
    echo -e "${RED}  ERREUR: Fichiers statiques manquants dans public/static/${NC}"
    echo "  Assurez-vous que le dossier public/static contient les fichiers .js et .css"
    exit 1
fi
echo -e "${GREEN}  OK: Fichiers statiques présents${NC}"

# Démarrage avec PM2 si disponible, sinon node direct
if command -v pm2 &>/dev/null; then
    echo -e "${GREEN}  Démarrage avec PM2...${NC}"
    pm2 delete timetrack 2>/dev/null || true
    pm2 start ecosystem.config.js
    sleep 2

    echo ""
    echo -e "${GREEN} ============================================================${NC}"
    echo -e "${GREEN}  SERVEUR DÉMARRÉ (PM2)${NC}"
    echo -e "${GREEN} ============================================================${NC}"
    echo ""
    echo -e "  Accès local   : ${BLUE}http://localhost:3000/login${NC}"
    echo -e "  Accès réseau  : ${BLUE}http://${LOCAL_IP}:3000/login${NC}"
    echo ""
    echo -e "  ${YELLOW}Comptes par défaut :${NC}"
    echo "    admin@bgfibank.com            | admin123       (Admin)"
    echo "    chef.commercial@bgfibank.com  | Chef@2024      (Chef)"
    echo "    agent.commercial@bgfibank.com | Agent@2024     (Agent)"
    echo ""
    echo "  pm2 status            → État du serveur"
    echo "  pm2 logs timetrack    → Voir les logs"
    echo "  pm2 restart timetrack → Redémarrer"
    echo -e "${GREEN} ============================================================${NC}"
else
    echo -e "${YELLOW}  PM2 non installé, démarrage direct (npm install -g pm2 pour PM2)${NC}"
    echo ""
    echo -e "${GREEN} ============================================================${NC}"
    echo -e "${GREEN}  SERVEUR DÉMARRÉ (gardez ce terminal ouvert)${NC}"
    echo -e "${GREEN} ============================================================${NC}"
    echo ""
    echo -e "  Accès local   : ${BLUE}http://localhost:3000/login${NC}"
    echo -e "  Accès réseau  : ${BLUE}http://${LOCAL_IP}:3000/login${NC}"
    echo ""
    echo -e "  ${YELLOW}Comptes par défaut :${NC}"
    echo "    admin@bgfibank.com            | admin123       (Admin)"
    echo "    chef.commercial@bgfibank.com  | Chef@2024      (Chef)"
    echo "    agent.commercial@bgfibank.com | Agent@2024     (Agent)"
    echo ""
    echo "  Ctrl+C pour arrêter"
    echo -e "${GREEN} ============================================================${NC}"
    echo ""

    export PORT=3000
    export DB_HOST=localhost
    export DB_PORT=3306
    export DB_USER=timetrack_user
    export DB_PASSWORD='TimeTrack@BGFIBank2024!'
    export DB_NAME=timetrack_db
    export JWT_SECRET='timetrack-bgfibank-secret-2024-x9k2p7m'

    node server.js
fi
