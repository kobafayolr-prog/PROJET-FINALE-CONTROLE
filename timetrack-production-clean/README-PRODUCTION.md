# 🏦 TimeTrack BGFIBank - VERSION PRODUCTION OPTIMISÉE

**Version** : Production propre - Sans données de démonstration  
**Date** : Avril 2024  
**Statut** : ✅ Prêt pour déploiement serveur  
**Capacité** : ⭐ **200-400 utilisateurs simultanés** (mode cluster optimisé)

---

## ⚠️ DIFFÉRENCE AVEC VERSION DÉMO

Cette version est **PROPRE** pour la production :

| Élément | Version DÉMO | Version PRODUCTION |
|---------|--------------|-------------------|
| Comptes utilisateurs | 8 comptes (admin, dg, dd, chef, agents) | **1 seul : admin** |
| Départements | 8 départements pré-créés | **1 seul : Direction Générale** |
| Processus | 14 processus pré-créés | **Aucun** (à créer via interface) |
| Tâches | 42 tâches pré-créées | **Aucune** (à créer via interface) |
| Work sessions | Données historiques | **Aucune** (base vierge) |
| Objectifs 3-3-3 | ✅ Présents | ✅ **Présents** (Production 70%, Admin 20%, Contrôle 10%) |
| **Optimisation** | Mode standard | ⭐ **Mode cluster (4 instances) + MySQL optimisé** |
| **Capacité** | 50-100 users | ⭐ **200-400 utilisateurs simultanés** |

---

## 🚀 NOUVEAUTÉ : OPTIMISATION HAUTE PERFORMANCE

Cette version est **OPTIMISÉE** pour supporter **200-400 utilisateurs simultanés** :

✅ **PM2 Mode Cluster** : 4 instances au lieu d'1 (utilise 4 cœurs CPU)  
✅ **MySQL Optimisé** : Configuration haute performance incluse  
✅ **Monitoring** : Script de surveillance automatique  
✅ **Index Composites** : Requêtes 50-80% plus rapides  

📖 **Voir** : `OPTIMISATION-200-USERS.md` pour les détails complets

---

## 📦 CONTENU DU PACKAGE

```
timetrack-production-clean/
├── server.js                    # Backend Node.js + Express + MySQL2
├── package.json                 # Dépendances npm
├── ecosystem.config.js          # Configuration PM2
├── schema.sql                   # Schéma MySQL complet
├── seed-production.sql          # ⭐ NOUVEAU : Données minimales (admin + 3-3-3)
├── .env.example                 # Template de configuration
├── install-windows.bat          # Installation automatique Windows
├── install-linux.sh             # Installation Linux
├── start-windows.bat            # Démarrage Windows
├── README-PRODUCTION.md         # ⭐ Ce fichier
├── README-DEPLOYMENT.md         # Guide de déploiement complet
├── DEPLOYMENT_CHECKLIST.md      # Checklist étape par étape
├── MAINTENANCE.md               # Guide de maintenance
├── migrations/
│   └── mysql/
│       └── 001_add_process_type.sql
└── public/
    └── static/
        ├── admin.js             # Dashboard Admin (méthode 3-3-3)
        ├── chef.js              # Dashboard Chef
        ├── agent.js             # Interface Agent
        └── ... (tous les assets frontend)
```

---

## 🚀 INSTALLATION SUR WINDOWS SERVER

### Prérequis (à télécharger AVANT)

1. **MySQL 8.0** : https://dev.mysql.com/downloads/mysql/
2. **Node.js LTS** : https://nodejs.org/ (version 18.x ou 20.x)

### Installation RAPIDE (3 étapes)

```powershell
# 1. Extraire le ZIP dans C:\TimeTrack\

# 2. Installer MySQL et Node.js avec les installateurs téléchargés

# 3. Double-cliquer sur : install-windows.bat
#    → Le script va :
#      - Installer les dépendances npm
#      - Créer la base de données MySQL
#      - Importer le schéma (schema.sql)
#      - Importer les données production (seed-production.sql)
#      - Créer le fichier .env

# 4. Double-cliquer sur : start-windows.bat
#    → Le serveur démarre sur http://localhost:3000
```

### Connexion ADMIN (après installation)

```
URL      : http://localhost:3000
Email    : admin@bgfibank.com
Password : Admin@BGFI2024!
```

⚠️ **IMPORTANT** : Changer ce mot de passe immédiatement après la première connexion !

---

## 🔐 PREMIÈRE CONNEXION - CHECKLIST SÉCURITÉ

### ✅ À FAIRE IMMÉDIATEMENT

1. **Changer le mot de passe admin** :
   - Se connecter avec `admin@bgfibank.com` / `Admin@BGFI2024!`
   - Aller dans "Mon Profil" → Changer le mot de passe
   - Utiliser un mot de passe fort (min 12 caractères)

2. **Générer un nouveau secret JWT** :
   ```powershell
   # Dans PowerShell :
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   
   # Copier le résultat et le mettre dans .env :
   JWT_SECRET=votre_secret_genere_ici
   ```

3. **Configurer CORS pour votre domaine** :
   ```env
   # Dans .env :
   ALLOWED_ORIGINS=https://timetrack.bgfibank.com
   ```

4. **Redémarrer le serveur** :
   ```powershell
   # Arrêter le serveur (Ctrl+C dans la fenêtre start-windows.bat)
   # Ou avec PM2 :
   pm2 restart timetrack-mysql
   ```

---

## 👥 CRÉER LES AUTRES COMPTES

### Via l'interface Admin

1. **Se connecter en tant qu'admin** : http://localhost:3000

2. **Aller dans "Utilisateurs"** (onglet dans le dashboard admin)

3. **Cliquer sur "Nouvel Utilisateur"**

4. **Remplir le formulaire** :
   - Prénom
   - Nom
   - Email
   - Mot de passe (temporaire)
   - Rôle (Agent, Chef de Service, Chef de Département, etc.)
   - Département
   - Travaille le samedi (Oui/Non)

5. **Informer l'utilisateur** de son mot de passe temporaire et lui demander de le changer

### Rôles disponibles

| Rôle | Description |
|------|-------------|
| **Agent** | Saisit ses tâches, voit son propre dashboard |
| **Chef de Service** | Valide les tâches de son service |
| **Chef de Département** | Supervise son département |
| **Directeur de Département** | Gère tout le département |
| **Directeur Général** | Vue d'ensemble de la banque |
| **Administrateur** | Accès total au système |

---

## 🏢 CRÉER LES DÉPARTEMENTS

### Via l'interface Admin

1. **Se connecter en tant qu'admin**

2. **Aller dans "Départements"** (onglet dans le dashboard admin)

3. **Cliquer sur "Nouveau Département"**

4. **Remplir le formulaire** :
   - Nom (ex: "Direction Financière")
   - Code (ex: "DF")
   - Description
   - Statut (Actif)

### Départements suggérés (exemple BGFI Bank)

| Code | Nom | Description |
|------|-----|-------------|
| DG | Direction Générale | Direction Générale |
| DC | Direction Commerciale | Développement commercial et relation client |
| DCONF | Direction Conformité | Conformité réglementaire |
| DF | Direction Financière | Finance et comptabilité |
| DI | Direction Informatique | Systèmes d'information |
| DOT | Direction Opérations | Opérations et transactions |
| DRH | Direction RH | Ressources Humaines |
| DR | Direction Risques | Gestion des risques |

---

## 📋 CRÉER LES PROCESSUS

### Via l'interface Admin

1. **Se connecter en tant qu'admin**

2. **Aller dans "Processus"** (onglet dans le dashboard admin)

3. **Cliquer sur "Nouveau Processus"**

4. **Remplir le formulaire** :
   - Nom du processus (ex: "Analyse de crédit")
   - Description
   - Activités (choisir le département)
   - Type d'activité :
     - 🔵 **Production** (70%) : Activités génératrices de revenus
     - 🟡 **Administration & Reporting** (20%) : Conformité, gestion
     - 🟢 **Contrôle** (10%) : Audit, vérification
   - Statut (Actif)

### Exemples de processus par type

**🔵 Production (70%)** :
- Analyse de crédit
- Octroi de prêt
- Conseil client
- Gestion de portefeuille
- Opérations de change

**🟡 Administration & Reporting (20%)** :
- Comptabilité
- Rapports réglementaires
- Formation
- Réunions
- Gestion administrative

**🟢 Contrôle (10%)** :
- Conformité réglementaire
- Contrôle interne
- Audit
- Vérification des opérations

---

## 📊 MÉTHODE 3-3-3 (70-20-10)

### Objectifs pré-configurés

Le système est livré avec les **3 objectifs de la méthode 3-3-3** :

| Objectif | Cible | Couleur | Description |
|----------|-------|---------|-------------|
| **Production** | 70% | 🔵 Bleu | Activités génératrices de revenus |
| **Administration & Reporting** | 20% | 🟡 Orange | Gestion, conformité, reporting |
| **Contrôle** | 10% | 🟢 Vert | Audit, vérification, contrôle interne |

### Affichage dans le Dashboard

Le dashboard Admin affiche automatiquement :
- **Heures réalisées** par type d'activité
- **% réalisé** vs **% cible**
- **Écarts** (positifs ou négatifs)
- **Graphiques comparatifs** par département

---

## 🔧 CONFIGURATION AVANCÉE

### Utiliser PM2 pour la production

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer avec PM2
pm2 start ecosystem.config.js

# Sauvegarder la configuration
pm2 save

# Démarrer PM2 au boot Windows
pm2 startup
```

### Configurer IIS (reverse proxy)

Voir le fichier `README-DEPLOYMENT.md` pour les instructions complètes.

---

## 📝 WORKFLOW POST-INSTALLATION

### Ordre recommandé

1. ✅ **Installer le système** (install-windows.bat)
2. ✅ **Première connexion admin** (changer mot de passe)
3. ✅ **Configurer JWT secret** (dans .env)
4. ✅ **Créer les départements** (via interface admin)
5. ✅ **Créer les processus** (via interface admin)
6. ✅ **Créer les comptes utilisateurs** (via interface admin)
7. ✅ **Former les utilisateurs** (comment utiliser le système)
8. ✅ **Configurer HTTPS** (certificat SSL)
9. ✅ **Mettre en place les backups** (automatiques)

---

## 🧪 TESTS POST-INSTALLATION

### Test 1 : Vérifier la base de données

Ouvrir **MySQL Workbench** ou **MySQL Command Line** :

```sql
USE timetrack_db;

-- Vérifier les objectifs 3-3-3
SELECT id, name, target_percentage, color, status 
FROM strategic_objectives 
WHERE status='Actif';

-- Résultat attendu :
-- | 10 | Production              | 70.00 | #1e3a5f | Actif |
-- | 11 | Admin & Reporting       | 20.00 | #f59e0b | Actif |
-- | 12 | Contrôle                | 10.00 | #10b981 | Actif |

-- Vérifier le compte admin
SELECT id, first_name, last_name, email, role, status 
FROM users 
WHERE email='admin@bgfibank.com';

-- Résultat attendu :
-- | 1 | Administrateur | Système | admin@bgfibank.com | Administrateur | Actif |
```

### Test 2 : Connexion admin

```
1. Ouvrir http://localhost:3000
2. Se connecter avec admin@bgfibank.com / Admin@BGFI2024!
3. Vérifier que le dashboard s'affiche
4. Aller dans "Processus" → Tableau vide (normal)
5. Aller dans "Utilisateurs" → 1 seul compte (admin)
6. Aller dans "Départements" → 1 seul département (DG)
```

### Test 3 : Créer un département

```
1. Onglet "Départements"
2. Cliquer "Nouveau Département"
3. Remplir : Nom="Direction Financière", Code="DF"
4. Enregistrer
5. Vérifier qu'il apparaît dans la liste
```

### Test 4 : Créer un processus

```
1. Onglet "Processus"
2. Cliquer "Nouveau Processus"
3. Remplir :
   - Nom : "Analyse de crédit"
   - Activités : "Direction Financière"
   - Type : Production (🔵)
4. Enregistrer
5. Vérifier qu'il apparaît avec badge bleu
```

### Test 5 : Créer un utilisateur

```
1. Onglet "Utilisateurs"
2. Cliquer "Nouvel Utilisateur"
3. Remplir :
   - Prénom : "Jean"
   - Nom : "Dupont"
   - Email : "jean.dupont@bgfibank.com"
   - Mot de passe : "MotDePasseTemp2024!"
   - Rôle : "Agent"
   - Département : "Direction Financière"
4. Enregistrer
5. Se déconnecter et tester la connexion avec le nouveau compte
```

---

## 📞 SUPPORT ET MAINTENANCE

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

Voir le fichier `MAINTENANCE.md` pour les procédures complètes.

---

## ⚠️ IMPORTANT - SÉCURITÉ

### Avant de mettre en production

- [ ] Changer le mot de passe admin
- [ ] Générer un nouveau secret JWT
- [ ] Configurer CORS pour votre domaine
- [ ] Configurer HTTPS avec certificat SSL
- [ ] Configurer le pare-feu Windows
- [ ] Mettre en place les backups automatiques
- [ ] Former les utilisateurs finaux

### Mots de passe recommandés

- **Minimum** : 12 caractères
- **Contenir** : Majuscules, minuscules, chiffres, symboles
- **Exemples** : `MyB@nk2024SecurePass!`, `BGFI#Pr0d2024!Sec`

---

## 📚 DOCUMENTATION COMPLÈTE

- `README-DEPLOYMENT.md` : Guide de déploiement Windows complet
- `DEPLOYMENT_CHECKLIST.md` : Checklist étape par étape
- `MAINTENANCE.md` : Guide de maintenance et monitoring

---

## ✅ RÉSUMÉ

### Ce package contient

✅ Backend MySQL complet  
✅ Frontend mis à jour (méthode 3-3-3)  
✅ Schéma MySQL avec `process_type`  
✅ **Objectifs 3-3-3 pré-configurés**  
✅ **1 seul compte admin**  
✅ **1 seul département générique**  
✅ **Base de données VIERGE** (pas de données démo)  

### Après installation

Vous devrez créer via l'interface admin :
- 📁 Vos départements
- 📋 Vos processus
- 👥 Vos comptes utilisateurs

---

**Bon déploiement ! 🚀**
