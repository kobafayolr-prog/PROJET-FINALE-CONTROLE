# 📦 TimeTrack BGFIBank - PACKAGES DISPONIBLES

**Date de création** : 8 avril 2024  
**Versions** : 2 packages distincts (DÉMO + PRODUCTION)

---

## 🎯 RÉSUMÉ RAPIDE

Tu as maintenant **DEUX packages** :

1. ✅ **Package DÉMO** : Avec toutes les données pour ta présentation de demain
2. ✅ **Package PRODUCTION** : Base vierge avec uniquement le compte admin

---

## 📦 PACKAGE 1 : VERSION DÉMO (Pour ta présentation)

### 📍 Fichier
```
timetrack-bgfibank-mysql-package.tar.gz
Taille : 9.6 MB
```

### 🎯 Usage
**Pour ta présentation du 9 avril 2024**  
Contient toutes les données de démonstration pour montrer le système complet.

### 📊 Contenu des données

| Élément | Quantité | Détails |
|---------|----------|---------|
| **Comptes utilisateurs** | 8 comptes | Admin, DG, DD, Chefs, Agents |
| **Départements** | 8 départements | DC, DCONF, DF, DG, DI, DOT, DRH, DR |
| **Processus** | 14 processus | Analyse financière, Comptabilité, etc. |
| **Tâches** | 42 tâches | Tâches pré-créées pour démo |
| **Work sessions** | Données historiques | Pour montrer les dashboards |
| **Objectifs 3-3-3** | ✅ 3 objectifs | Production 70%, Admin 20%, Contrôle 10% |

### 👤 Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@bgfibank.com | Admin@BGFI2024! | Administrateur |
| dg@bgfibank.com | DG@BGFI2024! | Directeur Général |
| dd.finance@bgfibank.com | DD@BGFI2024! | Directeur Département |
| chef.finance@bgfibank.com | Chef@BGFI2024! | Chef de Département |
| agent@bgfibank.com | Agent@BGFI2024! | Agent |

### ✅ Utilisation

**Idéal pour** :
- ✅ Ta présentation du 9 avril
- ✅ Démonstrations
- ✅ Tests complets du système
- ✅ Formation des utilisateurs

**Installation** :
```bash
# Extraire le package
tar -xzf timetrack-bgfibank-mysql-package.tar.gz
cd mysql-backend

# Installer
./install-windows.bat  (ou install-linux.sh)

# Démarrer
./start-windows.bat
```

---

## 📦 PACKAGE 2 : VERSION PRODUCTION PROPRE (Pour le serveur)

### 📍 Fichiers

**Option A - TAR.GZ (Linux/Mac)** :
```
timetrack-bgfibank-PRODUCTION-clean.tar.gz
Taille : 9.6 MB
```

**Option B - ZIP (Windows - RECOMMANDÉ)** :
```
timetrack-bgfibank-PRODUCTION-clean.zip
Taille : 9.7 MB
```

### 🎯 Usage
**Pour le déploiement en PRODUCTION sur le serveur Windows**  
Base de données vierge, prête pour la vraie utilisation en banque.

### 📊 Contenu des données

| Élément | Quantité | Détails |
|---------|----------|---------|
| **Comptes utilisateurs** | **1 seul** | ⭐ Uniquement admin |
| **Départements** | **1 seul** | Direction Générale (générique) |
| **Processus** | **0** | À créer via interface admin |
| **Tâches** | **0** | À créer via interface admin |
| **Work sessions** | **0** | Base vierge |
| **Objectifs 3-3-3** | ✅ **3 objectifs** | Production 70%, Admin 20%, Contrôle 10% |

### 👤 Compte unique

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@bgfibank.com | Admin@BGFI2024! | Administrateur |

⚠️ **IMPORTANT** : Changer ce mot de passe IMMÉDIATEMENT après la première connexion !

### ✅ Utilisation

**Idéal pour** :
- ✅ Déploiement PRODUCTION sur serveur Windows
- ✅ Mise en production réelle
- ✅ Démarrer avec une base propre
- ✅ Créer vos propres départements, processus, utilisateurs

**Installation Windows** :
```powershell
# 1. Extraire le ZIP dans C:\TimeTrack\

# 2. Télécharger et installer :
#    - MySQL 8.0 : https://dev.mysql.com/downloads/mysql/
#    - Node.js LTS : https://nodejs.org/

# 3. Double-cliquer : install-windows.bat

# 4. Double-cliquer : start-windows.bat

# 5. Ouvrir : http://localhost:3000
#    Se connecter : admin@bgfibank.com / Admin@BGFI2024!
```

**Après première connexion** :

1. **Changer le mot de passe admin**
2. **Créer vos départements** (via interface admin)
3. **Créer vos processus** (via interface admin)
4. **Créer vos comptes utilisateurs** (via interface admin)

---

## 📋 DIFFÉRENCES DÉTAILLÉES

| Aspect | VERSION DÉMO | VERSION PRODUCTION |
|--------|--------------|-------------------|
| **Fichier** | `timetrack-bgfibank-mysql-package.tar.gz` | `timetrack-bgfibank-PRODUCTION-clean.zip` |
| **Taille** | 9.6 MB | 9.7 MB |
| **Comptes** | 8 utilisateurs | **1 admin** |
| **Départements** | 8 pré-créés | **1 générique** |
| **Processus** | 14 pré-créés | **0 (vide)** |
| **Tâches** | 42 pré-créées | **0 (vide)** |
| **Work sessions** | Données historiques | **0 (vide)** |
| **Objectifs 3-3-3** | ✅ Présents | ✅ **Présents** |
| **Documentation** | README-DEPLOYMENT.md | **README-PRODUCTION.md** |
| **Usage** | Démonstration | **Production** |

---

## 🎯 QUEL PACKAGE UTILISER ?

### 📅 POUR DEMAIN (9 avril - Présentation)

**Utilise** : `timetrack-bgfibank-mysql-package.tar.gz` (VERSION DÉMO)

**Pourquoi** :
- ✅ Données complètes pour montrer toutes les fonctionnalités
- ✅ Plusieurs comptes pour démontrer le workflow
- ✅ Processus et tâches pré-créés
- ✅ Dashboard avec données réelles

**Installation** :
```bash
# Sur ton PC de présentation
cd C:\TimeTrack
# Extraire le package DÉMO
# Double-clic install-windows.bat
# Double-clic start-windows.bat
```

---

### 🏢 POUR LE SERVEUR WINDOWS (Après la présentation)

**Utilise** : `timetrack-bgfibank-PRODUCTION-clean.zip` (VERSION PRODUCTION)

**Pourquoi** :
- ✅ Base vierge pour démarrer proprement
- ✅ Pas de données imaginaires
- ✅ Uniquement le compte admin
- ✅ Tu créeras les vrais comptes/départements/processus

**Installation** :
```powershell
# Sur le serveur Windows
cd C:\TimeTrack
# Extraire le package PRODUCTION
# Double-clic install-windows.bat
# Double-clic start-windows.bat
# Changer le mot de passe admin !
# Créer les vrais départements
# Créer les vrais processus
# Créer les vrais comptes utilisateurs
```

---

## 🔐 SÉCURITÉ - CHECKLIST PRODUCTION

### ⚠️ À FAIRE IMMÉDIATEMENT après installation PRODUCTION

- [ ] **Changer le mot de passe admin**
  ```
  Se connecter → Mon Profil → Changer mot de passe
  ```

- [ ] **Générer nouveau secret JWT**
  ```powershell
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  # Copier le résultat dans .env → JWT_SECRET=...
  ```

- [ ] **Configurer CORS pour votre domaine**
  ```env
  # Dans .env :
  ALLOWED_ORIGINS=https://timetrack.bgfibank.com
  ```

- [ ] **Redémarrer le serveur**
  ```powershell
  pm2 restart timetrack-mysql
  ```

- [ ] **Configurer HTTPS** (certificat SSL)

- [ ] **Configurer backup automatique**

---

## 📁 EMPLACEMENT DES PACKAGES

```
/home/user/webapp/

├── timetrack-bgfibank-mysql-package.tar.gz          (VERSION DÉMO)
├── timetrack-bgfibank-PRODUCTION-clean.tar.gz       (VERSION PRODUCTION)
└── timetrack-bgfibank-PRODUCTION-clean.zip          (VERSION PRODUCTION - Windows)
```

---

## 📚 DOCUMENTATION INCLUSE

### Dans les DEUX packages

- ✅ `README-DEPLOYMENT.md` : Guide de déploiement complet
- ✅ `DEPLOYMENT_CHECKLIST.md` : Checklist étape par étape
- ✅ `MAINTENANCE.md` : Guide de maintenance
- ✅ `schema.sql` : Schéma MySQL complet
- ✅ `migrations/mysql/001_add_process_type.sql` : Migration

### Spécifique au package PRODUCTION

- ✅ `README-PRODUCTION.md` : Guide spécifique PRODUCTION
- ✅ `seed-production.sql` : Données minimales (admin + 3-3-3)

### Spécifique au package DÉMO

- ✅ `seed-333.sql` : Données complètes de démonstration

---

## ✅ RÉSUMÉ POUR TOI

### DEMAIN (9 avril) - Présentation

1. **Utilise le package DÉMO** : `timetrack-bgfibank-mysql-package.tar.gz`
2. **Installe sur ton PC** de présentation
3. **Teste avec les 8 comptes** pré-créés
4. **Montre les dashboards** avec données

### APRÈS LA PRÉSENTATION - Production

1. **Utilise le package PRODUCTION** : `timetrack-bgfibank-PRODUCTION-clean.zip`
2. **Installe sur le serveur Windows**
3. **Connecte-toi avec admin** uniquement
4. **Change le mot de passe** admin immédiatement
5. **Crée les départements** via l'interface
6. **Crée les processus** via l'interface
7. **Crée les comptes** utilisateurs via l'interface

---

## 🎉 CONCLUSION

Tu as maintenant **DEUX packages PRÊTS** :

1. ✅ **DÉMO** : Pour ta présentation (avec toutes les données)
2. ✅ **PRODUCTION** : Pour le serveur (base propre, admin seul)

**Choisis le bon package selon l'usage** :
- Présentation → DÉMO
- Serveur réel → PRODUCTION

**Bonne présentation demain ! 🚀**
