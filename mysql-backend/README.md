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

# 2. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env et définir JWT_SECRET et DB_PASSWORD

# 3. Créer la base de données (avec accès root MySQL)
node scripts/init-db.js

# 4. Démarrer le serveur
node server.js
# ou avec PM2 :
pm2 start ecosystem.config.js
```

---

## Configuration

**IMPORTANT :** Avant le premier démarrage, copiez `.env.example` vers `.env` et définissez les secrets :

```bash
cp .env.example .env
nano .env  # ou notepad .env sur Windows
```

**Valeurs obligatoires à changer en production :**
- `JWT_SECRET` : Générez un secret aléatoire avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DB_PASSWORD` : Mot de passe MySQL de l'utilisateur `timetrack_user`

Toutes les variables se configurent via le fichier **`.env`** :

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

## Comptes par défaut — Tous les rôles

| Email                           | Mot de passe | Rôle                     | Département       |
|---------------------------------|--------------|--------------------------|-------------------|
| admin@bgfibank.com              | admin123     | Administrateur           | —                 |
| dg@bgfibank.com                 | Bgfi@2024    | Directeur Général        | —                 |
| dir.commercial@bgfibank.com     | Bgfi@2024    | Directeur de Département | Direction Commerciale |
| dir.conformite@bgfibank.com     | Bgfi@2024    | Directeur de Département | Direction Conformité  |
| chef.commercial@bgfibank.com    | Chef@2024    | Chef de Département      | Direction Commerciale |
| maidou@bgfi.com                 | Chef@2024    | Chef de Département      | Direction des Risques |
| chef.service@bgfibank.com       | Bgfi@2024    | Chef de Service          | Direction Commerciale |
| agent.commercial@bgfibank.com   | Agent@2024   | Agent                    | Direction Commerciale |
| eliel@bgfi.com                  | Agent@2024   | Agent (samedi)           | Direction des Risques |
| agent2@bgfibank.com             | Bgfi@2024    | Agent                    | Direction Commerciale |

> **Note** : Les mots de passe sont stockés en SHA-256 dans le seed.
> À la **première connexion**, ils sont automatiquement migrés vers PBKDF2-SHA256
> (600 000 itérations) sans intervention manuelle.

---

## Routes API disponibles (56 routes)

### Authentification
| Méthode | Route                    | Description               |
|---------|--------------------------|---------------------------|
| POST    | /api/auth/login          | Connexion                 |
| GET     | /api/auth/me             | Profil utilisateur        |
| POST    | /api/auth/logout         | Déconnexion (blacklist JWT) |
| POST    | /api/auth/reset-request  | Demande reset mot de passe |
| POST    | /api/auth/reset-confirm  | Confirmation reset        |

### Administration (rôle : Administrateur)
| Méthode | Route                     | Description               |
|---------|---------------------------|---------------------------|
| GET/POST | /api/admin/users         | Liste / Création utilisateurs |
| PUT/DELETE | /api/admin/users/:id   | Modification / Suppression |
| GET     | /api/admin/users/:id/password | Voir mot de passe chiffré |
| GET/POST/PUT/DELETE | /api/admin/departments | CRUD départements |
| GET/POST/PUT/DELETE | /api/admin/objectives  | CRUD objectifs stratégiques |
| GET/POST/PUT/DELETE | /api/admin/processes   | CRUD processus |
| GET/POST/PUT/DELETE | /api/admin/tasks       | CRUD tâches |
| GET     | /api/admin/sessions      | Toutes les sessions       |
| GET     | /api/admin/stats         | Statistiques globales + ratio 3-3-3 |
| GET     | /api/admin/reports       | Rapports filtrés (export CSV) |
| GET     | /api/admin/audit         | Journal d'audit           |

### Agent
| Méthode | Route                        | Description               |
|---------|------------------------------|---------------------------|
| GET     | /api/agent/dashboard         | Tableau de bord           |
| GET     | /api/agent/tasks             | Tâches disponibles        |
| GET     | /api/agent/sessions          | Mes sessions              |
| GET     | /api/agent/sessions/active   | Session en cours          |
| POST    | /api/agent/sessions/start    | Démarrer session          |
| POST    | /api/agent/sessions/stop     | Terminer session          |
| POST    | /api/agent/sessions/manual   | Session manuelle          |
| GET     | /api/agent/stats             | Mes statistiques          |

### Chef de Service
| Méthode | Route                            | Description               |
|---------|----------------------------------|---------------------------|
| GET     | /api/chef-service/dashboard      | Tableau de bord           |
| GET     | /api/chef-service/tasks          | Tâches disponibles        |
| GET/POST | /api/chef-service/sessions      | Mes sessions / Active     |
| POST    | /api/chef-service/sessions/start | Démarrer session          |
| POST    | /api/chef-service/sessions/stop  | Terminer session          |

### Chef de Département
| Méthode | Route                      | Description               |
|---------|----------------------------|---------------------------|
| GET     | /api/chef/dashboard        | Tableau de bord + ratio 3-3-3 |
| GET     | /api/chef/live             | Vue temps réel des agents |
| GET     | /api/chef/team             | Liste équipe              |
| GET     | /api/chef/validation       | Sessions à valider        |
| POST    | /api/chef/validate/:id     | Valider une session       |
| POST    | /api/chef/reject/:id       | Rejeter une session       |
| POST    | /api/chef/validate-all     | Validation groupée        |
| GET     | /api/chef/reports          | Rapports (export CSV)     |
| GET     | /api/chef/productivity-trend | Tendance de productivité |

### Directeur de Département
| Méthode | Route                    | Description               |
|---------|--------------------------|---------------------------|
| GET     | /api/dir-dept/dashboard  | Dashboard département     |

### Directeur Général
| Méthode | Route               | Description               |
|---------|---------------------|---------------------------|
| GET     | /api/dg/dashboard   | Dashboard global (comparaison 2 mois, cumul 6 mois) |

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
