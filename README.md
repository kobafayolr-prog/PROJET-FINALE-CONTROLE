# TimeTrack — BGFIBank
## Système de Suivi du Temps de Travail

---

## 📋 Description
Application web de suivi du temps de travail des agents BGFIBank.  
Gestion des sessions de travail par objectifs stratégiques, avec validation hiérarchique et notifications en temps réel.

---

## 🚀 Installation

### Prérequis
- **Node.js v18+** → https://nodejs.org/

### Étapes
```bash
# 1. Cloner le dépôt
git clone https://github.com/kobafayolr-prog/PROJET-FINALE-CONTROLE.git
cd PROJET-FINALE-CONTROLE

# 2. Installer les dépendances
npm install

# 3. Initialiser la base de données locale
npx wrangler d1 migrations apply timetrack-production --local
npx wrangler d1 execute timetrack-production --local --file=./seed.sql

# 4. Compiler le projet
npm run build

# 5. Démarrer via PM2
pm2 start ecosystem.config.cjs
```

L'application est accessible sur **http://localhost:3000**.

---

## 🔑 Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@bgfibank.com | `admin123` |
| Chef de Département | chef.commercial@bgfibank.com | `Chef@2024` |
| Agent | agent.commercial@bgfibank.com | `Agent@2024` |
| Chef Risques | maidou@bgfi.com | `Chef@2024` |
| Agent Risques | eliel@bgfi.com | `Agent@2024` |

> ⚠️ **Changer tous les mots de passe après la première connexion en production** via Admin → Utilisateurs → Générer un code reset.

---

## 🌐 Accès réseau

- **Sur le serveur** : http://localhost:3000
- **Sur le réseau local** : http://[IP-du-serveur]:3000

> Trouver l'IP Windows : `ipconfig` → « Adresse IPv4 »

---

## 👥 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| **Administrateur** | Gestion users/depts/objectifs/tâches, stats globales, rapports CSV, audit |
| **Chef de Département** | Vue équipe, validation sessions, rapports département |
| **Agent** | Pointage (chronomètre + manuel), historique sessions, stats personnelles |

---

## 🔔 Notifications temps réel

Le système notifie automatiquement par **polling HTTP** :

- **Agent** (toutes les 20 s) : reçoit un toast quand sa session est ✅ Validée ou ❌ Rejetée
- **Chef** (toutes les 30 s) : reçoit un toast « Nouvelle session à valider » quand un agent termine une session

---

## 🔒 Sécurité

| Fonctionnalité | Détail |
|----------------|--------|
| Hachage mots de passe | PBKDF2-SHA256 · 600 000 itérations · sel aléatoire 16 octets (NIST 2024) |
| Migration automatique | SHA-256 legacy → PBKDF2 à la prochaine connexion |
| Rate limiting | 3 tentatives / blocage 2 min par IP |
| JWT | HMAC-SHA256 · expiration 24 h |
| RBAC | 3 rôles stricts : Agent, Chef de Département, Administrateur |
| Audit log | Toutes les actions sensibles tracées avec IP et horodatage |
| Mots de passe | Minimum 8 caractères obligatoire |

---

## 🗄️ Base de données

SQLite via Cloudflare D1 (local) — stockée dans `.wrangler/state/v3/d1/`

### Réinitialiser la base
```bash
rm -rf .wrangler/state/v3/d1
npx wrangler d1 migrations apply timetrack-production --local
npx wrangler d1 execute timetrack-production --local --file=./seed.sql
```

### Migrations
| Fichier | Description |
|---------|-------------|
| `0001_initial_schema.sql` | 7 tables + index |
| `0002_add_security.sql` | Colonne `password_encrypted` (obsolète) |
| `0003_bcrypt_remove_password_encrypted.sql` | Suppression `password_encrypted` |

---

## 📁 Structure du projet

```
timetrack-bgfibank/
├── src/
│   └── index.tsx                  # Backend API (48 routes)
├── public/static/
│   ├── admin.js / admin.css       # Interface Administrateur
│   ├── agent.js / agent.css       # Interface Agent
│   ├── chef.js  / chef.css        # Interface Chef de Département
│   ├── login-bg-01…15.jpg         # Slideshow page de connexion (Ken Burns)
│   └── cahier_technique.html      # Documentation technique complète
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_security.sql
│   └── 0003_bcrypt_remove_password_encrypted.sql
├── seed.sql                       # Données initiales (5 users, 8 depts, 21 tâches)
├── ecosystem.config.cjs           # Configuration PM2
├── wrangler.jsonc                 # Configuration Cloudflare/Wrangler
└── package.json
```

---

## ⚙️ Tech Stack

| Composant | Technologie |
|-----------|-------------|
| Backend | Hono.js (TypeScript) — Cloudflare Workers runtime |
| Base de données | SQLite via Cloudflare D1 |
| Frontend | HTML/CSS/JS vanilla + TailwindCSS (CDN) + Chart.js |
| Authentification | JWT HMAC-SHA256 |
| Hachage | PBKDF2-SHA256 (Web Crypto API native) |
| Tests | Vitest — 89 tests unitaires |
| Process manager | PM2 |

---

## 📚 Documentation

Le cahier technique complet est disponible à :  
**http://localhost:3000/static/cahier_technique.html**

---

## 📞 Support

Pour toute modification ou problème, contacter le développeur.  
GitHub : https://github.com/kobafayolr-prog/PROJET-FINALE-CONTROLE
