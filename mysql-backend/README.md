# TimeTrack BGFIBank — Backend MySQL

Version Node.js + Express + MySQL2 de TimeTrack BGFIBank.  
L'interface (Admin / Chef / Agent) est **identique** à la version Cloudflare D1.

---

## Prérequis

| Logiciel | Version min | Lien |
|----------|-------------|------|
| Node.js  | 16.x LTS    | https://nodejs.org/ |
| MySQL    | 5.7+ ou 8.x | https://dev.mysql.com/downloads/mysql/ |
| npm      | 8+          | (inclus avec Node.js) |

---

## Installation rapide

### Windows Server

```bat
:: 1. Double-cliquez sur install-windows.bat
:: 2. Suivez les instructions à l'écran
:: 3. Lancez start-windows.bat pour démarrer
```

### Linux / macOS

```bash
chmod +x install-linux.sh start-linux.sh
bash install-linux.sh
bash start-linux.sh
```

### Installation manuelle

```bash
# 1. Installer les dépendances
npm install

# 2. Créer la base de données (avec accès root MySQL)
node scripts/init-db.js

# 3. Démarrer le serveur
node server.js
# ou avec PM2 :
pm2 start ecosystem.config.js
```

---

## Configuration

Toutes les variables se configurent via des **variables d'environnement** ou directement dans `ecosystem.config.js` :

| Variable      | Valeur par défaut                       | Description           |
|---------------|-----------------------------------------|-----------------------|
| PORT          | 3000                                    | Port HTTP             |
| DB_HOST       | localhost                               | Hôte MySQL            |
| DB_PORT       | 3306                                    | Port MySQL            |
| DB_USER       | timetrack_user                          | Utilisateur MySQL     |
| DB_PASSWORD   | TimeTrack@BGFIBank2024!                 | Mot de passe MySQL    |
| DB_NAME       | timetrack_db                            | Nom de la base        |
| JWT_SECRET    | timetrack-bgfibank-secret-2024-x9k2p7m | Clé JWT (à changer !) |

Copiez `.env.example` en `.env` et adaptez les valeurs.

---

## Structure des fichiers

```
mysql-backend/
├── server.js               ← Application principale (Express + MySQL2)
├── package.json
├── ecosystem.config.js     ← Configuration PM2
├── schema.sql              ← Schéma MySQL (tables + index)
├── seed.sql                ← Données initiales (objectifs, depts, tâches, utilisateurs)
├── .env.example
├── install-windows.bat     ← Installation Windows Server
├── start-windows.bat       ← Démarrage Windows Server
├── install-linux.sh        ← Installation Linux/macOS
├── start-linux.sh          ← Démarrage Linux/macOS
├── scripts/
│   └── init-db.js          ← Script d'initialisation DB
├── public/
│   └── static/             ← Fichiers JS/CSS des interfaces (lien vers ../public/static)
└── logs/                   ← Journaux PM2
```

---

## Comptes par défaut

| Email                          | Mot de passe | Rôle               |
|--------------------------------|--------------|--------------------|
| admin@bgfibank.com             | admin123     | Administrateur     |
| chef.commercial@bgfibank.com   | Chef@2024    | Chef de Département|
| agent.commercial@bgfibank.com  | Agent@2024   | Agent              |
| maidou@bgfi.com                | Chef@2024    | Chef de Département|
| eliel@bgfi.com                 | Agent@2024   | Agent              |

---

## Différences vs version Cloudflare D1 (SQLite)

| Aspect         | Version D1 (SQLite)      | Version MySQL          |
|----------------|--------------------------|------------------------|
| Runtime        | Cloudflare Workers       | Node.js                |
| DB Driver      | `c.env.DB.prepare()`     | `mysql2/promise`       |
| Date actuelle  | `date('now')`            | `CURDATE()`            |
| Date format    | `strftime('%Y-%m', col)` | `DATE_FORMAT(col,'%Y-%m')` |
| Concaténation  | `col1 \|\| ' ' \|\| col2` | `CONCAT(col1,' ',col2)` |
| Timestamp      | `CURRENT_TIMESTAMP`      | `NOW()`                |
| Last Insert ID | `result.meta.last_row_id`| `result.insertId`      |
| Toutes les routes API | ✅ identiques     | ✅ identiques          |
| Interface UI   | ✅ identique             | ✅ identique           |

---

## Arrêter le serveur

```bash
# Avec PM2
pm2 stop timetrack

# Windows (mode direct)
Ctrl+C dans la fenêtre du serveur
```

---

## Sauvegarde de la base de données

```bash
# Exporter
mysqldump -u timetrack_user -p timetrack_db > backup_$(date +%Y%m%d).sql

# Restaurer
mysql -u timetrack_user -p timetrack_db < backup_YYYYMMDD.sql
```

---

*TimeTrack BGFIBank — Direction Informatique*
