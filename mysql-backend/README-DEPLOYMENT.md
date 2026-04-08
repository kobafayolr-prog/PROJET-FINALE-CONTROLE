# 📦 TimeTrack BGFIBank - Package de Déploiement MySQL

## 📋 Vue d'ensemble

Ce package contient le backend **TimeTrack BGFIBank** prêt pour le déploiement sur **Windows Server** avec MySQL.

### ✅ Fonctionnalités incluses

- ✅ **Méthode 3-3-3** : Production (70%), Administration & Reporting (20%), Contrôle (10%)
- ✅ **Authentification sécurisée** : PBKDF2 (600 000 itérations) + JWT
- ✅ **7 rôles bancaires** : Agent, Chef de Service, Chef de Département, etc.
- ✅ **Dashboards analytiques** : Vue temps réel, KPIs, graphiques
- ✅ **Workflow de validation** : Agent → Chef → Admin
- ✅ **Audit logs** : Traçabilité complète
- ✅ **Rate limiting** : Protection contre les abus
- ✅ **CORS sécurisé** : Protection des API
- ✅ **Gestion des processus** : Avec `process_type` au lieu d'anciens objectifs

---

## 🖥️ Configuration requise

### Windows Server
- **OS** : Windows Server 2016/2019/2022 (64-bit)
- **RAM** : Minimum 4 GB (8 GB recommandé)
- **Disque** : 10 GB d'espace libre
- **Node.js** : v16.x LTS ou supérieur ([télécharger](https://nodejs.org/))
- **MySQL** : 5.7+ ou 8.0+ ([télécharger](https://dev.mysql.com/downloads/mysql/))
- **Navigateurs supportés** : Chrome, Firefox, Edge (dernières versions)

### Linux (optionnel)
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Node.js v16.x LTS+
- MySQL 5.7+ / MariaDB 10.4+

---

## 📦 Contenu du package

```
timetrack-bgfibank-mysql/
├── server.js                    # Backend Node.js + Express + MySQL2
├── package.json                 # Dépendances npm
├── ecosystem.config.js          # Configuration PM2 (production)
├── schema.sql                   # Schéma MySQL complet
├── seed-333.sql                 # Données initiales (méthode 3-3-3)
├── .env.example                 # Template de configuration
├── install-windows.bat          # Script installation Windows (AUTO)
├── start-windows.bat            # Script démarrage Windows
├── install-linux.sh             # Script installation Linux
├── start-linux.sh               # Script démarrage Linux
├── test-local.sh                # Script test local (sandbox)
├── README-DEPLOYMENT.md         # Ce fichier
├── DEPLOYMENT_CHECKLIST.md      # Checklist de déploiement
├── MAINTENANCE.md               # Guide de maintenance
├── migrations/
│   ├── 001_add_composite_indexes.sql
│   └── mysql/
│       └── 001_add_process_type.sql
├── public/
│   └── static/
│       ├── admin.js             # Dashboard Admin (dernière version)
│       ├── chef.js              # Dashboard Chef
│       ├── agent.js             # Interface Agent
│       └── ... (tous les assets frontend)
└── logs/                        # Logs de l'application (créé auto)
```

---

## 🚀 Installation rapide (Windows Server)

### Méthode 1 : Installation automatique (RECOMMANDÉE)

1. **Extraire le ZIP** dans `C:\TimeTrack\`

2. **Installer MySQL** :
   - Télécharger [MySQL Community Server 8.0](https://dev.mysql.com/downloads/mysql/)
   - Installer avec les paramètres par défaut
   - **Noter le mot de passe root** défini pendant l'installation

3. **Installer Node.js** :
   - Télécharger [Node.js LTS](https://nodejs.org/) (version 18.x ou 20.x)
   - Installer avec les paramètres par défaut

4. **Double-cliquer sur `install-windows.bat`**
   - Suivre les instructions à l'écran
   - Le script va :
     * Installer les dépendances npm
     * Créer la base de données MySQL
     * Importer le schéma et les données
     * Configurer les variables d'environnement

5. **Double-cliquer sur `start-windows.bat`**
   - Le serveur démarre sur http://localhost:3000

6. **Ouvrir le navigateur** : http://localhost:3000
   - Email : `admin@bgfibank.com`
   - Password : `Admin@BGFI2024!`

---

### Méthode 2 : Installation manuelle

#### Étape 1 : Créer la base de données MySQL

Ouvrir **MySQL Command Line Client** ou **MySQL Workbench** et exécuter :

```sql
CREATE DATABASE IF NOT EXISTS timetrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'timetrack_user'@'localhost' IDENTIFIED BY 'TimeTrack@BGFIBank2024!';
GRANT ALL PRIVILEGES ON timetrack_db.* TO 'timetrack_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Étape 2 : Importer le schéma

```bash
cd C:\TimeTrack
mysql -u timetrack_user -p timetrack_db < schema.sql
# Mot de passe: TimeTrack@BGFIBank2024!
```

#### Étape 3 : Importer les données initiales

```bash
mysql -u timetrack_user -p timetrack_db < seed-333.sql
```

#### Étape 4 : Appliquer les migrations

```bash
mysql -u timetrack_user -p timetrack_db < migrations\mysql\001_add_process_type.sql
```

#### Étape 5 : Installer les dépendances npm

Ouvrir **PowerShell** en tant qu'administrateur :

```powershell
cd C:\TimeTrack
npm install
```

#### Étape 6 : Configurer les variables d'environnement

Copier `.env.example` vers `.env` et modifier :

```env
PORT=3000
JWT_SECRET=CHANGEZ-CE-SECRET-EN-PRODUCTION-xyz123!
JWT_EXPIRY_SECONDS=28800

DB_HOST=localhost
DB_PORT=3306
DB_USER=timetrack_user
DB_PASSWORD=TimeTrack@BGFIBank2024!
DB_NAME=timetrack_db

ALLOWED_ORIGINS=http://localhost:3000
```

#### Étape 7 : Démarrer le serveur

```powershell
node server.js
```

---

## 🔧 Configuration avancée

### Utiliser PM2 pour la production (RECOMMANDÉ)

PM2 est un gestionnaire de processus pour Node.js qui permet de :
- ✅ Redémarrer automatiquement en cas de crash
- ✅ Gérer les logs
- ✅ Monitoring en temps réel

**Installation** :

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Commandes PM2** :

```bash
pm2 list                    # Liste des processus
pm2 logs timetrack-mysql    # Voir les logs
pm2 restart timetrack-mysql # Redémarrer
pm2 stop timetrack-mysql    # Arrêter
pm2 monit                   # Monitoring
```

---

### Configurer IIS (Internet Information Services)

Pour exposer l'application sur le réseau interne :

1. **Installer IIS** (via Server Manager → Add Roles → Web Server)

2. **Installer ARR** (Application Request Routing) :
   - [Télécharger ARR](https://www.iis.net/downloads/microsoft/application-request-routing)

3. **Créer un site IIS** :
   - Nom : `TimeTrack`
   - Port : `80` (ou `443` pour HTTPS)
   - Chemin physique : `C:\TimeTrack\public`

4. **Configurer le reverse proxy** (web.config) :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyInboundRule" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

5. **Redémarrer IIS** :

```powershell
iisreset
```

---

## 🔐 Sécurité

### ⚠️ IMPORTANT : À faire AVANT la mise en production

1. **Changer le secret JWT** dans `.env` :
   ```env
   JWT_SECRET=VOTRE-SECRET-SUPER-COMPLEXE-ICI-min-32-caracteres!
   ```

2. **Changer le mot de passe MySQL** :
   ```sql
   ALTER USER 'timetrack_user'@'localhost' IDENTIFIED BY 'NouveauMotDePasseTresComplexe!2024';
   ```

3. **Configurer CORS** pour votre domaine :
   ```env
   ALLOWED_ORIGINS=https://timetrack.bgfibank.com
   ```

4. **Activer HTTPS** :
   - Obtenir un certificat SSL
   - Configurer IIS avec HTTPS (port 443)

5. **Configurer le pare-feu Windows** :
   - Autoriser le port 3000 uniquement pour localhost
   - Autoriser les ports 80/443 pour l'accès réseau

---

## 🧪 Tests et vérification

### Test de connexion à la base de données

```bash
node -e "const mysql=require('mysql2/promise'); mysql.createPool({host:'localhost',user:'timetrack_user',password:'TimeTrack@BGFIBank2024!',database:'timetrack_db'}).query('SELECT 1').then(()=>console.log('✅ MySQL OK')).catch(e=>console.error('❌',e))"
```

### Test des endpoints API

```bash
# Health check
curl http://localhost:3000/api/health

# Login admin
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"email\":\"admin@bgfibank.com\",\"password\":\"Admin@BGFI2024!\"}"

# Liste des processus (nécessite token)
curl http://localhost:3000/api/admin/processes -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### Vérifier les données 3-3-3

```sql
-- Dans MySQL Command Line :
USE timetrack_db;

-- Objectifs 3-3-3
SELECT id, name, target_percentage, color, status 
FROM strategic_objectives 
WHERE status='Actif' 
ORDER BY id DESC 
LIMIT 3;

-- Processus avec process_type
SELECT id, name, process_type, status 
FROM processes 
LIMIT 10;
```

**Résultat attendu** :

| id | name | target_percentage | color |
|----|------|-------------------|-------|
| 12 | Contrôle | 10.00 | #10b981 |
| 11 | Administration & Reporting | 20.00 | #f59e0b |
| 10 | Production | 70.00 | #1e3a5f |

---

## 📊 Comptes utilisateurs par défaut

| Email | Password | Rôle |
|-------|----------|------|
| admin@bgfibank.com | Admin@BGFI2024! | Administrateur |
| dg@bgfibank.com | DG@BGFI2024! | Directeur Général |
| dd.finance@bgfibank.com | DD@BGFI2024! | Directeur de Département |
| chef.finance@bgfibank.com | Chef@BGFI2024! | Chef de Département |
| agent@bgfibank.com | Agent@BGFI2024! | Agent |

⚠️ **IMPORTANT** : Changer tous ces mots de passe en production !

---

## 📞 Support et maintenance

### Logs de l'application

Les logs sont stockés dans :
- **PM2** : `pm2 logs timetrack-mysql`
- **Fichier** : `logs/combined.log` et `logs/error.log`

### Backup de la base de données

```bash
# Backup manuel
mysqldump -u timetrack_user -p timetrack_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauration
mysql -u timetrack_user -p timetrack_db < backup_YYYYMMDD_HHMMSS.sql
```

### Mise à jour du système

1. Arrêter le serveur : `pm2 stop timetrack-mysql`
2. Sauvegarder la base : `mysqldump ...`
3. Appliquer les nouvelles migrations SQL
4. Mettre à jour le code : remplacer `server.js` et `public/static/`
5. Installer les nouvelles dépendances : `npm install`
6. Redémarrer : `pm2 restart timetrack-mysql`

---

## ❓ FAQ

### Le serveur ne démarre pas ?

- Vérifier que MySQL est démarré : `net start MySQL80`
- Vérifier les logs : `pm2 logs` ou consulter `logs/error.log`
- Vérifier que le port 3000 est libre : `netstat -ano | findstr :3000`

### Erreur "Cannot connect to MySQL" ?

- Vérifier les identifiants dans `.env`
- Vérifier que MySQL est accessible : `mysql -u timetrack_user -p`
- Vérifier le pare-feu Windows

### Les processus n'affichent pas le bon type ?

- Exécuter la migration : `mysql -u timetrack_user -p timetrack_db < migrations/mysql/001_add_process_type.sql`
- Vérifier : `SELECT id, name, process_type FROM processes LIMIT 5;`

### Le dashboard ne charge pas ?

- Vider le cache du navigateur : `Ctrl+Shift+R`
- Vérifier que les fichiers sont dans `public/static/`
- Vérifier les logs du serveur

---

## 📚 Documentation complète

- `DEPLOYMENT_CHECKLIST.md` : Checklist de déploiement étape par étape
- `MAINTENANCE.md` : Guide de maintenance et monitoring
- `GUIDE_DASHBOARD_ADMIN.md` : Guide d'utilisation dashboard admin
- `cahier_technique.html` : Documentation technique complète

---

## 📝 Changelog

### Version actuelle (Avril 2024)

- ✅ Méthode 3-3-3 implémentée (Production 70%, Admin 20%, Contrôle 10%)
- ✅ Colonne `process_type` dans table `processes`
- ✅ Dashboard admin mis à jour avec méthode 3-3-3
- ✅ Formulaire "Nouveau Processus" : label "Activités" au lieu de "Département"
- ✅ Migration MySQL `001_add_process_type.sql`
- ✅ Backend MySQL synchronisé avec version Cloudflare
- ✅ Données seed-333.sql avec les 3 objectifs actifs

---

## 📞 Contact

Pour toute question ou assistance, contacter l'équipe de développement.

**Bon déploiement ! 🚀**
