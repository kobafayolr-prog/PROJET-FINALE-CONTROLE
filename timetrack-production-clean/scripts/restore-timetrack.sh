#!/bin/bash
# ============================================================
# TimeTrack BGFIBank - Script Restauration Backup
# ATTENTION: Arrête l'application et restaure base complète
# Usage: ./restore-timetrack.sh /path/to/backup.sql.gz
# ============================================================

set -e

# Configuration
DB_NAME="timetrack_db"
DB_USER="root"
DB_PASSWORD=""  # À remplir

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# VÉRIFICATIONS
# ============================================

if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Ce script doit être exécuté en root (sudo)${NC}"
  exit 1
fi

if [ -z "$1" ]; then
  echo -e "${RED}❌ Usage: $0 /path/to/backup.sql.gz${NC}"
  echo "Exemple: $0 /var/backups/timetrack/db_2026-04-08_0300.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}❌ Fichier backup introuvable: $BACKUP_FILE${NC}"
  exit 1
fi

# ============================================
# CONFIRMATION UTILISATEUR
# ============================================

echo -e "${YELLOW}⚠️  AVERTISSEMENT: Cette opération va:${NC}"
echo "   1. Arrêter l'application TimeTrack"
echo "   2. Sauvegarder la base actuelle dans /tmp/"
echo "   3. SUPPRIMER la base de données actuelle"
echo "   4. Restaurer le backup: $BACKUP_FILE"
echo "   5. Redémarrer l'application"
echo ""
read -p "Êtes-vous sûr de vouloir continuer? (tapez 'OUI' en majuscules): " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
  echo -e "${YELLOW}❌ Restauration annulée${NC}"
  exit 0
fi

# ============================================
# ÉTAPE 1: ARRÊT APPLICATION
# ============================================

echo -e "${YELLOW}🛑 Arrêt application TimeTrack...${NC}"
pm2 stop timetrack || true
sleep 2

# ============================================
# ÉTAPE 2: SAUVEGARDE BASE ACTUELLE
# ============================================

echo -e "${YELLOW}💾 Sauvegarde base actuelle (sécurité)...${NC}"
SAFETY_BACKUP="/tmp/timetrack_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

mysqldump -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  --single-transaction 2>/dev/null | gzip > "$SAFETY_BACKUP"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo -e "${GREEN}✅ Sauvegarde sécurité OK: $SAFETY_BACKUP${NC}"
else
  echo -e "${RED}❌ ERREUR: Impossible de sauvegarder base actuelle${NC}"
  echo "Restauration annulée par sécurité"
  pm2 start timetrack
  exit 1
fi

# ============================================
# ÉTAPE 3: SUPPRESSION BASE ACTUELLE
# ============================================

echo -e "${YELLOW}🗑️  Suppression base actuelle...${NC}"
mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_NAME;"
echo -e "${GREEN}✅ Base supprimée${NC}"

# ============================================
# ÉTAPE 4: RECRÉATION BASE VIDE
# ============================================

echo -e "${YELLOW}📦 Création base vide...${NC}"
mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo -e "${GREEN}✅ Base créée${NC}"

# ============================================
# ÉTAPE 5: RESTAURATION BACKUP
# ============================================

echo -e "${YELLOW}⏳ Restauration backup (peut prendre plusieurs minutes)...${NC}"

gunzip < "$BACKUP_FILE" | mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/tmp/restore_error.log

if [ ${PIPESTATUS[1]} -eq 0 ]; then
  echo -e "${GREEN}✅ Restauration OK${NC}"
else
  ERROR_MSG=$(cat /tmp/restore_error.log)
  echo -e "${RED}❌ ERREUR lors de la restauration:${NC}"
  echo "$ERROR_MSG"
  echo ""
  echo -e "${YELLOW}🔄 Tentative restauration sauvegarde sécurité...${NC}"
  gunzip < "$SAFETY_BACKUP" | mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
  pm2 start timetrack
  exit 1
fi

# ============================================
# ÉTAPE 6: VÉRIFICATION INTÉGRITÉ
# ============================================

echo -e "${YELLOW}🔍 Vérification intégrité données...${NC}"

USER_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -se "SELECT COUNT(*) FROM users;")
SESSION_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -se "SELECT COUNT(*) FROM work_sessions;")
AUDIT_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -se "SELECT COUNT(*) FROM audit_logs;")

echo "   - Utilisateurs: $USER_COUNT"
echo "   - Sessions: $SESSION_COUNT"
echo "   - Logs audit: $AUDIT_COUNT"

if [ "$USER_COUNT" -eq 0 ]; then
  echo -e "${RED}⚠️  WARNING: Aucun utilisateur trouvé !${NC}"
fi

# ============================================
# ÉTAPE 7: REDÉMARRAGE APPLICATION
# ============================================

echo -e "${YELLOW}🚀 Redémarrage application...${NC}"
pm2 start timetrack
sleep 3
pm2 list

# ============================================
# ÉTAPE 8: TEST FONCTIONNEL
# ============================================

echo -e "${YELLOW}🧪 Test fonctionnel API...${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me)

if [ "$HTTP_CODE" == "401" ]; then
  echo -e "${GREEN}✅ Application fonctionne (code 401 attendu)${NC}"
else
  echo -e "${RED}⚠️  WARNING: Code HTTP inattendu: $HTTP_CODE${NC}"
fi

# ============================================
# RÉSUMÉ
# ============================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ RESTAURATION TERMINÉE${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Backup restauré: $BACKUP_FILE"
echo "Sauvegarde sécurité: $SAFETY_BACKUP"
echo "Utilisateurs: $USER_COUNT"
echo "Sessions: $SESSION_COUNT"
echo ""
echo -e "${YELLOW}💡 Prochaines étapes:${NC}"
echo "   1. Vérifier application: https://timetrack.bgfibank.com"
echo "   2. Tester connexion utilisateur"
echo "   3. Vérifier dashboards (données cohérentes)"
echo "   4. Conserver sauvegarde sécurité 7 jours: $SAFETY_BACKUP"
echo ""
