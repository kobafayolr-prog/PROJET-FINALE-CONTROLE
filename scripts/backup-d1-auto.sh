#!/bin/bash
# ============================================================
# Script de backup automatique D1 local (temporaire sandbox)
# Sauvegarde la base SQLite toutes les heures
# ============================================================

BACKUP_DIR="/home/user/webapp/backups/d1"
D1_PATH="/home/user/webapp/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
DATE=$(date +%Y-%m-%d_%H%M)

# Créer répertoire backup
mkdir -p "$BACKUP_DIR"

# Copier tous les fichiers .sqlite
if [ -d "$D1_PATH" ]; then
  cp -r "$D1_PATH" "$BACKUP_DIR/d1_backup_$DATE"
  
  # Créer dump SQL aussi
  cd /home/user/webapp
  npx wrangler d1 export timetrack-production --local \
    --output="$BACKUP_DIR/dump_$DATE.sql" 2>/dev/null || true
  
  echo "[$(date)] ✅ Backup D1 créé: $BACKUP_DIR/d1_backup_$DATE"
  
  # Garder seulement 10 derniers backups
  ls -t "$BACKUP_DIR" | tail -n +11 | xargs -I {} rm -rf "$BACKUP_DIR/{}"
else
  echo "[$(date)] ⚠️  Pas de base D1 trouvée"
fi
