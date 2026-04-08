#!/bin/bash

###############################################################################
# SCRIPT D'INSTALLATION PRODUCTION — TimeTrack BGFIBank
# Version : 1.0.0
# Système : Ubuntu 22.04 LTS
# Prérequis : Accès root ou sudo
###############################################################################

set -e  # Arrêt immédiat en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
print_step() {
    echo -e "${BLUE}[ÉTAPE]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Vérification root/sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Ce script doit être exécuté avec sudo"
    echo "Usage: sudo bash install-production.sh"
    exit 1
fi

# Variables
APP_DIR="/home/admin/timetrack-backend"
DB_NAME="timetrack_db"
DB_USER="timetrack_user"
DB_PASS="TimeTrack@BGFIBank2024!"
DOMAIN=""

# Banner
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   TimeTrack BGFIBank — Installation Production v1.0.0     ║"
echo "║   Node.js + Express + MySQL + Nginx + HTTPS                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Demander le nom de domaine
print_step "Configuration initiale"
read -p "Nom de domaine (ex: timetrack.bgfibank.com) : " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_error "Le nom de domaine est obligatoire"
    exit 1
fi

print_success "Domaine configuré : $DOMAIN"
echo ""

# Étape 1 : Mise à jour système
print_step "1/10 - Mise à jour du système"
apt update -qq
apt upgrade -y -qq
print_success "Système mis à jour"
echo ""

# Étape 2 : Installation MySQL
print_step "2/10 - Installation de MySQL"
if ! command -v mysql &> /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt install mysql-server -y -qq
    print_success "MySQL installé"
else
    print_warning "MySQL déjà installé"
fi
systemctl enable mysql
systemctl start mysql
print_success "MySQL démarré"
echo ""

# Étape 3 : Configuration MySQL
print_step "3/10 - Configuration de la base de données"

# Sécurisation MySQL
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';" || true
mysql -u root -p"${DB_PASS}" -e "DELETE FROM mysql.user WHERE User='';" || true
mysql -u root -p"${DB_PASS}" -e "DROP DATABASE IF EXISTS test;" || true
mysql -u root -p"${DB_PASS}" -e "FLUSH PRIVILEGES;" || true

# Création base et utilisateur
mysql -u root -p"${DB_PASS}" <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

print_success "Base de données créée : $DB_NAME"
print_success "Utilisateur créé : $DB_USER"
echo ""

# Étape 4 : Installation Node.js
print_step "4/10 - Installation de Node.js 20 LTS"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -qq
    apt install nodejs -y -qq
    print_success "Node.js installé : $(node --version)"
else
    print_warning "Node.js déjà installé : $(node --version)"
fi
echo ""

# Étape 5 : Installation PM2
print_step "5/10 - Installation de PM2"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 --silent
    print_success "PM2 installé : $(pm2 --version)"
else
    print_warning "PM2 déjà installé : $(pm2 --version)"
fi
echo ""

# Étape 6 : Copie de l'application
print_step "6/10 - Installation de l'application"
mkdir -p /home/admin
if [ -d "$APP_DIR" ]; then
    print_warning "Dossier existe déjà : $APP_DIR"
    read -p "Écraser ? (y/N) : " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$APP_DIR"
        print_success "Ancien dossier supprimé"
    else
        print_error "Installation annulée"
        exit 1
    fi
fi

cp -r "$(dirname "$0")" "$APP_DIR"
cd "$APP_DIR"
print_success "Application copiée dans $APP_DIR"
echo ""

# Étape 7 : Configuration .env
print_step "7/10 - Configuration de l'environnement"

# Générer JWT secret sécurisé
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat > .env <<EOF
# Configuration TimeTrack BGFIBank
# Généré le : $(date)

# Port de l'application
PORT=3000

# Configuration MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# JWT Secret (SÉCURISÉ)
JWT_SECRET=${JWT_SECRET}

# CORS
ALLOWED_ORIGINS=https://${DOMAIN}

# Environnement
NODE_ENV=production
EOF

chmod 600 .env
print_success "Fichier .env créé et sécurisé"
echo ""

# Étape 8 : Installation dépendances
print_step "8/10 - Installation des dépendances Node.js"
npm install --production --silent
print_success "Dépendances installées"
echo ""

# Étape 9 : Initialisation base de données
print_step "9/10 - Initialisation de la base de données"

if [ -f "schema.sql" ]; then
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < schema.sql
    print_success "Tables créées (schema.sql)"
else
    print_warning "Fichier schema.sql non trouvé"
fi

if [ -f "seed.sql" ]; then
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < seed.sql
    print_success "Données de démo insérées (seed.sql)"
else
    print_warning "Fichier seed.sql non trouvé"
fi

# Vérification
USER_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -se "SELECT COUNT(*) FROM users;")
print_success "Utilisateurs créés : $USER_COUNT"
echo ""

# Étape 10 : Démarrage application
print_step "10/10 - Démarrage de l'application"

# Arrêter processus existant
su - admin -c "pm2 delete timetrack 2>/dev/null || true"

# Démarrer avec PM2
su - admin -c "cd $APP_DIR && pm2 start ecosystem.config.js"
su - admin -c "pm2 save"
su - admin -c "pm2 startup systemd -u admin --hp /home/admin" | grep "sudo" | bash || true

# Vérifier
sleep 2
if su - admin -c "pm2 list" | grep -q "timetrack.*online"; then
    print_success "Application démarrée avec succès"
else
    print_error "Erreur au démarrage de l'application"
    su - admin -c "pm2 logs timetrack --lines 20"
    exit 1
fi

# Test local
if curl -s http://localhost:3000 >/dev/null; then
    print_success "Test local réussi : http://localhost:3000"
else
    print_warning "Test local échoué"
fi
echo ""

# Étape 11 : Installation Nginx
print_step "BONUS - Installation de Nginx"
if ! command -v nginx &> /dev/null; then
    apt install nginx -y -qq
    print_success "Nginx installé"
else
    print_warning "Nginx déjà installé"
fi

# Configuration Nginx
if [ -f "nginx/timetrack.conf" ]; then
    # Remplacer le domaine dans la config
    sed "s/timetrack\.bgfibank\.com/${DOMAIN}/g" nginx/timetrack.conf > /etc/nginx/sites-available/timetrack
    ln -sf /etc/nginx/sites-available/timetrack /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Tester config
    if nginx -t 2>&1 | grep -q "successful"; then
        systemctl enable nginx
        systemctl restart nginx
        print_success "Nginx configuré pour $DOMAIN"
    else
        print_error "Erreur de configuration Nginx"
        nginx -t
    fi
else
    print_warning "Fichier nginx/timetrack.conf non trouvé"
fi
echo ""

# Étape 12 : Installation Certbot (SSL)
print_step "BONUS - Installation du certificat SSL"
read -p "Installer le certificat SSL Let's Encrypt ? (y/N) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! command -v certbot &> /dev/null; then
        apt install certbot python3-certbot-nginx -y -qq
        print_success "Certbot installé"
    fi
    
    print_warning "Assurez-vous que le DNS $DOMAIN pointe vers ce serveur"
    read -p "Continuer ? (y/N) : " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@bgfibank.com" || {
            print_warning "Certificat SSL non obtenu (vérifier le DNS)"
        }
    fi
else
    print_warning "Certificat SSL non installé (HTTPS désactivé)"
fi
echo ""

# Configuration du Firewall
print_step "BONUS - Configuration du Firewall"
read -p "Configurer le firewall UFW ? (y/N) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    ufw deny 3000/tcp comment "Block Node.js direct"
    ufw deny 3306/tcp comment "Block MySQL direct"
    echo "y" | ufw enable
    print_success "Firewall configuré"
    ufw status
else
    print_warning "Firewall non configuré"
fi
echo ""

# Backup automatique
print_step "BONUS - Configuration du backup automatique"
if [ -f "scripts/backup-timetrack.sh" ]; then
    cp scripts/backup-timetrack.sh /usr/local/bin/
    chmod +x /usr/local/bin/backup-timetrack.sh
    
    # Ajouter au cron (3h du matin tous les jours)
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-timetrack.sh >> /var/log/timetrack-backup.log 2>&1") | crontab -
    
    print_success "Backup automatique configuré (tous les jours à 3h)"
else
    print_warning "Script de backup non trouvé"
fi
echo ""

# Résumé final
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              INSTALLATION TERMINÉE AVEC SUCCÈS             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ MySQL${NC}        : $DB_NAME ($DB_USER)"
echo -e "${GREEN}✓ Node.js${NC}      : $(node --version)"
echo -e "${GREEN}✓ PM2${NC}          : Application démarrée"
echo -e "${GREEN}✓ Nginx${NC}        : Configuré"
echo -e "${GREEN}✓ Application${NC}  : $APP_DIR"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. Vérifier l'accès : https://$DOMAIN"
echo "  2. Se connecter avec : admin@bgfibank.com / admin123"
echo "  3. ⚠️ CHANGER LE MOT DE PASSE ADMIN IMMÉDIATEMENT"
echo "  4. Activer 2FA pour le compte admin"
echo "  5. Supprimer les comptes de démo"
echo "  6. Créer les vrais utilisateurs"
echo ""
echo "📖 Documentation :"
echo "  - Guide complet : $APP_DIR/GUIDE_DEPLOIEMENT_SIMPLE.md"
echo "  - Maintenance : $APP_DIR/MAINTENANCE.md"
echo "  - Checklist : $APP_DIR/DEPLOYMENT_CHECKLIST.md"
echo ""
echo "🔧 Commandes utiles :"
echo "  pm2 list              # Statut de l'application"
echo "  pm2 logs timetrack    # Voir les logs"
echo "  pm2 restart timetrack # Redémarrer"
echo "  systemctl status nginx mysql  # Statut services"
echo ""
echo "🆘 Support :"
echo "  - Logs application : pm2 logs timetrack"
echo "  - Logs Nginx : tail -f /var/log/nginx/timetrack.error.log"
echo "  - Logs MySQL : tail -f /var/log/mysql/error.log"
echo ""
print_success "Installation réussie ! 🚀"
echo ""
