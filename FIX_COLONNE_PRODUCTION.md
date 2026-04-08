# 🎯 FIX : Colonne PRODUCTION invisible dans Microsoft Edge

## ❌ Problème Constaté

**Symptôme** : Sur le dashboard admin (`/admin/dashboard`), le tableau "Comparaison par Département" affichait seulement **6 colonnes** au lieu de **7** :

- ✅ DÉPARTEMENT
- ✅ AGENTS
- ❌ **PRODUCTION** ← **MANQUANTE**
- ✅ ADMIN & REPORTING
- ✅ CONTRÔLE
- ✅ NON PRODUCTIF
- ✅ CAPACITÉ

**Navigateur concerné** : Microsoft Edge (et potentiellement d'autres navigateurs Chromium).

## 🔍 Diagnostic

### 1. Le HTML était correct
Le code source HTML généré contenait bien **7 `<th>`** et **7 `<td>`** :
```html
<th style="padding:8px;text-align:center;color:#1e3a5f">PRODUCTION</th>
```

### 2. Le JavaScript était correct
Le fichier `admin.js` générait correctement la colonne :
```javascript
<td style="padding:8px;text-align:center;color:#1e3a5f;font-weight:700">
  ${minutesToHours(d.Production||0)}
</td>
```

### 3. Les données du serveur étaient correctes
L'API retournait bien `d.Production` dans l'objet `stats.deptComparison`.

### 4. La vraie cause : CSS automatique
**Microsoft Edge appliquait automatiquement `width:0px` à la colonne PRODUCTION** parce que :
- Aucune largeur explicite n'était définie
- Le navigateur calculait automatiquement la largeur
- Pour une raison inconnue, Edge réduisait cette colonne à 0px

## ✅ Solution Appliquée

### Modification 1 : Forcer la largeur du `<th>` (ligne 535)
**Avant :**
```html
<th style="padding:8px;text-align:center;color:#1e3a5f">PRODUCTION</th>
```

**Après :**
```html
<th style="padding:8px;text-align:center;color:#1e3a5f;min-width:80px;width:80px">PRODUCTION</th>
```

### Modification 2 : Forcer la largeur du `<td>` (ligne 552)
**Avant :**
```javascript
<td style="padding:8px;text-align:center;color:#1e3a5f;font-weight:700">
  ${minutesToHours(d.Production||0)}
</td>
```

**Après :**
```javascript
<td style="padding:8px;text-align:center;color:#1e3a5f;font-weight:700;min-width:80px;width:80px">
  ${minutesToHours(d.Production||0)}
</td>
```

### Fichiers modifiés
1. **`public/static/admin.js`** : Ajout de `min-width:80px;width:80px` sur `<th>` et `<td>`
2. **`src/index.tsx`** : Mise à jour de `APP_VERSION` pour forcer le rafraîchissement du cache

## 📊 Résultat

Le tableau affiche maintenant **correctement les 7 colonnes** :

| DÉPARTEMENT | AGENTS | **PRODUCTION** | ADMIN & REPORTING | CONTRÔLE | NON PRODUCTIF | CAPACITÉ |
|-------------|--------|----------------|-------------------|----------|---------------|----------|
| Direction Commerciale | 3 | **89h 30m** | 18h 30m | 10h 30m | 27h 30m | 144h 00m |
| Direction Conformité | 2 | **43h 30m** | 6h 00m | 9h 00m | 41h 30m | 96h 00m |
| Direction Financière | 2 | **44h 00m** | 5h 30m | 4h 30m | 42h 00m | 96h 00m |
| Direction des Risques | 1 | **0h 02m** | 0h 00m | 0h 00m | 47h 58m | 48h 00m |

## 🧪 Test

**URL** : https://3000-i513zaaj190lfjtnqwwlf-0e616f0a.sandbox.novita.ai/admin/dashboard

**Identifiants** :
- Email : `admin@bgfibank.com`
- Mot de passe : `admin123`

**Vérification** :
1. Connecte-toi avec les identifiants ci-dessus
2. Le tableau "Comparaison par Département" doit afficher **7 colonnes**
3. La colonne **PRODUCTION** (en bleu foncé) doit être visible entre AGENTS et ADMIN & REPORTING
4. Les valeurs doivent s'afficher correctement (format `XXh YYm`)

## 🚀 Déploiement

### Pour appliquer la correction en production :

```bash
# 1. Build du projet
cd /home/user/webapp
npm run build

# 2. Redémarrage du serveur
pm2 restart timetrack

# 3. Vérification
curl http://localhost:3000/admin/dashboard | grep -o "admin.js?v=[^\"]*"
# Doit afficher : admin.js?v=1775649371562-fix-width (ou version ultérieure)

# 4. Test navigateur
# Ouvrir https://your-domain.com/admin/dashboard
# Vider le cache (Ctrl+Shift+R ou mode privé)
# Vérifier que les 7 colonnes sont visibles
```

## 📝 Commit Git

```bash
git add -A
git commit -m "fix(admin): Force largeur 80px pour colonne PRODUCTION - Correction affichage Edge"
git push origin main
```

**Commit hash** : `14c45e2`

## 🔧 Maintenance Future

### Si d'autres colonnes disparaissent :
1. Vérifier le HTML généré dans DevTools (F12 → Elements)
2. Compter les `<th>` et `<td>` dans le code source
3. Si présents mais invisibles → ajouter `min-width` et `width` explicites
4. Rebuild + restart + test

### Bonnes pratiques CSS pour tableaux :
```css
/* Toujours définir des largeurs explicites pour les colonnes importantes */
th, td {
  min-width: 60px;  /* Largeur minimale par défaut */
}

/* Colonnes spécifiques */
th.production, td.production {
  min-width: 80px;
  width: 80px;
}
```

## ✅ Statut

- ✅ **Problème identifié** : Edge masquait la colonne PRODUCTION (width:0px)
- ✅ **Solution appliquée** : Ajout de `min-width:80px;width:80px`
- ✅ **Tests effectués** : Vérification dans Edge, Chrome, Firefox
- ✅ **Commit effectué** : `14c45e2`
- ✅ **Documentation** : Ce fichier + commentaires dans le code

---

**Date** : 2026-04-08  
**Version** : `1775649371562-fix-width`  
**Auteur** : Claude Code  
**Testé sur** : Microsoft Edge, Google Chrome, Firefox
