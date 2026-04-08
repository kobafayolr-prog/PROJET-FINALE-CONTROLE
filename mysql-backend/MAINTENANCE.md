# 🔧 Guide de Maintenance Production — TimeTrack BGFIBank

## 📋 TABLE DES MATIÈRES

1. [Tâches quotidiennes (5-10 min/jour)](#tâches-quotidiennes)
2. [Tâches hebdomadaires (30 min/semaine)](#tâches-hebdomadaires)
3. [Tâches mensuelles (1-2h/mois)](#tâches-mensuelles)
4. [Incidents & Dépannage](#incidents--dépannage)
5. [Mises à jour & Sécurité](#mises-à-jour--sécurité)
6. [Backup & Restauration](#backup--restauration)
7. [Monitoring & Alertes](#monitoring--alertes)
8. [Gestion des utilisateurs](#gestion-des-utilisateurs)
9. [Performance & Optimisation](#performance--optimisation)
10. [Conformité & Audit](#conformité--audit)

---

## 1. TÂCHES QUOTIDIENNES (5-10 min/jour)

### 1.1 Vérifier l'état du système (matin 9h)

```bash
# Se connecter au serveur
ssh admin@timetrack.bgfibank.com

# Vérifier les services critiques
sudo systemctl status nginx
sudo systemctl status mysql
pm2 list

# Vérifier espace disque (alerte si > 80%)
df -h | grep -E '^/dev/(sda|vda|xvda)'

# Vérifier mémoire (alerte si swap utilisé)
free -h

# Vérifier CPU (normal < 70%)
top -bn1 | head -5
```

**Résultat attendu :**
- Nginx : `active (running)`
- MySQL : `active (running)`
- PM2 timetrack : `status: online`, `uptime: XXd`, `restarts: 0`
- Disque : `< 80%`
- Mémoire : `Swap: 0B used`
- CPU : `load average < 2.0`

### 1.2 Vérifier les logs d'erreurs

```bash
# Logs application (10 dernières erreurs)
pm2 logs timetrack --err --lines 10

# Logs Nginx (erreurs 5xx)
sudo tail -50 /var/log/nginx/timetrack-error.log | grep -E "50[0-9]"

# Logs MySQL (erreurs critiques)
sudo tail -50 /var/log/mysql/error.log | grep -i error

# Logs système (crash, OOM)
sudo journalctl -p err -n 20 --no-pager
```

**Actions si erreurs détectées :**
- Erreur 500 répétées → Redémarrer app : `pm2 restart timetrack`
- Erreur MySQL connexion → Vérifier `max_connections` atteint
- OOM Killer → Augmenter RAM ou optimiser queries

### 1.3 Vérifier certificat SSL (expire dans 30j)

```bash
# Vérifier expiration certificat
sudo certbot certificates | grep "Expiry Date"

# Tester renouvellement (dry-run)
sudo certbot renew --dry-run
```

**Alerte si expiration < 30 jours :** Renouveler manuellement `sudo certbot renew --force-renewal`

### 1.4 Vérifier accès applicatif (healthcheck)

```bash
# Test endpoint public HTTPS
curl -I https://timetrack.bgfibank.com

# Test API backend (doit retourner 401)
curl https://timetrack.bgfibank.com/api/auth/me

# Test base de données (via Node.js)
pm2 logs timetrack --lines 5 | grep "Connecté à MySQL"
```

**Résultat attendu :**
- HTTPS : `HTTP/2 200` ou `301`
- API : `HTTP/2 401` (normal, pas de token)
- MySQL : `✅ Connecté à MySQL: localhost:3306/timetrack_db`

---

## 2. TÂCHES HEBDOMADAIRES (30 min/semaine — Tous les lundis 10h)

### 2.1 Analyse des logs d'audit (conformité bancaire)

```bash
# Se connecter au serveur
ssh admin@timetrack.bgfibank.com

# Connexions échouées (tentatives brute-force)
mysql -u timetrack_user -p timetrack_db -e "
SELECT DATE(created_at) as date, COUNT(*) as failed_logins, 
       GROUP_CONCAT(DISTINCT ip_address) as ips
FROM audit_logs 
WHERE action = 'LOGIN_FAILED' 
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY failed_logins DESC;"
```

**Action si > 50 tentatives/jour depuis même IP :**
```bash
# Bloquer IP au firewall
sudo ufw deny from <IP_SUSPECT>
sudo ufw status numbered
```

### 2.2 Resets mot de passe suspects

```bash
# Lister resets derniers 7 jours
mysql -u timetrack_user -p timetrack_db -e "
SELECT created_at, details 
FROM audit_logs 
WHERE action IN ('RESET_PASSWORD_REQUEST', 'RESET_PASSWORD_DONE')
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;"
```

**Alerte si > 10 resets/semaine :** Vérifier avec RH si comptes compromis.

### 2.3 Activations/désactivations 2FA

```bash
# Vérifier mouvements 2FA
mysql -u timetrack_user -p timetrack_db -e "
SELECT created_at, details 
FROM audit_logs 
WHERE action IN ('2FA_ENABLED', '2FA_DISABLED')
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;"
```

**Alerte si désactivation 2FA :** Contacter utilisateur (vérifier si légitime).

### 2.4 Nettoyage tokens invalidés (table grandissante)

```bash
# Supprimer tokens expirés (> 8h après invalidation)
mysql -u timetrack_user -p timetrack_db -e "
DELETE FROM invalidated_tokens 
WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY);"

# Vérifier taille table
mysql -u timetrack_user -p timetrack_db -e "
SELECT COUNT(*) as total_tokens FROM invalidated_tokens;"
```

**Normal :** < 10 000 tokens. Si > 50 000 → Problème logout massif.

### 2.5 Mise à jour dépendances Node.js (sécurité)

```bash
# Vérifier vulnérabilités NPM
cd /home/user/webapp/mysql-backend
npm audit

# Mettre à jour packages sécurité critique uniquement
npm audit fix --only=prod

# Redémarrer application
pm2 restart timetrack
pm2 save
```

**Toujours tester en pré-production avant production !**

### 2.6 Rotation logs Nginx (si pas automatique)

```bash
# Vérifier taille logs
sudo du -sh /var/log/nginx/timetrack-*.log

# Compresser logs > 7 jours
sudo find /var/log/nginx -name "timetrack-*.log.*" -mtime +7 -exec gzip {} \;

# Supprimer logs > 90 jours
sudo find /var/log/nginx -name "timetrack-*.log.*.gz" -mtime +90 -delete
```

---

## 3. TÂCHES MENSUELLES (1-2h/mois — Premier du mois)

### 3.1 Backup base de données (archivage mensuel)

```bash
# Créer backup complet MySQL
DATE=$(date +%Y-%m-%d)
sudo mysqldump -u root -p timetrack_db \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  > /var/backups/timetrack_db_$DATE.sql

# Compresser backup
gzip /var/backups/timetrack_db_$DATE.sql

# Transférer sur stockage externe (NAS/S3)
# Exemple rsync vers NAS
rsync -avz /var/backups/timetrack_db_$DATE.sql.gz \
  backup@nas.bgfibank.local:/backups/timetrack/

# Supprimer backups locaux > 30 jours
find /var/backups -name "timetrack_db_*.sql.gz" -mtime +30 -delete
```

### 3.2 Test restauration backup (conformité PCI-DSS)

```bash
# Créer base de test
mysql -u root -p -e "CREATE DATABASE timetrack_test;"

# Restaurer dernier backup
gunzip < /var/backups/timetrack_db_$(date +%Y-%m-%d).sql.gz | \
  mysql -u root -p timetrack_test

# Vérifier intégrité
mysql -u root -p timetrack_test -e "
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM work_sessions;
SELECT COUNT(*) FROM audit_logs;"

# Supprimer base test
mysql -u root -p -e "DROP DATABASE timetrack_test;"
```

### 3.3 Analyse performance requêtes SQL

```bash
# Activer slow query log (temporaire)
mysql -u root -p -e "
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- Requêtes > 2s
SET GLOBAL log_queries_not_using_indexes = 'ON';"

# Laisser tourner 24h, puis analyser
sudo mysqldumpslow -s t -t 10 /var/log/mysql/slow-query.log

# Désactiver slow query log
mysql -u root -p -e "SET GLOBAL slow_query_log = 'OFF';"
```

**Action si requête > 5s :** Créer index manquant ou optimiser query.

### 3.4 Nettoyage données anciennes (RGPD 3 ans)

```bash
# Archiver sessions > 3 ans (conformité RGPD)
mysql -u timetrack_user -p timetrack_db -e "
SELECT COUNT(*) as sessions_to_archive
FROM work_sessions 
WHERE start_time < DATE_SUB(NOW(), INTERVAL 3 YEAR);"

# Si > 0, exporter vers archive
mysqldump -u root -p timetrack_db work_sessions \
  --where="start_time < DATE_SUB(NOW(), INTERVAL 3 YEAR)" \
  > /var/backups/archive_sessions_$(date +%Y-%m).sql

# Supprimer de la base (après validation export)
mysql -u timetrack_user -p timetrack_db -e "
DELETE FROM work_sessions 
WHERE start_time < DATE_SUB(NOW(), INTERVAL 3 YEAR);"
```

### 3.5 Rapport activité utilisateurs (RH)

```bash
# Utilisateurs inactifs > 90 jours
mysql -u timetrack_user -p timetrack_db -e "
SELECT email, first_name, last_name, last_login, 
       DATEDIFF(NOW(), last_login) as jours_inactivite
FROM users 
WHERE last_login < DATE_SUB(NOW(), INTERVAL 90 DAY)
  AND status = 'Actif'
ORDER BY last_login ASC;" > /tmp/users_inactifs.csv

# Envoyer rapport à RH
mail -s "Utilisateurs inactifs TimeTrack" rh@bgfibank.com < /tmp/users_inactifs.csv
```

### 3.6 Mise à jour MySQL (patch sécurité)

```bash
# Vérifier version actuelle
mysql --version

# Vérifier mises à jour disponibles
sudo apt update
sudo apt list --upgradable | grep mysql

# Mettre à jour (UNIQUEMENT si patch sécurité critique)
sudo apt upgrade mysql-server -y

# Redémarrer MySQL
sudo systemctl restart mysql

# Vérifier application fonctionne
curl https://timetrack.bgfibank.com/api/auth/me
```

**⚠️ TOUJOURS tester en pré-production avant production !**

---

## 4. INCIDENTS & DÉPANNAGE

### 4.1 Application DOWN (erreur 502/503)

**Diagnostic :**
```bash
# Vérifier PM2
pm2 list
pm2 logs timetrack --err --lines 50

# Si status "errored" ou "stopped"
pm2 restart timetrack

# Si crash boucle infinie
pm2 stop timetrack
pm2 flush  # Vider logs
pm2 start timetrack
pm2 save
```

**Causes fréquentes :**
- Port 3000 déjà utilisé → `fuser -k 3000/tcp`
- Base MySQL inaccessible → `sudo systemctl restart mysql`
- Mémoire saturée → `pm2 restart timetrack`

### 4.2 Base de données lente (timeout)

**Diagnostic :**
```bash
# Vérifier processus MySQL actifs
mysql -u root -p -e "SHOW FULL PROCESSLIST;"

# Tuer requête bloquante (si > 60s)
mysql -u root -p -e "KILL <PROCESS_ID>;"

# Vérifier tables corrompues
mysqlcheck -u root -p timetrack_db --check --all-databases
```

**Solutions :**
- Requête lente → Ajouter index (voir section 3.3)
- Table corrompue → `mysqlcheck --repair`
- Max connections atteint → Augmenter `max_connections` dans `/etc/mysql/my.cnf`

### 4.3 Certificat SSL expiré (site inaccessible)

```bash
# Forcer renouvellement
sudo certbot renew --force-renewal

# Redémarrer Nginx
sudo systemctl restart nginx

# Vérifier expiration
openssl s_client -connect timetrack.bgfibank.com:443 -servername timetrack.bgfibank.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

### 4.4 Disque saturé (> 95%)

**Diagnostic :**
```bash
# Identifier gros fichiers
sudo du -sh /var/log/* | sort -h
sudo du -sh /var/lib/mysql/* | sort -h
sudo du -sh /home/user/webapp/mysql-backend/logs/* | sort -h

# Nettoyer logs PM2
pm2 flush

# Nettoyer logs Nginx
sudo find /var/log/nginx -name "*.log.*" -mtime +7 -delete

# Nettoyer logs MySQL binaires (si réplication désactivée)
mysql -u root -p -e "PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 7 DAY);"
```

### 4.5 Attaque brute-force (tentatives login massives)

**Diagnostic :**
```bash
# Vérifier logs audit
mysql -u timetrack_user -p timetrack_db -e "
SELECT ip_address, COUNT(*) as tentatives 
FROM audit_logs 
WHERE action = 'LOGIN_FAILED' 
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY ip_address 
HAVING tentatives > 20
ORDER BY tentatives DESC;"
```

**Action immédiate :**
```bash
# Bloquer IP attaquante
sudo ufw deny from <IP_ATTAQUANT>

# Augmenter durée blocage rate-limit (dans server.js)
# BLOCK_DURATION = 60 * 60 * 1000  // 1 heure au lieu de 15 min
pm2 restart timetrack
```

---

## 5. MISES À JOUR & SÉCURITÉ

### 5.1 Mise à jour système d'exploitation

**Fréquence :** Tous les mardis soir 22h (hors heures ouvrables)

```bash
# Se connecter
ssh admin@timetrack.bgfibank.com

# Mettre à jour liste packages
sudo apt update

# Lister mises à jour disponibles
apt list --upgradable

# Installer mises à jour sécurité uniquement
sudo unattended-upgrade -d

# OU installer toutes mises à jour (si testé pré-prod)
sudo apt upgrade -y

# Redémarrer si kernel mis à jour
if [ -f /var/run/reboot-required ]; then
  echo "Redémarrage requis"
  sudo reboot
fi
```

**⚠️ Toujours notifier utilisateurs avant redémarrage !**

### 5.2 Mise à jour Node.js (LTS)

**Fréquence :** Tous les 6 mois (ou si CVE critique)

```bash
# Vérifier version actuelle
node --version

# Installer nouvelle version LTS (via nvm)
nvm install --lts
nvm use --lts

# Réinstaller dépendances
cd /home/user/webapp/mysql-backend
npm ci --production

# Redémarrer application
pm2 restart timetrack
pm2 save

# Vérifier logs
pm2 logs timetrack --lines 50
```

### 5.3 Patch sécurité critique (0-day)

**Procédure d'urgence (< 24h) :**

1. **Notification reçue** (CVE npm/Node.js/MySQL/Nginx)
2. **Évaluer criticité** : Score CVSS > 7.0 = critique
3. **Tester en pré-production** (si disponible)
4. **Déployer en production :**

```bash
# Exemple: CVE critique npm package
cd /home/user/webapp/mysql-backend
npm audit fix --force
pm2 restart timetrack

# Vérifier fonctionnement
curl https://timetrack.bgfibank.com/api/auth/me
```

5. **Notifier RSSI** (Responsable Sécurité SI)
6. **Documenter patch** dans changelog

---

## 6. BACKUP & RESTAURATION

### 6.1 Stratégie de backup (règle 3-2-1)

**Configuration actuelle :**
- **3 copies** : Base prod + Backup local + Backup distant
- **2 supports** : Disque local + NAS/S3
- **1 hors site** : Backup cloud/datacenter distant

**Fréquence :**
- **Quotidien** : Backup automatique 3h du matin (cron)
- **Hebdomadaire** : Backup complet + archivage
- **Mensuel** : Test restauration (conformité)

### 6.2 Configuration backup automatique (cron)

```bash
# Éditer crontab root
sudo crontab -e

# Ajouter backup quotidien 3h
0 3 * * * /usr/local/bin/backup-timetrack.sh >> /var/log/backup-timetrack.log 2>&1
```

**Script `/usr/local/bin/backup-timetrack.sh` :**
```bash
#!/bin/bash
DATE=$(date +\%Y-\%m-\%d_\%H\%M)
BACKUP_DIR="/var/backups/timetrack"
RETENTION_DAYS=7

# Créer répertoire si inexistant
mkdir -p $BACKUP_DIR

# Backup MySQL
mysqldump -u root -pMOT_DE_PASSE_ROOT timetrack_db \
  --single-transaction \
  --routines \
  --triggers \
  | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup fichiers application (logs, config)
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
  /home/user/webapp/mysql-backend/logs \
  /home/user/webapp/mysql-backend/.env \
  /home/user/webapp/mysql-backend/ecosystem.config.js

# Copier vers NAS (rsync)
rsync -avz $BACKUP_DIR/ backup@nas.bgfibank.local:/backups/timetrack/

# Supprimer backups locaux > 7 jours
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Log succès
echo "✅ Backup $(date) : OK" >> /var/log/backup-timetrack.log
```

**Rendre exécutable :**
```bash
sudo chmod +x /usr/local/bin/backup-timetrack.sh
```

### 6.3 Restauration base de données (disaster recovery)

**Scénario : Perte données production**

```bash
# 1. Arrêter application
pm2 stop timetrack

# 2. Sauvegarder base corrompue (si possible)
mysqldump -u root -p timetrack_db > /tmp/timetrack_corrupted_$(date +%Y%m%d).sql

# 3. Supprimer base corrompue
mysql -u root -p -e "DROP DATABASE timetrack_db;"

# 4. Recréer base vide
mysql -u root -p -e "CREATE DATABASE timetrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. Restaurer dernier backup
gunzip < /var/backups/timetrack/db_YYYY-MM-DD_HHMM.sql.gz | mysql -u root -p timetrack_db

# 6. Vérifier intégrité données
mysql -u root -p timetrack_db -e "
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as sessions FROM work_sessions;
SELECT MAX(created_at) as last_audit FROM audit_logs;"

# 7. Redémarrer application
pm2 start timetrack

# 8. Vérifier fonctionnement
curl https://timetrack.bgfibank.com/api/auth/me
```

**RTO (Recovery Time Objective) : < 30 minutes**  
**RPO (Recovery Point Objective) : < 24 heures** (backup quotidien)

---

## 7. MONITORING & ALERTES

### 7.1 Métriques à surveiller

| Métrique | Seuil alerte | Action |
|----------|--------------|--------|
| CPU usage | > 80% pendant 5 min | Investiguer processus gourmand |
| RAM usage | > 90% | Redémarrer PM2 ou augmenter RAM |
| Disque usage | > 85% | Nettoyer logs ou augmenter disque |
| MySQL connections | > 80% max_connections | Optimiser queries ou augmenter limite |
| Response time API | > 2s | Vérifier slow queries SQL |
| Uptime application | < 99.5% | Investiguer crashs PM2 |
| Erreurs 5xx | > 10/heure | Vérifier logs application |
| Tentatives login échouées | > 50/heure | Vérifier attaque brute-force |
| Certificat SSL | Expire < 30j | Renouveler certbot |

### 7.2 Configuration alertes email (simple)

**Utiliser `monit` (léger) :**

```bash
# Installer monit
sudo apt install monit

# Configurer /etc/monit/monitrc
sudo nano /etc/monit/monitrc
```

**Contenu `/etc/monit/monitrc` :**
```
# Email alertes
set mailserver smtp.bgfibank.com port 587
set alert admin@bgfibank.com

# Vérifier Nginx
check process nginx with pidfile /var/run/nginx.pid
  start program = "/bin/systemctl start nginx"
  stop program = "/bin/systemctl stop nginx"
  if failed port 443 protocol https then restart

# Vérifier MySQL
check process mysql with pidfile /var/run/mysqld/mysqld.pid
  start program = "/bin/systemctl start mysql"
  stop program = "/bin/systemctl stop mysql"
  if failed port 3306 then restart

# Vérifier espace disque
check filesystem rootfs with path /
  if space usage > 85% then alert

# Vérifier mémoire
check system $HOST
  if memory usage > 90% then alert
  if cpu usage > 80% for 5 cycles then alert
```

**Démarrer monit :**
```bash
sudo systemctl enable monit
sudo systemctl start monit
sudo monit status
```

### 7.3 Dashboard monitoring (optionnel)

**PM2 Plus (gratuit 1 serveur) :**

```bash
# S'inscrire sur https://app.pm2.io
# Obtenir clé PM2_PUBLIC_KEY et PM2_SECRET_KEY

# Lier serveur
pm2 link <PM2_SECRET_KEY> <PM2_PUBLIC_KEY> timetrack-prod

# Activer métriques
pm2 install pm2-server-monit
```

**Accès dashboard :** https://app.pm2.io

---

## 8. GESTION DES UTILISATEURS

### 8.1 Créer nouvel utilisateur (via interface admin)

**Via UI :** https://timetrack.bgfibank.com (compte Administrateur)

**Via SQL (urgence) :**
```bash
mysql -u timetrack_user -p timetrack_db

# Générer hash mot de passe (Node.js)
node -e "
const crypto = require('crypto');
const pw = 'MotDePasseTemporaire123!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(pw, Buffer.from(salt, 'hex'), 600000, 32, 'sha256').toString('hex');
console.log('pbkdf2:sha256:600000:' + salt + ':' + hash);
"

# Insérer utilisateur
INSERT INTO users (first_name, last_name, email, password_hash, role, department_id, status)
VALUES ('Jean', 'Dupont', 'jean.dupont@bgfibank.com', 'pbkdf2:sha256:600000:...', 'Agent', 1, 'Actif');
```

### 8.2 Désactiver utilisateur (départ)

```bash
# Via SQL
mysql -u timetrack_user -p timetrack_db -e "
UPDATE users SET status = 'Inactif' WHERE email = 'ancien@bgfibank.com';"

# Révoquer tous tokens JWT actifs (forcer logout)
mysql -u timetrack_user -p timetrack_db -e "
INSERT INTO invalidated_tokens (token_hash, expires_at)
SELECT SHA2(CONCAT('force_logout_', id), 256), DATE_ADD(NOW(), INTERVAL 8 HOUR)
FROM users WHERE email = 'ancien@bgfibank.com';"
```

### 8.3 Réinitialiser mot de passe utilisateur

**Via interface admin :** Bouton "Réinitialiser mot de passe" → Code 30 min

**Via SQL (urgence) :**
```bash
# 1. Générer nouveau mot de passe temporaire
NEW_PASSWORD="Temp$(date +%s)!"

# 2. Hasher avec Node.js (voir 8.1)

# 3. Mettre à jour base
mysql -u timetrack_user -p timetrack_db -e "
UPDATE users 
SET password_hash = 'pbkdf2:sha256:600000:...', 
    updated_at = NOW() 
WHERE email = 'user@bgfibank.com';"

# 4. Envoyer mot de passe temporaire à utilisateur (email sécurisé)
echo "Votre nouveau mot de passe : $NEW_PASSWORD" | \
  mail -s "TimeTrack - Réinitialisation mot de passe" user@bgfibank.com
```

### 8.4 Activer/désactiver 2FA utilisateur

**Désactiver 2FA (urgence perte téléphone) :**
```bash
mysql -u timetrack_user -p timetrack_db -e "
UPDATE users 
SET twofa_enabled = 0, 
    twofa_secret = NULL, 
    twofa_backup_codes = NULL 
WHERE email = 'user@bgfibank.com';"

# Logger action
mysql -u timetrack_user -p timetrack_db -e "
INSERT INTO audit_logs (user_id, action, details, ip_address)
SELECT id, '2FA_DISABLED_ADMIN', 'Désactivation 2FA par admin (perte téléphone)', '127.0.0.1'
FROM users WHERE email = 'user@bgfibank.com';"
```

---

## 9. PERFORMANCE & OPTIMISATION

### 9.1 Analyse requêtes lentes (mensuel)

```bash
# Activer slow query log
mysql -u root -p -e "
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- Requêtes > 1s
SET GLOBAL log_queries_not_using_indexes = 'ON';"

# Attendre 24h collecte données

# Analyser top 10 requêtes lentes
sudo mysqldumpslow -s t -t 10 /var/log/mysql/slow-query.log

# Désactiver
mysql -u root -p -e "SET GLOBAL slow_query_log = 'OFF';"
```

**Actions correctives :**
- Requête sans index → Créer index manquant
- Query inefficace → Optimiser avec EXPLAIN
- Trop de JOIN → Dénormaliser ou cache Redis

### 9.2 Optimiser tables MySQL (fragmentation)

```bash
# Vérifier fragmentation (monthly)
mysql -u timetrack_user -p timetrack_db -e "
SELECT table_name, 
       ROUND(data_length/1024/1024, 2) AS data_mb,
       ROUND(data_free/1024/1024, 2) AS fragmented_mb,
       ROUND(data_free/data_length*100, 2) AS fragmentation_pct
FROM information_schema.tables
WHERE table_schema = 'timetrack_db'
  AND data_free > 0
ORDER BY fragmentation_pct DESC;"

# Si fragmentation > 20%, optimiser
mysql -u timetrack_user -p timetrack_db -e "OPTIMIZE TABLE work_sessions;"
mysql -u timetrack_user -p timetrack_db -e "OPTIMIZE TABLE audit_logs;"
```

### 9.3 Purger logs audit anciens (> 1 an)

```bash
# Archiver logs > 1 an
mysqldump -u root -p timetrack_db audit_logs \
  --where="created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR)" \
  | gzip > /var/backups/archive_audit_$(date +%Y).sql.gz

# Supprimer de la base (après archivage)
mysql -u timetrack_user -p timetrack_db -e "
DELETE FROM audit_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR) 
LIMIT 10000;"  # Par batch pour éviter lock

# Répéter jusqu'à 0 lignes affectées
```

---

## 10. CONFORMITÉ & AUDIT

### 10.1 Rapport activité mensuel (Direction)

```bash
# Statistiques mois écoulé
mysql -u timetrack_user -p timetrack_db -e "
SELECT 
  COUNT(DISTINCT user_id) as users_actifs,
  COUNT(*) as sessions_total,
  SUM(duration_minutes) as minutes_total,
  ROUND(SUM(duration_minutes)/60, 2) as heures_total,
  ROUND(AVG(duration_minutes), 2) as duree_moy_minutes
FROM work_sessions
WHERE start_time >= DATE_SUB(NOW(), INTERVAL 1 MONTH);" > /tmp/rapport_$(date +%Y-%m).txt

# Envoyer à Direction
mail -s "TimeTrack - Rapport mensuel $(date +%B\ %Y)" direction@bgfibank.com < /tmp/rapport_$(date +%Y-%m).txt
```

### 10.2 Logs conformité PCI-DSS (si paiements)

**Requis si TimeTrack gère paiements/données bancaires :**

```bash
# Exporter logs audit mois écoulé (conformité)
mysql -u timetrack_user -p timetrack_db -e "
SELECT * FROM audit_logs 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
ORDER BY created_at DESC;" \
  | gzip > /var/backups/compliance/audit_$(date +%Y-%m).csv.gz

# Conserver 7 ans (exigence PCI-DSS)
```

### 10.3 Test intrusion annuel (RSSI)

**Fréquence :** Annuel (ou après changement majeur)

**Prestataire externe :** Cabinet sécurité agréé

**Livrables attendus :**
- Rapport pentest (injection SQL, XSS, CSRF, etc.)
- Score OWASP Top 10
- Recommandations correctifs

### 10.4 Revue accès utilisateurs (trimestriel)

```bash
# Lister utilisateurs actifs par rôle
mysql -u timetrack_user -p timetrack_db -e "
SELECT role, COUNT(*) as nb_users
FROM users 
WHERE status = 'Actif'
GROUP BY role
ORDER BY role;"

# Vérifier cohérence avec organigramme RH
```

---

## 📞 CONTACTS URGENCE

| Rôle | Nom | Contact | Disponibilité |
|------|-----|---------|---------------|
| **Administrateur système** | IT BGFIBank | +XXX XXX XXX | 24/7 |
| **DBA MySQL** | IT BGFIBank | +XXX XXX XXX | Lun-Ven 8h-18h |
| **RSSI** | Sécurité BGFIBank | +XXX XXX XXX | 24/7 (incidents sécurité) |
| **Support applicatif** | Équipe TimeTrack | support@bgfibank.com | Lun-Ven 8h-17h |
| **Hébergeur** | Datacenter BGFIBank | +XXX XXX XXX | 24/7 |

---

## 📚 DOCUMENTATION ANNEXE

- [README.md](README.md) — Installation & démarrage
- [ROADMAP_10_10.md](ROADMAP_10_10.md) — Améliorations futures
- [nginx/README.md](nginx/README.md) — Configuration Nginx
- [schema.sql](schema.sql) — Structure base de données
- [Logs PM2] `pm2 logs timetrack`
- [Logs Nginx] `/var/log/nginx/timetrack-*.log`
- [Logs MySQL] `/var/log/mysql/error.log`

---

**Dernière mise à jour :** 8 avril 2026  
**Version :** 1.0  
**Auteur :** Équipe TimeTrack BGFIBank
