# ✅ CHECKLIST DÉPLOIEMENT PRODUCTION — TimeTrack BGFIBank

## 📋 AVANT LE DÉPLOIEMENT

### 1. Infrastructure serveur

- [ ] **Serveur dédié/VPS** : Ubuntu 22.04 LTS (recommandé) ou Windows Server 2022
- [ ] **RAM minimale** : 4 GB (8 GB recommandé)
- [ ] **Disque** : 50 GB minimum (SSD préférable)
- [ ] **CPU** : 2 cores minimum (4 cores recommandé)
- [ ] **IP publique fixe** + nom de domaine (`timetrack.bgfibank.com`)
- [ ] **Firewall** : UFW/Windows Firewall configuré
  - Port 80 (HTTP) ouvert temporairement (redirection HTTPS)
  - Port 443 (HTTPS) ouvert
  - Port 22 (SSH) ouvert uniquement depuis IP admin
  - Port 3306 (MySQL) **FERMÉ** (localhost uniquement)
  - Port 3000 (Node.js) **FERMÉ** (Nginx proxy uniquement)

### 2. Logiciels requis

- [ ] **Node.js** : v18 LTS ou v20 LTS installé
  ```bash
  node --version  # >= v18.0.0
  npm --version   # >= 9.0.0
  ```

- [ ] **MySQL** : 8.0+ ou MariaDB 10.6+ installé
  ```bash
  mysql --version  # >= 8.0.0
  ```

- [ ] **Nginx** : Latest stable installé
  ```bash
  nginx -v  # >= 1.20.0
  ```

- [ ] **PM2** : Installé globalement
  ```bash
  npm install -g pm2
  pm2 --version
  ```

- [ ] **Certbot** : Let's Encrypt CLI installé
  ```bash
  certbot --version
  ```

- [ ] **Git** : Pour déploiement code
  ```bash
  git --version
  ```

### 3. DNS & Certificat SSL

- [ ] **Enregistrement DNS A** : `timetrack.bgfibank.com` → IP serveur
  ```bash
  nslookup timetrack.bgfibank.com
  # Doit retourner l'IP du serveur
  ```

- [ ] **Enregistrement DNS CNAME** (optionnel) : `www.timetrack.bgfibank.com` → `timetrack.bgfibank.com`

- [ ] **Propagation DNS** : Attendre 1-24h après configuration
  ```bash
  ping timetrack.bgfibank.com
  ```

### 4. Sécurité système

- [ ] **Compte admin** : Créer utilisateur non-root avec sudo
  ```bash
  adduser admin
  usermod -aG sudo admin
  ```

- [ ] **SSH key** : Désactiver password auth, utiliser clés SSH
  ```bash
  # /etc/ssh/sshd_config
  PasswordAuthentication no
  PubkeyAuthentication yes
  ```

- [ ] **Fail2ban** : Installé pour bloquer brute-force SSH
  ```bash
  sudo apt install fail2ban
  sudo systemctl enable fail2ban
  ```

- [ ] **Mises à jour système** : Tous packages à jour
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

---

## 🚀 DÉPLOIEMENT

### ÉTAPE 1 : Installation application

```bash
# Se connecter au serveur
ssh admin@timetrack.bgfibank.com

# Cloner repository (ou copier fichiers)
cd /home/user
git clone https://github.com/votre-org/timetrack-bgfibank.git webapp
cd webapp/mysql-backend

# Installer dépendances (production uniquement)
npm ci --production

# Vérifier package.json
cat package.json
```

- [ ] **Code déployé** dans `/home/user/webapp/mysql-backend`
- [ ] **Dependencies installées** (`node_modules/` présent)
- [ ] **Pas de devDependencies** en production

### ÉTAPE 2 : Configuration environnement

```bash
# Créer fichier .env
cp .env.example .env
nano .env
```

**Contenu `.env` à configurer :**
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=timetrack_user
DB_PASSWORD=VOTRE_MOT_DE_PASSE_FORT_ICI
DB_NAME=timetrack_db
JWT_SECRET=GÉNÉRER_SECRET_64_CARACTÈRES_ALÉATOIRES
ALLOWED_ORIGINS=https://timetrack.bgfibank.com
```

- [ ] **`.env` créé** avec valeurs production
- [ ] **`DB_PASSWORD`** : Mot de passe fort 16+ caractères
- [ ] **`JWT_SECRET`** : Généré aléatoirement (64 caractères)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **`ALLOWED_ORIGINS`** : Domaine production uniquement
- [ ] **Permissions `.env`** : `chmod 600 .env` (lecture user uniquement)

### ÉTAPE 3 : Création base de données

```bash
# Se connecter à MySQL en root
sudo mysql -u root -p

# Exécuter schema.sql
source /home/user/webapp/mysql-backend/schema.sql;

# Vérifier tables créées
USE timetrack_db;
SHOW TABLES;

# Vérifier utilisateur MySQL créé
SELECT User, Host FROM mysql.user WHERE User = 'timetrack_user';

# Quitter MySQL
EXIT;
```

- [ ] **Base `timetrack_db`** créée
- [ ] **8 tables** présentes (users, work_sessions, audit_logs, etc.)
- [ ] **Index composites** créés (idx_ws_dept_start_status, etc.)
- [ ] **Utilisateur `timetrack_user`** créé avec droits limités

### ÉTAPE 4 : Migration index composites (si base existante)

```bash
# Appliquer migration index
mysql -u timetrack_user -p timetrack_db < migrations/001_add_composite_indexes.sql

# Vérifier index créés
mysql -u timetrack_user -p timetrack_db -e "SHOW INDEX FROM work_sessions WHERE Key_name LIKE 'idx_ws_%';"
```

- [ ] **4 index composites** ajoutés (dept_start_status, user_start_status, etc.)

### ÉTAPE 5 : Seed données initiales (ADMIN)

```bash
# Créer compte administrateur initial
mysql -u timetrack_user -p timetrack_db

# Insérer admin (mot de passe: admin123 — À CHANGER IMMÉDIATEMENT)
INSERT INTO users (first_name, last_name, email, password_hash, role, status)
VALUES ('Admin', 'Système', 'admin@bgfibank.com', 
  'pbkdf2:sha256:600000:e8f7d9c6b4a2e1f8d7c6b5a4e3f2d1c0:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1',
  'Administrateur', 'Actif');

EXIT;
```

- [ ] **Compte admin** créé (`admin@bgfibank.com`)
- [ ] **Mot de passe temporaire** : `admin123` (documenter pour changer post-déploiement)

### ÉTAPE 6 : Test application local (port 3000)

```bash
# Démarrer application temporairement
cd /home/user/webapp/mysql-backend
node server.js

# Dans un autre terminal, tester API
curl http://localhost:3000/api/auth/me
# Attendu: {"error":"Non autorisé"}

# Arrêter avec Ctrl+C
```

- [ ] **Application démarre** sans erreur
- [ ] **MySQL connexion OK** : Log `✅ Connecté à MySQL: localhost:3306/timetrack_db`
- [ ] **API répond** : Code 401 (normal sans token)

### ÉTAPE 7 : Configuration PM2 (daemon)

```bash
# Vérifier ecosystem.config.js pointe vers .env
cat ecosystem.config.js

# Démarrer avec PM2
pm2 start ecosystem.config.js

# Vérifier status
pm2 list
# Attendu: timetrack | online | 0 | 0 restarts

# Configurer démarrage auto au boot
pm2 startup
# Exécuter commande affichée (sudo env PATH=...)

pm2 save

# Tester redémarrage auto
sudo reboot
# Attendre 2 min, se reconnecter
pm2 list  # Doit afficher timetrack online
```

- [ ] **PM2 status** : `online`
- [ ] **Uptime** : > 0
- [ ] **Restarts** : 0
- [ ] **Démarrage auto** : Configuré (survit au reboot)

### ÉTAPE 8 : Configuration Nginx HTTPS

```bash
# Copier configuration Nginx
sudo cp /home/user/webapp/mysql-backend/nginx/timetrack.conf /etc/nginx/sites-available/

# Modifier domaine dans config
sudo nano /etc/nginx/sites-available/timetrack.conf
# Remplacer "timetrack.bgfibank.com" par votre domaine réel

# Activer site
sudo ln -s /etc/nginx/sites-available/timetrack.conf /etc/nginx/sites-enabled/

# Désactiver site par défaut (optionnel)
sudo rm /etc/nginx/sites-enabled/default

# Tester configuration
sudo nginx -t
# Attendu: syntax is ok, test is successful

# Générer certificat Let's Encrypt
sudo certbot certonly --nginx -d timetrack.bgfibank.com
# Suivre instructions, fournir email admin

# Générer DH params (améliore sécurité, prend 2-5 min)
sudo mkdir -p /etc/nginx/ssl
sudo openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048

# Redémarrer Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

- [ ] **Nginx config** : Copié et adapté
- [ ] **Certificat SSL** : Généré et valide
- [ ] **DH params** : Généré (2048 bits)
- [ ] **Nginx status** : `active (running)`
- [ ] **Auto-renewal certbot** : Configuré (cron automatique)

### ÉTAPE 9 : Test HTTPS production

```bash
# Test depuis serveur
curl -I https://timetrack.bgfibank.com
# Attendu: HTTP/2 200 ou 301

# Test API
curl https://timetrack.bgfibank.com/api/auth/me
# Attendu: {"error":"Non autorisé"}

# Test certificat SSL
openssl s_client -connect timetrack.bgfibank.com:443 -servername timetrack.bgfibank.com < /dev/null | grep "Verify return code"
# Attendu: Verify return code: 0 (ok)
```

- [ ] **Site accessible** : `https://timetrack.bgfibank.com`
- [ ] **Redirection HTTP→HTTPS** : Fonctionne
- [ ] **Certificat valide** : Cadenas vert navigateur
- [ ] **API répond** : Code 401

### ÉTAPE 10 : Login interface et configuration admin

```bash
# Ouvrir navigateur
https://timetrack.bgfibank.com

# Se connecter avec compte admin
# Email: admin@bgfibank.com
# Password: admin123

# 1. CHANGER IMMÉDIATEMENT mot de passe admin
# 2. Activer 2FA pour compte admin
# 3. Créer départements
# 4. Créer objectifs stratégiques
# 5. Créer processus métier
# 6. Créer tâches
# 7. Créer premiers utilisateurs
```

- [ ] **Login admin OK**
- [ ] **Mot de passe admin changé** (minimum 12 caractères)
- [ ] **2FA activé** pour admin (QR code scanné)
- [ ] **Départements créés** (minimum 1)
- [ ] **Objectifs créés** (Production, Admin, Contrôle)
- [ ] **Premiers utilisateurs créés** (agents test)

### ÉTAPE 11 : Configuration backup automatique

```bash
# Rendre scripts exécutables
chmod +x /home/user/webapp/mysql-backend/scripts/*.sh

# Éditer script backup (mot de passe MySQL)
nano /home/user/webapp/mysql-backend/scripts/backup-timetrack.sh
# Modifier DB_PASSWORD="VOTRE_MOT_DE_PASSE_ROOT_MYSQL"

# Copier script dans /usr/local/bin
sudo cp /home/user/webapp/mysql-backend/scripts/backup-timetrack.sh /usr/local/bin/

# Configurer cron backup quotidien 3h
sudo crontab -e
# Ajouter ligne:
0 3 * * * /usr/local/bin/backup-timetrack.sh >> /var/log/backup-timetrack.log 2>&1

# Tester backup manuel
sudo /usr/local/bin/backup-timetrack.sh

# Vérifier backup créé
ls -lh /var/backups/timetrack/
```

- [ ] **Script backup** : Testé et fonctionnel
- [ ] **Cron configuré** : Backup quotidien 3h
- [ ] **Backups stockés** : `/var/backups/timetrack/`
- [ ] **Logs backup** : `/var/log/backup-timetrack.log`

### ÉTAPE 12 : Configuration monitoring (optionnel mais recommandé)

```bash
# Installer monit
sudo apt install monit -y

# Configurer monit
sudo nano /etc/monit/monitrc
# Copier contenu de MAINTENANCE.md section 7.2

# Activer monit
sudo systemctl enable monit
sudo systemctl start monit

# Vérifier status
sudo monit status
```

- [ ] **Monit installé** et actif
- [ ] **Nginx monitoré** : Auto-restart si down
- [ ] **MySQL monitoré** : Auto-restart si down
- [ ] **Alertes email** : Configurées (optionnel)

---

## ✅ VÉRIFICATIONS POST-DÉPLOIEMENT

### Test fonctionnel complet (checklist utilisateur)

- [ ] **Agent** :
  - [ ] Login réussi
  - [ ] Dashboard affiche KPIs
  - [ ] Démarrer session → OK
  - [ ] Arrêter session → OK
  - [ ] Session manuelle → OK
  - [ ] Historique sessions visible

- [ ] **Chef de Département** :
  - [ ] Login réussi
  - [ ] Dashboard département visible
  - [ ] Valider session agent → OK
  - [ ] Rejeter session agent → OK
  - [ ] Voir équipe département

- [ ] **Directeur Général** :
  - [ ] Login réussi
  - [ ] Dashboard global visible
  - [ ] Méthode 3-3-3 affichée
  - [ ] Export CSV → OK
  - [ ] Graphiques Chart.js affichés

- [ ] **Administrateur** :
  - [ ] Créer utilisateur → OK
  - [ ] Modifier utilisateur → OK
  - [ ] Désactiver utilisateur → OK
  - [ ] Réinitialiser mot de passe → OK
  - [ ] Créer département/objectif/tâche → OK

### Test sécurité

- [ ] **HTTPS** : Certificat valide (cadenas vert)
- [ ] **HSTS** : Header présent
  ```bash
  curl -I https://timetrack.bgfibank.com | grep Strict-Transport-Security
  ```
- [ ] **CSP** : Header présent
  ```bash
  curl -I https://timetrack.bgfibank.com | grep Content-Security-Policy
  ```
- [ ] **Rate-limiting login** : 3 tentatives échouées → Blocage 15 min
- [ ] **2FA** : Activation fonctionne (Google Authenticator)
- [ ] **Session expiration** : Logout auto après 8h inactivité
- [ ] **SQL injection** : Paramètre `?month='; DROP TABLE users; --` bloqué

### Test performance

- [ ] **Dashboard DG** : Temps chargement < 2s
- [ ] **Liste utilisateurs** : Pagination fonctionne
- [ ] **Export CSV 1000 sessions** : < 5s
- [ ] **Requêtes slow query** : Aucune > 2s

### Test backup/restore

- [ ] **Backup manuel** : Fichier `.sql.gz` créé
  ```bash
  sudo /usr/local/bin/backup-timetrack.sh
  ls -lh /var/backups/timetrack/
  ```
- [ ] **Test restauration** : Base restaurée sans erreur
  ```bash
  sudo /home/user/webapp/mysql-backend/scripts/restore-timetrack.sh /var/backups/timetrack/db_YYYY-MM-DD_HHMM.sql.gz
  ```

---

## 📊 MONITORING POST-DÉPLOIEMENT (7 premiers jours)

### Jour 1 (J+0)
- [ ] Vérifier logs erreurs (toutes les 2h)
- [ ] Surveiller CPU/RAM (normal < 50%)
- [ ] Tester tous rôles utilisateurs
- [ ] Répondre incidents critiques < 30 min

### Jour 2-7 (J+1 à J+7)
- [ ] Logs erreurs quotidiens (matin 9h)
- [ ] Performance dashboards (< 2s)
- [ ] Backups automatiques (vérifier présence)
- [ ] Feedback utilisateurs (bugs, UX)

### Semaine 2+
- [ ] Passer en mode maintenance standard (voir MAINTENANCE.md)

---

## 📞 CONTACTS DÉPLOIEMENT

- **Chef de projet** : _______________
- **Administrateur système** : _______________
- **DBA MySQL** : _______________
- **RSSI (sécurité)** : _______________
- **Support utilisateurs** : _______________

---

## 📝 NOTES DÉPLOIEMENT

**Date déploiement** : _______________  
**Version déployée** : _______________  
**URL production** : https://timetrack.bgfibank.com  
**Backup NAS** : _______________  
**Incidents rencontrés** :

---

**Signature validation déploiement :**

- [ ] Chef de projet : _______________
- [ ] IT Manager : _______________
- [ ] RSSI : _______________

---

**Checklist complétée** : ☐ OUI  ☐ NON  
**Date validation** : _______________
