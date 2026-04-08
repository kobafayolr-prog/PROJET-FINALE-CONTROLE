# 🎯 Solution Cache Busting — TimeTrack BGFIBank

## 🐛 Problème Initial

**Symptôme** : L'en-tête "PRODUCTION" n'apparaît pas dans le tableau des départements, même après modification du fichier `admin.js`.

**Cause** : Le navigateur met en cache les fichiers JavaScript et CSS, empêchant le chargement des nouvelles versions.

---

## ✅ Solution Implémentée

### **1. Paramètre de version automatique**

Ajout d'un paramètre `?v=1.0.2` aux fichiers JS et CSS pour forcer le rechargement.

**Fichier modifié** : `/home/user/webapp/src/index.tsx`

```typescript
// Version pour cache-busting - incrémenter après modification des fichiers JS/CSS
const APP_VERSION = '1.0.2'

function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
...
<link rel="stylesheet" href="/static/admin.css?v=${APP_VERSION}">
</head>
<body>
<div id="app"></div>
<script src="/static/admin.js?v=${APP_VERSION}"></script>
</body>
</html>`
}
```

### **2. Comment ça fonctionne ?**

1. **Avant** : Le navigateur charge `/static/admin.js` et le met en cache
2. **Après** : Le navigateur charge `/static/admin.js?v=1.0.2`
3. **Nouvelle version** : Quand `APP_VERSION` change, l'URL change → le navigateur télécharge le nouveau fichier

**Exemple** :
- Version 1.0.2 : `/static/admin.js?v=1.0.2`
- Version 1.0.3 : `/static/admin.js?v=1.0.3` ← **URL différente = pas de cache**

---

## 🔧 Comment Utiliser Cette Solution

### **Après modification de `admin.js`, `agent.js`, ou autres fichiers statiques** :

```bash
# 1. Incrémenter la version dans src/index.tsx
nano /home/user/webapp/src/index.tsx
# Changer : const APP_VERSION = '1.0.2'
# En :     const APP_VERSION = '1.0.3'

# 2. Rebuilder le projet
cd /home/user/webapp
npm run build

# 3. Redémarrer le serveur
pm2 restart timetrack

# 4. Vérifier que la nouvelle version est servie
curl http://localhost:3000/admin/dashboard | grep "admin.js"
# Doit afficher : admin.js?v=1.0.3
```

### **Résultat** :
- ✅ Tous les utilisateurs reçoivent automatiquement la nouvelle version
- ✅ Pas besoin de vider le cache manuellement (`Ctrl+Shift+R`)
- ✅ Aucun problème de cache futur

---

## 📊 Avantages

| Avant | Après |
|-------|-------|
| ❌ Cache navigateur bloque les mises à jour | ✅ Chaque version a une URL unique |
| ❌ Utilisateurs doivent vider le cache manuellement | ✅ Rechargement automatique |
| ❌ Confusion : "pourquoi je ne vois pas mes modifications ?" | ✅ Mises à jour instantanées |
| ❌ Risque d'afficher une ancienne version en production | ✅ Version actuelle garantie |

---

## 🧪 Test de la Solution

### **Test 1 : Vérifier que le paramètre de version est présent**

```bash
curl -s http://localhost:3000/admin/dashboard | grep -o "admin.js[^\"]*"
# Résultat attendu : admin.js?v=1.0.2
```

### **Test 2 : Vérifier que le contenu est correct**

```bash
curl -s http://localhost:3000/static/admin.js | grep -o "PRODUCTION" | head -1
# Résultat attendu : PRODUCTION
```

### **Test 3 : Test avec le navigateur**

1. **Ouvrir** : https://3000-i513zaaj190lfjtnqwwlf-0e616f0a.sandbox.novita.ai/admin/dashboard
2. **Ouvrir DevTools** : `F12`
3. **Aller dans Network** (Réseau)
4. **Filtrer** : `admin.js`
5. **Vérifier l'URL** : Doit être `admin.js?v=1.0.2`
6. **Rafraîchir** : `Ctrl+Shift+R` (pour forcer le rechargement)
7. **Vérifier** : L'en-tête "PRODUCTION" apparaît dans le tableau

---

## 🔄 Workflow de Mise à Jour

```
┌─────────────────────────────────────┐
│  Modification de admin.js           │
│  (Ajouter en-tête PRODUCTION)       │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Incrémenter APP_VERSION            │
│  1.0.2 → 1.0.3                      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  npm run build                      │
│  (Compile src/index.tsx)            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  pm2 restart timetrack              │
│  (Redémarre le serveur)             │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Utilisateurs reçoivent v1.0.3      │
│  (admin.js?v=1.0.3 chargé)          │
└─────────────────────────────────────┘
```

---

## 🚨 Important

### **Ne PAS oublier d'incrémenter la version**

Si vous modifiez `admin.js` sans incrémenter `APP_VERSION` :
- ❌ Les utilisateurs ne verront pas les modifications
- ❌ Le cache du navigateur servira l'ancienne version

**Toujours** :
1. Modifier le fichier JS/CSS
2. Incrémenter `APP_VERSION`
3. Rebuilder
4. Redémarrer

---

## 📝 Historique des Versions

| Version | Date | Changement |
|---------|------|------------|
| 1.0.0 | - | Version initiale (sans cache-busting) |
| 1.0.1 | - | Première tentative (MySQL backend) |
| 1.0.2 | 8 avril 2026 | Ajout cache-busting (Cloudflare D1) |

---

## 🆘 Dépannage

### **Problème : L'en-tête ne s'affiche toujours pas**

**Solution 1 : Vider le cache du navigateur manuellement**
```
Chrome/Edge : Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
Firefox : Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
Safari : Cmd+Option+R (Mac)
```

**Solution 2 : Vérifier que la nouvelle version est servie**
```bash
curl http://localhost:3000/admin/dashboard | grep "admin.js"
# Doit afficher la nouvelle version (ex: ?v=1.0.3)
```

**Solution 3 : Vérifier que le fichier admin.js contient PRODUCTION**
```bash
curl http://localhost:3000/static/admin.js | grep -o "PRODUCTION" | head -1
# Doit afficher : PRODUCTION
```

**Solution 4 : Mode navigation privée (test rapide)**
- Ouvrir une fenêtre de navigation privée
- Aller sur l'application
- Si ça marche → c'est le cache
- Vider le cache du navigateur normal

---

## ✅ Résumé

**Avant** : Cache navigateur → anciennes versions affichées  
**Après** : Paramètre de version → nouvelles versions garanties

**Action à faire** : Incrémenter `APP_VERSION` après chaque modification de fichier statique

**Commit** : `dccd949` - fix(cache): Ajouter paramètre de version pour forcer rechargement des fichiers JS/CSS

---

**Dernière mise à jour** : 8 avril 2026  
**Auteur** : TimeTrack BGFIBank Development Team
