# 📊 EXPLICATION COMPLÈTE - Tableau "Comparaison par Département"

## 🎯 OBJECTIF DU TABLEAU

Ce tableau permet de **mesurer la productivité** de chaque département en comparant :
- ✅ Le temps **effectivement travaillé** (pointé et validé)
- ❌ Le temps **non travaillé** (absences, temps non pointé)
- 📊 La **répartition** du temps entre les 3 types d'activités (règle 3-3-3)

---

## 📐 LES 7 COLONNES EXPLIQUÉES

### 1️⃣ DÉPARTEMENT
**Définition** : Le nom du département (Direction Commerciale, Direction Conformité, etc.)

**Source** : Table `departments` dans la base de données

**Exemple** : `Direction Commerciale`

---

### 2️⃣ AGENTS
**Définition** : Le nombre d'agents **actifs** dans ce département

**Calcul** :
```sql
COUNT(u.id) 
FROM users u 
WHERE u.department_id = dept.id 
  AND u.status = 'Actif' 
  AND u.role IN ('Agent', 'Chef de Service')
```

**Exemple** : `3` agents dans la Direction Commerciale

---

### 3️⃣ PRODUCTION ⭐
**Définition** : Le temps total passé sur des **tâches de Production**

**Qu'est-ce qu'une tâche de Production ?**
- Toute tâche où `task.task_type = 'Production'`
- OU si `task_type` est NULL → considéré comme Production par défaut

**Calcul** :
```sql
SUM(ws.duration_minutes) 
FROM work_sessions ws
JOIN tasks t ON ws.task_id = t.id
WHERE t.task_type = 'Production'
  AND ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
```

**Exemple** : `89h 30m` de temps passé sur la Production

**Pourquoi c'est important ?**
- La Production = le **cœur de métier** de la banque
- C'est le temps passé sur des activités **directement génératrices de valeur**
- Plus ce chiffre est élevé, mieux c'est !

---

### 4️⃣ ADMIN & REPORTING 📄
**Définition** : Le temps total passé sur des **tâches administratives**

**Qu'est-ce qu'une tâche Admin & Reporting ?**
- Tâches où `task.task_type = 'Administration & Reporting'`
- Exemples :
  - Rédaction de rapports
  - Réunions administratives
  - Saisie de données
  - Traitement de courriers
  - Classement de documents

**Calcul** :
```sql
SUM(ws.duration_minutes) 
FROM work_sessions ws
JOIN tasks t ON ws.task_id = t.id
WHERE t.task_type = 'Administration & Reporting'
  AND ws.status = 'Validé'
```

**Exemple** : `18h 30m`

**⚠️ LE SOUS-TEXTE : "23% du total"**

C'est le **pourcentage de temps productif** passé sur Admin & Reporting.

**Calcul** :
```javascript
const aMin = d['Administration & Reporting']  // 18h 30m = 1110 minutes
const cMin = d['Contrôle']                     // 10h 30m = 630 minutes
const total_productif = d.Production + aMin + cMin  // 89h30m + 18h30m + 10h30m = 118h 30m = 7110 minutes

const pourcentage = Math.round((aMin + cMin) / total_productif * 100)
// = Math.round((1110 + 630) / 7110 * 100)
// = Math.round(1740 / 7110 * 100)
// = Math.round(24.47...)
// = 24%
```

**Pourquoi ce pourcentage ?**
- Il mesure **combien de temps les agents passent sur des tâches administratives** par rapport au temps total travaillé
- Si ce pourcentage est **trop élevé** (>30%), ça veut dire que les agents passent trop de temps sur l'admin au lieu de la production
- L'objectif : **minimiser ce pourcentage** pour maximiser la production

**Interprétation** :
- ✅ **< 20%** : Excellent, peu de temps perdu sur l'admin
- ⚠️ **20-30%** : Acceptable, mais surveiller
- ❌ **> 30%** : Trop élevé, il faut optimiser les processus administratifs

---

### 5️⃣ CONTRÔLE 🔍
**Définition** : Le temps total passé sur des **tâches de Contrôle**

**Qu'est-ce qu'une tâche de Contrôle ?**
- Tâches où `task.task_type = 'Contrôle'`
- Exemples :
  - Vérification de conformité
  - Audit interne
  - Contrôle qualité
  - Validation de dossiers
  - Revue de processus

**Calcul** :
```sql
SUM(ws.duration_minutes) 
FROM work_sessions ws
JOIN tasks t ON ws.task_id = t.id
WHERE t.task_type = 'Contrôle'
  AND ws.status = 'Validé'
```

**Exemple** : `10h 30m`

**Pas de sous-texte** : Le Contrôle est déjà **inclus dans le calcul du pourcentage "du total"** de la colonne ADMIN & REPORTING.

**Pourquoi Contrôle est séparé ?**
- C'est une activité **obligatoire** (conformité bancaire)
- Contrairement à l'Admin & Reporting, le Contrôle a une **valeur ajoutée** (prévention des risques)
- On veut **mesurer séparément** ces deux types d'activités support

---

### 6️⃣ NON PRODUCTIF ❌
**Définition** : Le temps **NON TRAVAILLÉ** par rapport à la capacité théorique

**Qu'est-ce que le temps non productif ?**
- **Absences** : congés, maladie, formation externe
- **Temps non pointé** : oublis de pointage, temps entre les tâches
- **Temps non validé** : sessions en attente ou rejetées

**Calcul** :
```javascript
// 1. Calculer la CAPACITÉ THÉORIQUE du département
const agents_sans_samedi = 2  // Agents qui ne travaillent pas le samedi
const agents_avec_samedi = 1  // Agents qui travaillent le samedi
const jours_ouvrés_standard = 22  // Nombre de jours ouvrés ce mois (sans samedi)
const jours_ouvrés_avec_samedi = 26  // Nombre de jours ouvrés ce mois (avec samedi)

const capacité_minutes = (agents_sans_samedi * jours_ouvrés_standard * 480) +
                         (agents_avec_samedi * jours_ouvrés_avec_samedi * 480)
// = (2 × 22 × 480) + (1 × 26 × 480)
// = (21 120) + (12 480)
// = 33 600 minutes = 560h

// 2. Calculer le temps EFFECTIVEMENT TRAVAILLÉ
const temps_travaillé = Production + Admin&Reporting + Contrôle
// = 89h30m + 18h30m + 10h30m
// = 118h 30m = 7110 minutes

// 3. Calculer le temps NON PRODUCTIF
const temps_non_productif = capacité_minutes - temps_travaillé
// = 33 600 - 7 110
// = 26 490 minutes = 441h 30m
```

**⚠️ LE SOUS-TEXTE : "79% cap."**

C'est le **pourcentage de temps non travaillé** par rapport à la capacité.

**Calcul** :
```javascript
const pourcentage_non_productif = Math.round(temps_non_productif / capacité_minutes * 100)
// = Math.round(26 490 / 33 600 * 100)
// = Math.round(78.84...)
// = 79%
```

**Interprétation** :
- ❌ **79% de temps non travaillé** = **TRÈS MAUVAIS**
- Ça veut dire que **seulement 21% de la capacité est utilisée** !
- Causes possibles :
  - Beaucoup d'absences (congés, maladie)
  - Manque de pointage (oublis)
  - Sous-charge de travail
  - Problèmes de validation des sessions

**Objectif** : **< 20%** de temps non productif (= **> 80%** de capacité utilisée)

---

### 7️⃣ CAPACITÉ 📅
**Définition** : Le temps **théoriquement disponible** pour travailler ce mois-ci

**Calcul** :
```javascript
// Formule générale :
capacité = (agents_sans_samedi × jours_ouvrés_standard × 480) +
           (agents_avec_samedi × jours_ouvrés_avec_samedi × 480)

// Pourquoi 480 ?
// 1 jour de travail = 8 heures = 8 × 60 = 480 minutes
```

**Exemple pour Direction Commerciale (3 agents)** :
- Agent 1 : ne travaille PAS le samedi → 22 jours × 8h = 176h
- Agent 2 : ne travaille PAS le samedi → 22 jours × 8h = 176h
- Agent 3 : travaille le samedi → 26 jours × 8h = 208h
- **TOTAL** : 176h + 176h + 208h = **560h** = **33 600 minutes**

**Pourquoi c'est important ?**
- C'est la **base de calcul** pour le temps non productif
- Permet de comparer des départements de **tailles différentes**
- Prend en compte les agents qui travaillent le samedi

---

## 🧮 LA RÈGLE 3-3-3

**C'est quoi la règle 3-3-3 ?**

C'est un **principe de répartition du temps** utilisé dans les banques et grandes entreprises :

1. **1/3 Production** : Activités cœur de métier (génératrices de valeur)
2. **1/3 Administration & Reporting** : Tâches administratives obligatoires
3. **1/3 Contrôle** : Vérification, audit, conformité

**MAIS** dans la vraie vie, on vise plutôt :
- ✅ **60-70% Production** (le maximum possible)
- ⚠️ **15-20% Admin & Reporting** (le minimum nécessaire)
- ⚠️ **10-15% Contrôle** (conformité obligatoire)

---

## 📊 EXEMPLE CONCRET : Direction Commerciale

| Colonne | Valeur | Explication |
|---------|--------|-------------|
| **DÉPARTEMENT** | Direction Commerciale | Nom du département |
| **AGENTS** | 3 | 3 agents actifs dans ce département |
| **PRODUCTION** | 89h 30m | 5370 minutes passées sur des tâches de production |
| **ADMIN & REPORTING** | 18h 30m<br>*23% du total* | 1110 minutes sur l'admin<br>1110+630 = 1740 min = 24% des 7110 min travaillées |
| **CONTRÔLE** | 10h 30m | 630 minutes sur le contrôle |
| **NON PRODUCTIF** | 441h 30m<br>*79% cap.* | 26 490 minutes NON travaillées<br>79% de la capacité totale (33 600 min) |
| **CAPACITÉ** | 560h 00m | Capacité théorique : 33 600 minutes |

**Calculs détaillés** :
```
Temps travaillé total = Production + Admin + Contrôle
                      = 5370 + 1110 + 630
                      = 7110 minutes
                      = 118h 30m

Temps non productif = Capacité - Temps travaillé
                    = 33 600 - 7 110
                    = 26 490 minutes
                    = 441h 30m

Taux d'utilisation = Temps travaillé / Capacité
                   = 7 110 / 33 600
                   = 21.16%

Taux de non-productivité = 100% - 21.16%
                         = 78.84%
                         ≈ 79%
```

---

## ❓ POURQUOI IL Y A DES SOUS-TEXTES UNIQUEMENT SUR 2 COLONNES ?

### ✅ ADMIN & REPORTING : "23% du total"
**Signification** : Pourcentage du temps **productif** consacré aux tâches admin+contrôle

**Pourquoi c'est important ?**
- Mesure la **charge administrative**
- Permet d'identifier si on perd trop de temps sur l'admin
- **Objectif** : < 20%

### ✅ NON PRODUCTIF : "79% cap."
**Signification** : Pourcentage de la **capacité totale** qui n'est PAS utilisée

**Pourquoi c'est important ?**
- Mesure l'**efficacité globale** du département
- Alerte sur les problèmes d'absences ou de sous-charge
- **Objectif** : < 20%

### ❌ Pourquoi PAS de sous-texte sur les autres colonnes ?

| Colonne | Raison |
|---------|--------|
| DÉPARTEMENT | C'est juste un nom, rien à calculer |
| AGENTS | C'est juste un nombre, pas besoin de % |
| **PRODUCTION** | **C'est l'objectif principal, pas besoin de % (plus c'est élevé, mieux c'est)** |
| CONTRÔLE | Déjà inclus dans le calcul "% du total" d'Admin & Reporting |
| CAPACITÉ | C'est la base de calcul, pas besoin de % |

---

## 🎯 COMMENT INTERPRÉTER CE TABLEAU ?

### ✅ BON DÉPARTEMENT (Exemple idéal)
```
Direction X | 5 agents | 320h | 40h (11%) | 30h | 50h (12%) | 440h
```
- ✅ Production élevée : 320h / 440h = **73% de la capacité** utilisée pour la production
- ✅ Admin+Contrôle faible : 11% du temps productif → **peu de temps perdu**
- ✅ Non productif faible : 12% de la capacité → **88% de taux d'utilisation**

### ❌ MAUVAIS DÉPARTEMENT (Exemple réel)
```
Direction Commerciale | 3 agents | 89h30m | 18h30m (23%) | 10h30m | 441h30m (79%) | 560h
```
- ❌ Production faible : 89h30m / 560h = **16% de la capacité** utilisée
- ⚠️ Admin+Contrôle acceptable : 23% du temps productif
- ❌ Non productif TRÈS élevé : 79% de la capacité → **ALERTE ROUGE**

**Problèmes possibles** :
1. **Absences massives** (congés, maladie)
2. **Manque de pointage** (agents oublient de pointer)
3. **Sous-charge de travail** (pas assez de tâches assignées)
4. **Sessions non validées** (en attente de validation)

---

## 🔧 ACTIONS À PRENDRE SELON LES RÉSULTATS

### Si "% du total" est TROP ÉLEVÉ (> 30%)
**Problème** : Trop de temps sur l'admin et le contrôle

**Actions** :
1. Automatiser les tâches administratives répétitives
2. Simplifier les processus de reporting
3. Former les agents aux outils numériques
4. Déléguer certaines tâches admin à des assistants

### Si "% cap." est TROP ÉLEVÉ (> 20%)
**Problème** : Trop de temps non travaillé

**Actions** :
1. **Vérifier les absences** : congés, maladie, formation
2. **Rappeler le pointage** : former les agents, envoyer des rappels
3. **Analyser la charge de travail** : les agents ont-ils assez de tâches ?
4. **Accélérer les validations** : les chefs valident-ils assez vite ?

---

## 📋 CHECKLIST POUR PRÉSENTER CE TABLEAU

Quand tu présentes ce tableau à ton équipe ou ta direction :

### 1️⃣ Contexte
> "Ce tableau mesure la **productivité réelle** de chaque département en comparant le temps effectivement travaillé à la capacité théorique."

### 2️⃣ Les 3 types d'activités
> "Nous suivons la règle 3-3-3 :
> - **Production** : le cœur de métier
> - **Admin & Reporting** : les tâches administratives
> - **Contrôle** : la vérification et la conformité"

### 3️⃣ Les 2 indicateurs clés
> "Nous surveillons 2 indicateurs :
> - **'% du total'** : mesure la charge administrative (objectif < 20%)
> - **'% cap.'** : mesure le temps non travaillé (objectif < 20%)"

### 4️⃣ Interprétation
> "Un bon département a :
> - ✅ Production élevée (> 60% de la capacité)
> - ✅ Admin faible (< 20% du temps productif)
> - ✅ Taux d'utilisation élevé (> 80%)"

### 5️⃣ Exemple
> "Par exemple, la Direction Commerciale :
> - A une capacité de 560h ce mois
> - Mais seulement 118h30m travaillées
> - Soit un taux d'utilisation de 21%
> - **Nous devons investiguer** : absences ? manque de pointage ? sous-charge ?"

---

## 💡 RÉSUMÉ EN 3 POINTS

1. **PRODUCTION** = Temps passé sur le cœur de métier (plus c'est élevé, mieux c'est)

2. **ADMIN & REPORTING** = Temps passé sur l'administratif (avec "% du total" pour mesurer la charge administrative)

3. **NON PRODUCTIF** = Temps NON travaillé par rapport à la capacité (avec "% cap." pour mesurer l'efficacité globale)

**L'objectif** : **Maximiser PRODUCTION**, **Minimiser ADMIN & NON PRODUCTIF** ! 🎯
