#!/bin/bash
# ============================================================
# Script de restauration automatique D1 local
# Restaure le dernier backup si base vide/absente
# ============================================================

BACKUP_DIR="/home/user/webapp/backups/d1"
D1_PATH="/home/user/webapp/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"

# Vérifier si base D1 existe et contient des données
cd /home/user/webapp
USER_COUNT=$(npx wrangler d1 execute timetrack-production --local \
  --command="SELECT COUNT(*) as count FROM users" 2>/dev/null | \
  grep -oP '"count":\s*\K\d+' || echo "0")

if [ "$USER_COUNT" -eq 0 ]; then
  echo "[$(date)] ⚠️  Base D1 vide ou absente (users: $USER_COUNT)"
  
  # Trouver dernier backup
  LAST_BACKUP=$(ls -t "$BACKUP_DIR"/d1_backup_* 2>/dev/null | head -1)
  
  if [ -n "$LAST_BACKUP" ]; then
    echo "[$(date)] 🔄 Restauration depuis: $LAST_BACKUP"
    
    # Créer répertoire D1 si absent
    mkdir -p "$D1_PATH"
    
    # Copier backup
    cp -r "$LAST_BACKUP"/* "$D1_PATH/" 2>/dev/null
    
    echo "[$(date)] ✅ Base D1 restaurée"
  else
    echo "[$(date)] ❌ Aucun backup trouvé, réinitialiser avec seed.sql"
  fi
else
  echo "[$(date)] ✅ Base D1 OK (users: $USER_COUNT)"
fi
