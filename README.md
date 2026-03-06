# TimeTrack - BGFIBank
## Système de Suivi du Temps de Travail

---

## 📋 Description
Application web de suivi du temps de travail des agents BGFIBank.
Gestion des sessions de travail par objectifs stratégiques, avec validation hiérarchique.

---

## 🚀 Installation rapide

### Prérequis
- **Node.js v18+** → https://nodejs.org/
- **Git** (optionnel) → https://git-scm.com/

### Windows
```bash
# 1. Double-cliquez sur install.bat
# 2. Attendez la fin de l'installation
# 3. Double-cliquez sur start.bat pour démarrer
```

### Linux / Mac
```bash
chmod +x install.sh start.sh
./install.sh    # Installation (une seule fois)
./start.sh      # Démarrage
```

---

## 🔑 Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | admin@bgfibank.com | Admin@2024 |
| Chef de Département | chef.commercial@bgfibank.com | Chef@2024 |
| Agent | agent.commercial@bgfibank.com | Agent@2024 |

---

## 🌐 Accès réseau

Une fois démarré, l'application est accessible :
- **Sur le PC serveur** : http://localhost:3000
- **Sur le réseau local** : http://[IP-du-serveur]:3000

> Pour trouver l'IP du serveur Windows : ouvrir cmd → taper `ipconfig` → noter "Adresse IPv4"

---

## 👥 Rôles utilisateurs

### Administrateur
- Gestion des utilisateurs, départements, objectifs, processus, tâches
- Vue d'ensemble globale avec graphiques
- Rapports & Export CSV
- Journal d'audit

### Chef de Département
- Vue d'ensemble de son équipe
- Validation des sessions de travail
- Rapports du département

### Agent
- Pointage des activités (chronomètre + saisie manuelle)
- Consultation de ses sessions
- Statistiques personnelles

---

## 🔧 Modifier l'application

### Ajouter un utilisateur
→ Se connecter en Admin → Utilisateurs → "+ Nouvel utilisateur"

### Modifier les objectifs stratégiques
→ Admin → Objectifs Stratégiques → cliquer l'icône ✏️

### Modifier le code source
Les fichiers principaux à modifier :

| Fichier | Description |
|---------|-------------|
| `src/index.tsx` | Backend API (routes, logique) |
| `public/static/admin.js` | Interface Administrateur |
| `public/static/agent.js` | Interface Agent |
| `public/static/chef.js` | Interface Chef de Département |
| `public/static/admin.css` | Styles Admin |
| `migrations/0001_initial_schema.sql` | Structure base de données |
| `seed.sql` | Données initiales |

### Après modification du code
```bash
# Windows
npm run build
xcopy /E /I /Y public\static dist\static

# Linux/Mac
npm run build && cp -r public/static dist/static
```
Puis **redémarrer** le serveur (Ctrl+C puis relancer start.bat/start.sh)

---

## 🗄️ Base de données

La base de données SQLite est stockée localement dans :
```
.wrangler/state/v3/d1/
```

### Sauvegarder la base de données
```bash
# Copier le dossier .wrangler vers un emplacement sûr
```

### Réinitialiser la base de données
```bash
# Supprimer et recréer
rmdir /s .wrangler          # Windows
rm -rf .wrangler            # Linux/Mac

# Puis relancer install.bat / install.sh
```

---

## 📁 Structure du projet

```
timetrack-bgfibank/
├── src/
│   └── index.tsx          # Backend API complet
├── public/
│   └── static/
│       ├── admin.js       # Interface Admin
│       ├── admin.css      # Styles Admin
│       ├── agent.js       # Interface Agent
│       ├── agent.css      # Styles Agent
│       ├── chef.js        # Interface Chef
│       └── chef.css       # Styles Chef
├── migrations/
│   └── 0001_initial_schema.sql
├── dist/                  # Dossier de build (généré)
├── seed.sql               # Données initiales
├── install.bat            # Installation Windows
├── start.bat              # Démarrage Windows
├── install.sh             # Installation Linux/Mac
├── start.sh               # Démarrage Linux/Mac
├── wrangler.jsonc         # Configuration Cloudflare/Wrangler
└── package.json
```

---

## ⚙️ Tech Stack
- **Backend** : Hono.js (TypeScript) sur Cloudflare Workers runtime
- **Base de données** : SQLite via Cloudflare D1 (local)
- **Frontend** : HTML/CSS/JS vanilla + TailwindCSS + Chart.js
- **Authentification** : JWT HMAC-SHA256

---

## 📞 Support
Pour toute modification ou problème, contacter le développeur.
