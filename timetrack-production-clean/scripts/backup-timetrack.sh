#!/bin/bash
# ============================================================
# TimeTrack BGFIBank - Script Backup Automatique
# À exécuter quotidiennement via cron (3h du matin)
# ============================================================

set -e  # Arrêter si erreur

# Configuration
DATE=$(date +%Y-%m-%d_%H%M)
BACKUP_DIR="/var/backups/timetrack"
RETENTION_DAYS=7
DB_NAME="timetrack_db"
DB_USER="root"
DB_PASSWORD=""  # À remplir OU utiliser --defaults-extra-file

# NAS/Distant (optionnel)
REMOTE_BACKUP=false
REMOTE_HOST="backup@nas.bgfibank.local"
REMOTE_PATH="/backups/timetrack/"

# Email alertes (optionnel)
SEND_ALERTS=false
ALERT_EMAIL="admin@bgfibank.com"

# ============================================
# FONCTIONS
# ============================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/backup-timetrack.log
}

send_alert() {
  if [ "$SEND_ALERTS" = true ]; then
    echo "$2" | mail -s "TimeTrack Backup - $1" "$ALERT_EMAIL"
  fi
}

# ============================================
# VÉRIFICATIONS PRÉALABLES
# ============================================

log "========== DÉBUT BACKUP =========="

# Créer répertoire backup si inexistant
mkdir -p "$BACKUP_DIR"

# Vérifier espace disque disponible (minimum 5GB)
AVAILABLE_SPACE=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 5 ]; then
  log "❌ ERREUR: Espace disque insuffisant ($AVAILABLE_SPACE GB < 5GB)"
  send_alert "ERREUR" "Espace disque insuffisant: ${AVAILABLE_SPACE}GB"
  exit 1
fi

# Vérifier MySQL accessible
if ! mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &>/dev/null; then
  log "❌ ERREUR: Connexion MySQL impossible"
  send_alert "ERREUR" "Connexion MySQL échouée"
  exit 1
fi

# ============================================
# BACKUP BASE DE DONNÉES
# ============================================

log "📦 Backup base MySQL: $DB_NAME"

BACKUP_FILE_DB="$BACKUP_DIR/db_$DATE.sql.gz"

mysqldump -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --quick \
  --lock-tables=false \
  2>/tmp/backup_error.log | gzip > "$BACKUP_FILE_DB"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE_DB" | awk '{print $1}')
  log "✅ Backup DB OK: $BACKUP_FILE_DB ($SIZE)"
else
  ERROR_MSG=$(cat /tmp/backup_error.log)
  log "❌ ERREUR Backup DB: $ERROR_MSG"
  send_alert "ERREUR" "Backup DB échoué:\n$ERROR_MSG"
  exit 1
fi

# ============================================
# BACKUP FICHIERS APPLICATION
# ============================================

log "📦 Backup fichiers application"

BACKUP_FILE_APP="$BACKUP_DIR/app_$DATE.tar.gz"
APP_DIR="/home/user/webapp/mysql-backend"

tar -czf "$BACKUP_FILE_APP" \
  "$APP_DIR/logs" \
  "$APP_DIR/.env" \
  "$APP_DIR/ecosystem.config.js" \
  "$APP_DIR/nginx" \
  2>/dev/null || true  # Ignorer erreurs fichiers manquants

if [ -f "$BACKUP_FILE_APP" ]; then
  SIZE=$(du -h "$BACKUP_FILE_APP" | awk '{print $1}')
  log "✅ Backup APP OK: $BACKUP_FILE_APP ($SIZE)"
else
  log "⚠️  WARNING: Backup APP échoué (non critique)"
fi

# ============================================
# TRANSFERT VERS STOCKAGE DISTANT (optionnel)
# ============================================

if [ "$REMOTE_BACKUP" = true ]; then
  log "📤 Transfert vers NAS: $REMOTE_HOST"
  
  rsync -avz --timeout=300 "$BACKUP_DIR/" "$REMOTE_HOST:$REMOTE_PATH" 2>&1 | tee -a /var/log/backup-timetrack.log
  
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log "✅ Transfert distant OK"
  else
    log "❌ ERREUR: Transfert distant échoué"
    send_alert "WARNING" "Transfert vers NAS échoué (backup local OK)"
  fi
fi

# ============================================
# NETTOYAGE ANCIENS BACKUPS
# ============================================

log "🗑️  Nettoyage backups > $RETENTION_DAYS jours"

DELETED_COUNT=$(find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
log "✅ $DELETED_COUNT fichiers supprimés"

# ============================================
# VÉRIFICATION INTÉGRITÉ BACKUP (rapide)
# ============================================

log "🔍 Vérification intégrité backup"

# Tester décompression
gunzip -t "$BACKUP_FILE_DB" 2>/dev/null
if [ $? -eq 0 ]; then
  log "✅ Intégrité backup OK"
else
  log "❌ ERREUR: Backup corrompu !"
  send_alert "ERREUR CRITIQUE" "Backup MySQL corrompu: $BACKUP_FILE_DB"
  exit 1
fi

# ============================================
# STATISTIQUES FINALES
# ============================================

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | awk '{print $1}')
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)

log "========== FIN BACKUP =========="
log "📊 Statistiques:"
log "   - Backups totaux: $BACKUP_COUNT fichiers"
log "   - Espace utilisé: $TOTAL_SIZE"
log "   - Dernier backup: $BACKUP_FILE_DB"

# Alerte succès (optionnel)
if [ "$SEND_ALERTS" = true ]; then
  send_alert "SUCCÈS" "Backup quotidien OK\nDB: $(du -h $BACKUP_FILE_DB | awk '{print $1}')\nTotal: $TOTAL_SIZE"
fi

exit 0
