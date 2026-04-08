# 🔥 SOLUTION DÉFINITIVE — Base de données PERSISTANTE

## ❌ PROBLÈME ACTUEL

Vous utilisez **Cloudflare D1 local** (SQLite temporaire) :
- ✗ Base stockée dans `.wrangler/state/` (TEMPORAIRE)
- ✗ Données perdues au redémarrage/rebuild
- ✗ **INACCEPTABLE pour production bancaire**

---

## ✅ SOLUTION : MYSQL PERSISTANT

Vous avez DÉJÀ un backend MySQL complet prêt à l'emploi :
- ✓ `/home/user/webapp/mysql-backend/` — Backend Node.js + Express + MySQL
- ✓ Base MySQL **PERSISTANTE** sur disque
- ✓ Données **JAMAIS perdues**
- ✓ **Production-ready**

---

## 🚀 MIGRATION IMMÉDIATE (5 minutes)

### ÉTAPE 1 : Installer MySQL (si pas déjà fait)

**Sur Ubuntu/Debian :**
```bash
# Sur votre serveur de production
sudo apt update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql
```

**Sur Windows Server :**
```powershell
# Télécharger MySQL Installer
# https://dev.mysql.com/downloads/installer/
# Ou utiliser Chocolatey :
choco install mysql -y
```

**Sur macOS (développement local) :**
```bash
brew install mysql
brew services start mysql
```

### ÉTAPE 2 : Initialiser base MySQL

```bash
# Se connecter au serveur
cd /home/user/webapp/mysql-backend

# Créer base de données + utilisateur
node scripts/init-db.js

# OU manuellement avec MySQL :
mysql -u root -p < schema.sql
mysql -u root -p timetrack_db < seed.sql
```

**Ce que ça fait :**
- Crée base `timetrack_db`
- Crée utilisateur `timetrack_user` avec mot de passe
- Crée toutes les tables (users, work_sessions, audit_logs, etc.)
- Insère données de test (admin, départements, objectifs)

### ÉTAPE 3 : Configurer environnement

```bash
cd /home/user/webapp/mysql-backend

# Créer fichier .env
nano .env
```

**Contenu `.env` :**
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=timetrack_user
DB_PASSWORD=TimeTrack@BGFIBank2024!
DB_NAME=timetrack_db
JWT_SECRET=GÉNÉRER_SECRET_64_CARACTÈRES_ICI
ALLOWED_ORIGINS=http://localhost:3000
```

**Générer JWT_SECRET :**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ÉTAPE 4 : Démarrer avec MySQL (PM2)

```bash
cd /home/user/webapp/mysql-backend

# Arrêter ancien service Cloudflare D1
pm2 delete timetrack 2>/dev/null || true

# Démarrer nouveau service MySQL
pm2 start ecosystem.config.js
pm2 save

# Vérifier
pm2 list
pm2 logs timetrack --lines 20
```

**Vérification :**
```bash
# Doit afficher : "✅ Connecté à MySQL: localhost:3306/timetrack_db"
pm2 logs timetrack | grep MySQL
```

### ÉTAPE 5 : Tester connexion

```bash
# Test API
curl http://localhost:3000/api/auth/me
# Attendu: {"error":"Non autorisé"}

# Test login admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bgfibank.com","password":"admin123"}'
# Attendu: {"token":"...","user":{...}}
```

---

## 🎯 RÉSULTAT : BASE PERSISTANTE À VIE

### Avant (Cloudflare D1 local — ❌ MAUVAIS)
```
/home/user/webapp/.wrangler/state/v3/d1/
  └─ miniflare-D1DatabaseObject/
       └─ [BASE TEMPORAIRE — SUPPRIMÉE AU REBUILD]
```

### Après (MySQL — ✅ BON)
```
/var/lib/mysql/timetrack_db/
  ├─ users.ibd           [PERSISTANT]
  ├─ work_sessions.ibd   [PERSISTANT]
  ├─ audit_logs.ibd      [PERSISTANT]
  └─ ... [TOUTES TABLES PERSISTANTES SUR DISQUE]
```

**Garanties :**
- ✅ Données **JAMAIS perdues**
- ✅ Survit aux redémarrages serveur
- ✅ Survit aux mises à jour code
- ✅ Backups quotidiens automatiques
- ✅ **Production-ready pour banque**

---

## 📊 COMPARAISON

| Critère | Cloudflare D1 local | MySQL Production |
|---------|---------------------|------------------|
| **Persistance** | ❌ Temporaire (.wrangler/) | ✅ Permanente (/var/lib/mysql/) |
| **Redémarrage** | ❌ Données perdues | ✅ Données conservées |
| **Rebuild** | ❌ Base recréée vide | ✅ Données intactes |
| **Backup** | ❌ Difficile | ✅ mysqldump quotidien |
| **Performance** | ⚠️ SQLite (mono-utilisateur) | ✅ MySQL (multi-utilisateurs) |
| **Production bancaire** | ❌ NON | ✅ OUI |

---

## 🔒 SÉCURITÉ PRODUCTION

### Fichiers sensibles à protéger

```bash
# Permissions strictes .env
chmod 600 /home/user/webapp/mysql-backend/.env

# Vérifier .gitignore
cat .gitignore
# Doit contenir:
# .env
# node_modules/
# logs/
```

### Backup automatique quotidien

```bash
# Ajouter au cron (3h du matin)
sudo crontab -e

# Ajouter ligne:
0 3 * * * /usr/local/bin/backup-timetrack.sh >> /var/log/backup-timetrack.log 2>&1
```

**Script `/usr/local/bin/backup-timetrack.sh` :**
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
mysqldump -u root -p timetrack_db \
  --single-transaction \
  --routines \
  --triggers \
  | gzip > /var/backups/timetrack_db_$DATE.sql.gz

# Conserver 30 jours
find /var/backups -name "timetrack_db_*.sql.gz" -mtime +30 -delete
```

---

## 🆘 DÉPANNAGE

### "Can't connect to MySQL server"

```bash
# Vérifier MySQL tourne
sudo systemctl status mysql

# Démarrer si arrêté
sudo systemctl start mysql

# Vérifier port 3306 ouvert
netstat -tlnp | grep 3306
```

### "Access denied for user 'timetrack_user'"

```bash
# Recréer utilisateur MySQL
mysql -u root -p

CREATE USER 'timetrack_user'@'localhost' IDENTIFIED BY 'TimeTrack@BGFIBank2024!';
GRANT ALL PRIVILEGES ON timetrack_db.* TO 'timetrack_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### "Table doesn't exist"

```bash
# Réinitialiser schéma
mysql -u root -p timetrack_db < /home/user/webapp/mysql-backend/schema.sql
mysql -u root -p timetrack_db < /home/user/webapp/mysql-backend/seed.sql
```

---

## 📞 SUPPORT

**Documentation complète :**
- `/home/user/webapp/mysql-backend/README.md`
- `/home/user/webapp/mysql-backend/MAINTENANCE.md`
- `/home/user/webapp/mysql-backend/DEPLOYMENT_CHECKLIST.md`

**Scripts utiles :**
- `scripts/init-db.js` — Créer base
- `scripts/backup-timetrack.sh` — Backup quotidien
- `scripts/restore-timetrack.sh` — Restauration urgence

---

## ✅ CHECKLIST MIGRATION

- [ ] MySQL installé et démarré
- [ ] Base `timetrack_db` créée (schema.sql)
- [ ] Données initiales insérées (seed.sql)
- [ ] Fichier `.env` configuré
- [ ] PM2 démarre backend MySQL
- [ ] Test login admin fonctionne
- [ ] Backup quotidien configuré (cron)
- [ ] `.env` protégé (chmod 600)
- [ ] `.gitignore` contient `.env`

---

**Une fois cette migration faite, vous n'aurez PLUS JAMAIS de problème de base de données perdue !**
