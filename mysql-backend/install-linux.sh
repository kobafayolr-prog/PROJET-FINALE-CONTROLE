#!/bin/bash
# ============================================================
# TimeTrack BGFIBank - Installation Linux/Mac (MySQL)
# ============================================================

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE} ============================================================${NC}"
echo -e "${BLUE}  TimeTrack BGFIBank - Installation Linux/Mac + MySQL${NC}"
echo -e "${BLUE} ============================================================${NC}"
echo ""

# 1. Node.js
echo -e "${YELLOW}[1/5] Vérification Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}  Node.js non trouvé. Installez-le via :${NC}"
    echo "    Ubuntu/Debian : curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "    macOS         : brew install node"
    exit 1
fi
echo -e "${GREEN}  OK: $(node --version)${NC}"

# 2. MySQL
echo -e "${YELLOW}[2/5] Vérification MySQL...${NC}"
if ! command -v mysql &>/dev/null; then
    echo -e "${YELLOW}  MySQL non trouvé. Options d'installation :${NC}"
    echo "    Ubuntu/Debian : sudo apt-get install mysql-server"
    echo "    macOS         : brew install mysql"
    echo "    MariaDB       : sudo apt-get install mariadb-server"
    echo ""
    echo "  Puis relancez ce script."
    exit 1
fi
echo -e "${GREEN}  OK: $(mysql --version)${NC}"

# 3. Dépendances npm
echo -e "${YELLOW}[3/5] Installation des dépendances npm...${NC}"
npm install --production
echo -e "${GREEN}  OK: express, mysql2 installés${NC}"

# 4. PM2
echo -e "${YELLOW}[4/5] Installation PM2...${NC}"
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
echo -e "${GREEN}  OK: PM2 $(pm2 --version)${NC}"

# 5. Base de données
echo -e "${YELLOW}[5/5] Initialisation de la base de données...${NC}"
echo ""
read -p "  Mot de passe root MySQL (laisser vide si aucun) : " MYSQL_ROOT_PWD

if [ -z "$MYSQL_ROOT_PWD" ]; then
    export DB_ROOT_PASSWORD=""
else
    export DB_ROOT_PASSWORD="$MYSQL_ROOT_PWD"
fi

node scripts/init-db.js

echo ""
echo -e "${GREEN} ============================================================${NC}"
echo -e "${GREEN}  INSTALLATION TERMINÉE !${NC}"
echo -e "${GREEN} ============================================================${NC}"
echo ""
echo -e "  Démarrez l'application avec : ${BLUE}bash start-linux.sh${NC}"
echo ""
echo "  Comptes par défaut :"
echo "    admin@bgfibank.com            | admin123"
echo "    chef.commercial@bgfibank.com  | Chef@2024"
echo "    agent.commercial@bgfibank.com | Agent@2024"
echo -e "${GREEN} ============================================================${NC}"
echo ""
