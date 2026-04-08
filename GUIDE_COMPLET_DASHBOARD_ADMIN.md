# 📊 GUIDE COMPLET - Dashboard Administrateur TimeTrack BGFIBank

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble du Dashboard](#1-vue-densemble-du-dashboard)
2. [Les Cartes de Statistiques (KPI)](#2-les-cartes-de-statistiques-kpi)
3. [Graphique : Tendance Mensuelle](#3-graphique-tendance-mensuelle)
4. [Graphique : Productivité du Jour](#4-graphique-productivité-du-jour)
5. [Graphique : Méthode 3-3-3 (Camembert)](#5-graphique-méthode-3-3-3-camembert)
6. [Graphique : Comparaison par Département (Barres)](#6-graphique-comparaison-par-département-barres)
7. [Tableau : Comparaison par Département](#7-tableau-comparaison-par-département)
8. [Graphique : Comparaison par Agent (Barres)](#8-graphique-comparaison-par-agent-barres)
9. [Tableau : Productivité par Agent Aujourd'hui](#9-tableau-productivité-par-agent-aujourdhui)
10. [Tableau : Objectifs Banque (3-3-3)](#10-tableau-objectifs-banque-3-3-3)
11. [Sources de Données et Calculs SQL](#11-sources-de-données-et-calculs-sql)
12. [Glossaire des Termes](#12-glossaire-des-termes)

---

## 1. VUE D'ENSEMBLE DU DASHBOARD

### 🎯 Objectif
Le dashboard administrateur permet de **suivre en temps réel** la productivité de toute la banque, par département et par agent.

### 📐 Organisation
Le dashboard est organisé en **rangées verticales** :

```
┌─────────────────────────────────────────────────────┐
│  📊 RANGÉE 1 : 4 Cartes KPI                         │
│     (Sessions, Heures, Taux validation, Agents)     │
├─────────────────────────────────────────────────────┤
│  📈 RANGÉE 2 : Tendance + Productivité du jour      │
│     (Graphique ligne + Camembert)                   │
├─────────────────────────────────────────────────────┤
│  🥧 RANGÉE 3 : Méthode 3-3-3                        │
│     (Camembert Production/Admin/Contrôle)           │
├─────────────────────────────────────────────────────┤
│  📊 RANGÉE 4 : Comparaison par Département          │
│     (Graphique barres + Tableau détaillé)           │
├─────────────────────────────────────────────────────┤
│  👥 RANGÉE 5 : Comparaison par Agent                │
│     (Graphique barres horizontales)                 │
├─────────────────────────────────────────────────────┤
│  ⏱️  RANGÉE 6 : Productivité aujourd'hui            │
│     (Tableau agents avec progression)               │
├─────────────────────────────────────────────────────┤
│  🎯 RANGÉE 7 : Objectifs Banque 3-3-3               │
│     (Tableau cible vs réalisé)                      │
└─────────────────────────────────────────────────────┘
```

### 🔄 Rafraîchissement
- **Automatique** : Toutes les 60 secondes
- **Manuel** : Bouton "🔄 Rafraîchir" en haut à droite

---

## 2. LES CARTES DE STATISTIQUES (KPI)

### 🔢 Vue d'ensemble
4 cartes affichées en haut du dashboard, côte à côte.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  📊 Sessions │  ⏱️  Heures  │  ✅ Validées │  👥 Agents   │
│    du mois   │  du mois     │    (%)       │   actifs     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

---

### 📊 CARTE 1 : Sessions du mois

**Titre** : "Sessions du mois"  
**Icône** : 📋 (clipboard)  
**Couleur** : Bleu (#3b82f6)

**Définition** :  
Nombre total de **sessions de travail validées** ce mois-ci.

**Source de données** :
```sql
SELECT COUNT(*) 
FROM work_sessions 
WHERE status = 'Validé' 
  AND strftime('%Y-%m', start_time) = '2026-04'
```

**Calcul** :
- Compte TOUTES les sessions **validées** du mois en cours
- Exclut les sessions "En attente" ou "Rejeté"

**Exemple** :
```
Sessions du mois : 1,247
```

**Interprétation** :
- ✅ **Élevé** : Beaucoup d'activité, bonne discipline de pointage
- ❌ **Faible** : Peu d'activité, manque de pointage ou absences

---

### ⏱️ CARTE 2 : Heures du mois

**Titre** : "Heures du mois"  
**Icône** : ⏱️ (clock)  
**Couleur** : Vert (#10b981)

**Définition** :  
Nombre total d'**heures validées** ce mois-ci.

**Source de données** :
```sql
SELECT SUM(duration_minutes) 
FROM work_sessions 
WHERE status = 'Validé' 
  AND strftime('%Y-%m', start_time) = '2026-04'
```

**Calcul** :
```javascript
const total_minutes = 125430  // Exemple
const heures = Math.floor(total_minutes / 60)
const minutes = total_minutes % 60
// Affichage : "2,090h 30m"
```

**Format d'affichage** :
- **Heures** : séparateur de milliers (virgule)
- **Minutes** : 2 chiffres avec zéro initial si < 10

**Exemple** :
```
Heures du mois : 2,090h 30m
```

**Interprétation** :
- ✅ **Élevé** : Productivité globale bonne
- ❌ **Faible** : Sous-activité, absences, ou manque de pointage

---

### ✅ CARTE 3 : Taux de validation

**Titre** : "Validées"  
**Icône** : ✅ (check)  
**Couleur** : Jaune/Orange (#f59e0b)

**Définition** :  
Pourcentage de sessions **validées** par rapport au total de sessions.

**Source de données** :
```sql
-- Sessions validées
SELECT COUNT(*) as validated
FROM work_sessions 
WHERE status = 'Validé' 
  AND strftime('%Y-%m', start_time) = '2026-04'

-- Total sessions
SELECT COUNT(*) as total
FROM work_sessions 
WHERE strftime('%Y-%m', start_time) = '2026-04'
```

**Calcul** :
```javascript
const validated = 1247  // Sessions validées
const total = 1350      // Total sessions (validées + en attente + rejetées)
const percentage = Math.round((validated / total) * 100)
// Résultat : 92%
```

**Exemple** :
```
Validées : 92%
```

**Interprétation** :
- ✅ **> 90%** : Excellent, les chefs valident rapidement
- ⚠️ **80-90%** : Acceptable, mais des retards de validation
- ❌ **< 80%** : Problème, beaucoup de sessions en attente

---

### 👥 CARTE 4 : Agents actifs

**Titre** : "Agents actifs"  
**Icône** : 👥 (users)  
**Couleur** : Violet (#8b5cf6)

**Définition** :  
Nombre total d'**agents avec le statut "Actif"** dans la base.

**Source de données** :
```sql
SELECT COUNT(*) 
FROM users 
WHERE status = 'Actif' 
  AND role IN ('Agent', 'Chef de Service')
```

**Calcul** :
- Compte UNIQUEMENT les utilisateurs actifs
- Exclut les utilisateurs "Inactif" ou "Suspendu"
- Exclut les rôles admin (Administrateur, Directeur Général, etc.)

**Exemple** :
```
Agents actifs : 47
```

**Interprétation** :
- C'est un **indicateur fixe** (change rarement)
- Utile pour calculer les **ratios** (ex: heures/agent)

---

## 3. GRAPHIQUE : TENDANCE MENSUELLE

### 📈 Vue d'ensemble

**Type** : Graphique en **lignes** (Line Chart)  
**Titre** : "📈 Tendance Mensuelle"  
**Bibliothèque** : Chart.js  
**Canvas ID** : `chartTrend`

**Objectif** :  
Visualiser l'**évolution quotidienne** des heures travaillées sur les 30 derniers jours.

---

### 📊 Axes du graphique

**Axe X (horizontal)** : Dates (30 derniers jours)  
**Axe Y (vertical)** : Heures travaillées

**Exemple** :
```
Heures
  250h │                               ●
       │                          ●    
  200h │                     ●         
       │                ●              
  150h │           ●                   
       │      ●                        
  100h │ ●                             
       └─────────────────────────────────► Dates
         1    5    10   15   20   25   30
        Avril                        Avril
```

---

### 📐 Source de données

**Requête SQL** :
```sql
SELECT 
  DATE(start_time) as date,
  SUM(duration_minutes) as total_minutes
FROM work_sessions
WHERE status = 'Validé'
  AND start_time >= DATE('now', '-30 days')
GROUP BY DATE(start_time)
ORDER BY date
```

**Résultat** :
```javascript
[
  { date: '2026-04-01', total_minutes: 7230 },  // 120h 30m
  { date: '2026-04-02', total_minutes: 8100 },  // 135h 00m
  { date: '2026-04-03', total_minutes: 7890 },  // 131h 30m
  ...
]
```

---

### 🎨 Configuration du graphique

**Couleur de la ligne** : Bleu (#3b82f6)  
**Points** : Ronds, bleu foncé (#1e3a5f)  
**Remplissage** : Gradient bleu clair sous la courbe

**Code Chart.js** :
```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: dates,  // ['1 Avr', '2 Avr', '3 Avr', ...]
    datasets: [{
      label: 'Heures travaillées',
      data: hours,  // [120.5, 135.0, 131.5, ...]
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4  // Courbe lissée
    }]
  }
})
```

---

### 📊 Interprétation

**Tendance à la hausse** ⬆️ :
- ✅ Productivité en augmentation
- ✅ Meilleure discipline de pointage
- ✅ Moins d'absences

**Tendance à la baisse** ⬇️ :
- ❌ Baisse de productivité
- ❌ Augmentation des absences
- ❌ Problème de pointage

**Pic isolé** :
- Peut indiquer un jour de **forte activité** (fin de mois, campagne)

**Creux isolé** :
- Peut indiquer un **jour férié** ou **absence collective**

---

## 4. GRAPHIQUE : PRODUCTIVITÉ DU JOUR

### 🥧 Vue d'ensemble

**Type** : Graphique en **camembert** (Doughnut Chart)  
**Titre** : "🥧 Productivité du Jour (base 8h/agent)"  
**Bibliothèque** : Chart.js  
**Canvas ID** : `chartProductivity`

**Objectif** :  
Montrer la **répartition du temps aujourd'hui** entre heures validées, en attente, et non pointées.

---

### 📊 Les 3 segments

```
     ┌─────────────────┐
     │  🟢 Validées    │ 65%
     ├─────────────────┤
     │  🟡 En attente  │ 20%
     ├─────────────────┤
     │  🔴 Non pointées│ 15%
     └─────────────────┘
```

#### 🟢 Segment 1 : Heures VALIDÉES
**Couleur** : Vert (#10b981)

**Définition** : Heures déjà **validées** par les chefs aujourd'hui

**Calcul** :
```sql
SELECT SUM(duration_minutes) 
FROM work_sessions
WHERE status = 'Validé'
  AND DATE(start_time) = DATE('now')
```

---

#### 🟡 Segment 2 : Heures EN ATTENTE
**Couleur** : Orange (#f59e0b)

**Définition** : Heures **pointées mais pas encore validées** aujourd'hui

**Calcul** :
```sql
SELECT SUM(duration_minutes) 
FROM work_sessions
WHERE status = 'En attente'
  AND DATE(start_time) = DATE('now')
```

---

#### 🔴 Segment 3 : Heures NON POINTÉES
**Couleur** : Rouge clair (#ef4444)

**Définition** : Heures **théoriques restantes** (capacité - validées - en attente)

**Calcul** :
```javascript
// 1. Calculer la capacité totale aujourd'hui
const agents_actifs = 47
const heures_par_jour = 8
const capacité_totale = agents_actifs * heures_par_jour * 60  // En minutes
// = 47 × 8 × 60 = 22,560 minutes = 376h

// 2. Calculer les heures validées et en attente
const validées = 14700  // 245h (65%)
const en_attente = 4500  // 75h (20%)

// 3. Calculer les heures non pointées
const non_pointées = capacité_totale - validées - en_attente
// = 22,560 - 14,700 - 4,500 = 3,360 minutes = 56h (15%)
```

---

### 📐 Calcul des pourcentages

```javascript
const total = validées + en_attente + non_pointées
const pct_validées = Math.round((validées / total) * 100)      // 65%
const pct_en_attente = Math.round((en_attente / total) * 100)  // 20%
const pct_non_pointées = Math.round((non_pointées / total) * 100)  // 15%
```

---

### 📊 Interprétation

**Bon indicateur** (exemple) :
- ✅ **Validées** : 70-80%
- ⚠️ **En attente** : 10-20%
- ✅ **Non pointées** : 5-10%

**Mauvais indicateur** (exemple) :
- ❌ **Validées** : 40%
- ❌ **En attente** : 30%
- ❌ **Non pointées** : 30%

**Problèmes possibles** :
- **Trop de "En attente"** → Les chefs ne valident pas assez vite
- **Trop de "Non pointées"** → Les agents oublient de pointer

---

### ⚠️ Spécificité : Week-end

**Si aujourd'hui = Samedi ou Dimanche** :

Le graphique affiche :
```
🌙 Week-end - Pas de calcul de productivité
```

**Raison** : La capacité théorique est différente (seuls certains agents travaillent le samedi/dimanche).

---

## 5. GRAPHIQUE : MÉTHODE 3-3-3 (CAMEMBERT)

### 🥧 Vue d'ensemble

**Type** : Graphique en **camembert** (Pie Chart)  
**Titre** : "🥧 Méthode 3-3-3 — Répartition du temps"  
**Bibliothèque** : Chart.js  
**Canvas ID** : `chart333M1` (mois actuel) et `chart333M2` (mois précédent si comparaison)

**Objectif** :  
Visualiser la **répartition du temps** entre les 3 types d'activités (Production, Admin & Reporting, Contrôle).

---

### 📊 Les 3 segments

```
     ┌─────────────────────┐
     │  🔵 Production      │ 75%
     ├─────────────────────┤
     │  🟠 Admin & Reporting│ 15%
     ├─────────────────────┤
     │  🟢 Contrôle        │ 10%
     └─────────────────────┘
```

#### 🔵 Segment 1 : PRODUCTION
**Couleur** : Bleu foncé (#1e3a5f)

**Définition** : Temps passé sur des **tâches de production** (cœur de métier)

**Calcul** :
```sql
SELECT SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
  AND COALESCE(t.task_type, 'Production') = 'Production'
```

**Exemples de tâches Production** :
- Traitement de dossiers clients
- Octroi de crédits
- Gestion de comptes
- Vente de produits bancaires

---

#### 🟠 Segment 2 : ADMINISTRATION & REPORTING
**Couleur** : Orange (#f59e0b)

**Définition** : Temps passé sur des **tâches administratives**

**Calcul** :
```sql
SELECT SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
  AND t.task_type = 'Administration & Reporting'
```

**Exemples de tâches Admin & Reporting** :
- Rédaction de rapports
- Réunions administratives
- Saisie de données
- Traitement de courriers
- Classement de documents

---

#### 🟢 Segment 3 : CONTRÔLE
**Couleur** : Vert (#10b981)

**Définition** : Temps passé sur des **tâches de contrôle**

**Calcul** :
```sql
SELECT SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
  AND t.task_type = 'Contrôle'
```

**Exemples de tâches Contrôle** :
- Vérification de conformité
- Audit interne
- Contrôle qualité
- Validation de dossiers
- Revue de processus

---

### 📐 Calcul des pourcentages

```javascript
const production = 450000     // 7,500h = 75%
const admin = 90000          // 1,500h = 15%
const controle = 60000       // 1,000h = 10%

const total = production + admin + controle  // 600,000 minutes = 10,000h

const pct_production = Math.round((production / total) * 100)  // 75%
const pct_admin = Math.round((admin / total) * 100)           // 15%
const pct_controle = Math.round((controle / total) * 100)     // 10%
```

---

### 📊 Interprétation (Règle 3-3-3)

**Objectif théorique** (règle 3-3-3) :
- Production : **33%**
- Admin & Reporting : **33%**
- Contrôle : **33%**

**Objectif réaliste (banque)** :
- ✅ Production : **60-70%**
- ✅ Admin & Reporting : **15-25%**
- ✅ Contrôle : **10-15%**

**Bon indicateur** :
- ✅ **Production** : 70% → La majorité du temps est consacrée au cœur de métier
- ✅ **Admin** : 20% → Temps admin maîtrisé
- ✅ **Contrôle** : 10% → Conformité respectée

**Mauvais indicateur** :
- ❌ **Production** : 40% → Trop peu de temps sur le cœur de métier
- ❌ **Admin** : 45% → Trop de bureaucratie
- ❌ **Contrôle** : 15% → Temps de contrôle acceptable

---

### 🔄 Comparaison mois-1 vs mois-2

**Si un 2ème mois est sélectionné**, le dashboard affiche **2 camemberts côte à côte** :

```
┌──────────────────┐  ┌──────────────────┐
│  Avril 2026      │  │  Mars 2026       │
│  (ce mois)       │  │  (mois précédent)│
│                  │  │                  │
│  🔵 Production   │  │  🔵 Production   │
│     75%          │  │     68%          │
│  🟠 Admin 15%    │  │  🟠 Admin 22%    │
│  🟢 Contrôle 10% │  │  🟢 Contrôle 10% │
└──────────────────┘  └──────────────────┘
```

**Analyse** :
- Production : **75% vs 68%** → ✅ **Amélioration de +7%**
- Admin : **15% vs 22%** → ✅ **Réduction de -7%**
- Contrôle : **10% vs 10%** → Stable

---

## 6. GRAPHIQUE : COMPARAISON PAR DÉPARTEMENT (BARRES)

### 📊 Vue d'ensemble

**Type** : Graphique en **barres empilées** (Stacked Bar Chart)  
**Titre** : "📊 Comparaison par Département — Productif vs Non-productif"  
**Bibliothèque** : Chart.js  
**Canvas ID** : `chartDeptBar`

**Objectif** :  
Comparer les départements en visualisant le **temps productif** (vert) vs **temps non-productif** (rouge).

---

### 📊 Structure du graphique

**Axe X** : Départements (Direction Commerciale, Direction Conformité, etc.)  
**Axe Y** : Heures

**2 barres empilées par département** :
- 🟢 **Barre verte** (en bas) : Heures productives (Production + Admin + Contrôle)
- 🔴 **Barre rouge** (en haut) : Heures non-productives (Capacité - Heures productives)

**Exemple visuel** :
```
Heures
  600h │
       │         ┌───────┐
  500h │         │  🔴   │  Direction
       │         │ 441h  │  Commerciale
  400h │         │       │  
       │         ├───────┤
  300h │         │       │
       │         │  🟢   │
  200h │         │ 119h  │
       │         │       │
  100h │         └───────┘
       └───────────────────────► Départements
           Dir. Com.
```

---

### 📐 Source de données

**Requête SQL (par département)** :
```sql
SELECT 
  d.name as dept_name,
  COUNT(DISTINCT u.id) as agent_count,
  COALESCE(t.task_type, 'Production') as type_333,
  SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
LEFT JOIN departments d ON ws.department_id = d.id
LEFT JOIN users u ON ws.user_id = u.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
GROUP BY d.id, d.name, COALESCE(t.task_type, 'Production')
ORDER BY d.name
```

**Transformation des données** :
```javascript
// Résultat SQL (exemple pour Direction Commerciale)
[
  { dept_name: 'Direction Commerciale', type_333: 'Production', total_minutes: 5370 },
  { dept_name: 'Direction Commerciale', type_333: 'Administration & Reporting', total_minutes: 1110 },
  { dept_name: 'Direction Commerciale', type_333: 'Contrôle', total_minutes: 630 }
]

// Calcul des heures productives
const production = 5370 / 60          // 89.5h
const admin = 1110 / 60               // 18.5h
const controle = 630 / 60             // 10.5h
const total_productif = production + admin + controle  // 118.5h

// Calcul des heures non-productives
const capacité = 560h  // 3 agents × 22 jours × 8h (ou avec samedi)
const non_productif = capacité - total_productif  // 441.5h

// Données pour Chart.js
{
  labels: ['Direction Commerciale', 'Direction Conformité', ...],
  datasets: [
    {
      label: 'Heures productives',
      data: [118.5, 98.2, ...],
      backgroundColor: '#10b981'  // Vert
    },
    {
      label: 'Heures non-productives',
      data: [441.5, 301.8, ...],
      backgroundColor: '#ef444480'  // Rouge transparent
    }
  ]
}
```

---

### 📊 Interprétation

**Bon département** :
- 🟢 **Barre verte grande** (> 70% de la capacité)
- 🔴 **Barre rouge petite** (< 30% de la capacité)

**Mauvais département** :
- 🟢 **Barre verte petite** (< 50% de la capacité)
- 🔴 **Barre rouge grande** (> 50% de la capacité)

**Exemple d'analyse** :

| Département | Capacité | Productif | Non-productif | Taux |
|-------------|----------|-----------|---------------|------|
| Direction A | 560h | 400h | 160h | **71%** ✅ |
| Direction B | 440h | 200h | 240h | **45%** ❌ |

**Direction A** : Bon taux d'utilisation (71%)  
**Direction B** : Mauvais taux d'utilisation (45%) → Investiguer

---

### 🔄 Comparaison mois-1 vs mois-2

**Si un 2ème mois est sélectionné**, chaque département a **2 paires de barres** :

```
    Direction Commerciale
    ┌────┬────┐
    │🟢🔴│🟢🔴│
    └────┴────┘
    Avr  Mars
```

---

## 7. TABLEAU : COMPARAISON PAR DÉPARTEMENT

### 📊 Vue d'ensemble

**Type** : Tableau HTML  
**Titre** : (inclus dans le graphique ci-dessus)  
**Position** : Juste en dessous du graphique barres

**Objectif** :  
Afficher les **chiffres précis** pour chaque département avec les 7 colonnes.

---

### 📐 Les 7 colonnes

| # | Colonne | Largeur | Description |
|---|---------|---------|-------------|
| 1 | DÉPARTEMENT | Auto | Nom du département |
| 2 | AGENTS | 80px | Nombre d'agents actifs |
| 3 | PRODUCTION | 100px | Heures de production |
| 4 | ADMIN & REPORTING | 120px | Heures admin (avec % du total) |
| 5 | CONTRÔLE | 100px | Heures contrôle |
| 6 | NON PRODUCTIF | 120px | Heures non travaillées (avec % cap.) |
| 7 | CAPACITÉ | 100px | Capacité théorique |

---

### 🔢 Exemple de ligne

```
Direction Commerciale | 3 | 89h 30m | 18h 30m (23% du total) | 10h 30m | 441h 30m (79% cap.) | 560h 00m
```

**Explication détaillée** : Voir document `EXPLICATION_TABLEAU_DEPARTEMENTS.md`

---

### 📊 Calculs

#### Colonne 4 : "% du total"
```javascript
const admin_minutes = 1110
const controle_minutes = 630
const total_productif = 5370 + 1110 + 630  // 7110 minutes
const pct = Math.round((admin_minutes + controle_minutes) / total_productif * 100)
// = 24%
```

#### Colonne 6 : "% cap."
```javascript
const capacité_minutes = 33600
const temps_travaillé = 7110
const temps_non_productif = capacité_minutes - temps_travaillé  // 26490
const pct = Math.round(temps_non_productif / capacité_minutes * 100)
// = 79%
```

---

## 8. GRAPHIQUE : COMPARAISON PAR AGENT (BARRES)

### 📊 Vue d'ensemble

**Type** : Graphique en **barres horizontales empilées**  
**Titre** : "👥 Comparaison par Agent — Productif vs Non-productif"  
**Bibliothèque** : Chart.js  
**Canvas ID** : `chartAgentBar`

**Objectif** :  
Comparer les agents **individuellement** en visualisant leur temps productif vs non-productif.

---

### 📊 Structure du graphique

**Axe Y** : Noms des agents (Nom Prénom)  
**Axe X** : Heures

**2 barres empilées par agent** :
- 🟢 **Barre verte** (à gauche) : Heures productives
- 🔴 **Barre rouge** (à droite) : Heures non-productives

**Exemple visuel** :
```
Agent 1 │████████████████░░░░│ 120h / 176h (68%)
Agent 2 │████████████░░░░░░░░│  96h / 176h (55%)
Agent 3 │███████████████████░│ 152h / 176h (86%)
        └────────────────────────────────► Heures
        0   50  100  150  200
```

---

### 📐 Source de données

**Requête SQL (par agent)** :
```sql
SELECT 
  u.first_name || ' ' || u.last_name as agent_name,
  u.id as agent_id,
  d.name as dept_name,
  u.works_saturday,
  COALESCE(t.task_type, 'Production') as type_333,
  SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
LEFT JOIN users u ON ws.user_id = u.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
GROUP BY u.id, u.first_name, u.last_name, d.name, u.works_saturday, type_333
ORDER BY d.name, u.last_name
```

---

### 📐 Calcul de la capacité individuelle

**Agent qui NE travaille PAS le samedi** :
```javascript
const jours_ouvrés = 22  // Lundi-Vendredi
const capacité = jours_ouvrés * 8 * 60  // 10,560 minutes = 176h
```

**Agent qui travaille le samedi** :
```javascript
const jours_ouvrés = 26  // Lundi-Samedi
const capacité = jours_ouvrés * 8 * 60  // 12,480 minutes = 208h
```

---

### 📊 Interprétation

**Bon agent** :
- ✅ **Taux d'utilisation > 80%** (ex: 140h / 176h = 80%)
- Barre verte remplit presque toute la barre

**Mauvais agent** :
- ❌ **Taux d'utilisation < 60%** (ex: 100h / 176h = 57%)
- Beaucoup de rouge (temps non travaillé)

**Causes possibles d'un faible taux** :
- Absences (congés, maladie)
- Manque de pointage (oublis)
- Sous-charge de travail
- Sessions non validées

---

## 9. TABLEAU : PRODUCTIVITÉ PAR AGENT AUJOURD'HUI

### 📊 Vue d'ensemble

**Type** : Tableau HTML  
**Titre** : "⏱️ Productivité par Agent — Aujourd'hui (base 8h)"  
**Position** : Rangée 6

**Objectif** :  
Afficher la **progression en temps réel** de chaque agent aujourd'hui.

---

### 📐 Les 7 colonnes

| # | Colonne | Description |
|---|---------|-------------|
| 1 | AGENT | Nom et prénom |
| 2 | DÉPARTEMENT | Département d'affectation |
| 3 | ✅ VALIDÉES | Heures déjà validées aujourd'hui (vert) |
| 4 | ⏳ EN ATTENTE | Heures pointées mais non validées (orange) |
| 5 | ❌ NON POINTÉES | Heures restantes à pointer (rouge) |
| 6 | PROGRESSION | Barre de progression visuelle |
| 7 | STATUT | Badge coloré (À jour / En retard / Complet) |

---

### 🔢 Exemple de ligne

```
Jean DUPONT | Direction Commerciale | 5h 30m | 1h 15m | 1h 15m | [████████░░] 84% | ✅ À jour
```

---

### 📐 Calculs

#### Colonne 3 : VALIDÉES
```sql
SELECT SUM(duration_minutes)
FROM work_sessions
WHERE user_id = 12
  AND status = 'Validé'
  AND DATE(start_time) = DATE('now')
```

#### Colonne 4 : EN ATTENTE
```sql
SELECT SUM(duration_minutes)
FROM work_sessions
WHERE user_id = 12
  AND status = 'En attente'
  AND DATE(start_time) = DATE('now')
```

#### Colonne 5 : NON POINTÉES
```javascript
const capacité_jour = 8 * 60  // 480 minutes
const validées = 330          // 5h 30m
const en_attente = 75         // 1h 15m
const non_pointées = capacité_jour - validées - en_attente
// = 480 - 330 - 75 = 75 minutes = 1h 15m
```

#### Colonne 6 : PROGRESSION
```javascript
const pct = Math.round((validées + en_attente) / capacité_jour * 100)
// = (330 + 75) / 480 × 100 = 84%
```

#### Colonne 7 : STATUT

**Badge vert "✅ À jour"** : `pct >= 80%`  
**Badge orange "⏳ En cours"** : `50% <= pct < 80%`  
**Badge rouge "❌ En retard"** : `pct < 50%`  
**Badge bleu "🎯 Complet"** : `pct >= 100%`

---

### ⚠️ Spécificité : Week-end

**Si aujourd'hui = Week-end** :
```
🌙 Week-end - Aucun calcul de productivité
```

---

## 10. TABLEAU : OBJECTIFS BANQUE (3-3-3)

### 📊 Vue d'ensemble

**Type** : Tableau HTML  
**Titre** : "🎯 Objectifs Banque — Méthode 3-3-3 (Cible vs Réalisé)"  
**Position** : Rangée 7

**Objectif** :  
Comparer les **objectifs fixés** (cibles) avec les **résultats réels** (réalisés) pour la règle 3-3-3.

---

### 📐 Les 5 colonnes

| # | Colonne | Description |
|---|---------|-------------|
| 1 | CATÉGORIE | Type d'activité (Production / Admin / Contrôle) |
| 2 | OBJECTIF (%) | Pourcentage cible fixé par la banque |
| 3 | RÉALISÉ (%) | Pourcentage réel ce mois-ci |
| 4 | ÉCART | Différence (Réalisé - Objectif) |
| 5 | STATUT | ✅ Atteint / ⚠️ Proche / ❌ Non atteint |

---

### 🔢 Exemple

| CATÉGORIE | OBJECTIF | RÉALISÉ | ÉCART | STATUT |
|-----------|----------|---------|-------|--------|
| Production | 60% | 75% | **+15%** | ✅ Atteint |
| Admin & Reporting | 25% | 15% | **-10%** | ✅ Atteint |
| Contrôle | 15% | 10% | **-5%** | ⚠️ Proche |

---

### 📐 Source des objectifs

**Objectifs (configurables dans la table `strategic_objectives`)** :
```sql
SELECT 
  name,
  target_percentage
FROM strategic_objectives
WHERE category = '3-3-3'
  AND status = 'Actif'
```

**Exemple de données** :
```javascript
[
  { name: 'Production', target_percentage: 60 },
  { name: 'Administration & Reporting', target_percentage: 25 },
  { name: 'Contrôle', target_percentage: 15 }
]
```

---

### 📐 Calcul de l'écart

```javascript
const objectif = 60  // Production doit être à 60%
const réalisé = 75   // Production est à 75%
const écart = réalisé - objectif  // +15%

// Statut
if (écart >= 0) {
  statut = '✅ Atteint'
} else if (écart >= -5) {
  statut = '⚠️ Proche'
} else {
  statut = '❌ Non atteint'
}
```

---

### 📊 Interprétation

**Production** :
- ✅ Écart **positif** : Excellent, on dépasse l'objectif
- ❌ Écart **négatif** : Problème, pas assez de production

**Admin & Reporting** :
- ✅ Écart **négatif** : Excellent, moins de temps admin que prévu
- ❌ Écart **positif** : Problème, trop de temps admin

**Contrôle** :
- ✅ Écart **proche de 0** : Bon équilibre
- ❌ Écart **très négatif** : Risque de non-conformité

---

## 11. SOURCES DE DONNÉES ET CALCULS SQL

### 🗄️ Tables principales

#### 📋 Table `work_sessions`
**Rôle** : Stocke chaque **session de travail** pointée par un agent

**Colonnes principales** :
- `id` : Identifiant unique
- `user_id` : Agent qui a pointé
- `task_id` : Tâche effectuée
- `start_time` : Début de la session
- `end_time` : Fin de la session
- `duration_minutes` : Durée en minutes
- `status` : Validé / En attente / Rejeté
- `department_id` : Département concerné

**Exemple de ligne** :
```sql
id: 1247
user_id: 12
task_id: 45
start_time: '2026-04-08 09:00:00'
end_time: '2026-04-08 12:30:00'
duration_minutes: 210  -- 3h 30m
status: 'Validé'
department_id: 3
```

---

#### 📋 Table `tasks`
**Rôle** : Définit les **tâches** que les agents peuvent pointer

**Colonnes principales** :
- `id` : Identifiant unique
- `name` : Nom de la tâche
- `task_type` : Production / Administration & Reporting / Contrôle
- `department_id` : Département concerné
- `status` : Actif / Inactif

**Exemple de ligne** :
```sql
id: 45
name: 'Traitement dossier crédit'
task_type: 'Production'
department_id: 3
status: 'Actif'
```

---

#### 📋 Table `users`
**Rôle** : Stocke les **utilisateurs** (agents, chefs, admin)

**Colonnes principales** :
- `id` : Identifiant unique
- `first_name` : Prénom
- `last_name` : Nom
- `email` : Email
- `role` : Administrateur / Agent / Chef de Service / etc.
- `department_id` : Département d'affectation
- `works_saturday` : 1 si travaille le samedi, 0 sinon
- `status` : Actif / Inactif

**Exemple de ligne** :
```sql
id: 12
first_name: 'Jean'
last_name: 'DUPONT'
email: 'jean.dupont@bgfibank.com'
role: 'Agent'
department_id: 3
works_saturday: 0
status: 'Actif'
```

---

#### 📋 Table `departments`
**Rôle** : Définit les **départements**

**Colonnes principales** :
- `id` : Identifiant unique
- `name` : Nom du département
- `status` : Actif / Inactif

**Exemple de ligne** :
```sql
id: 3
name: 'Direction Commerciale'
status: 'Actif'
```

---

### 🔍 Requêtes SQL principales

#### Requête 1 : Heures totales du mois
```sql
SELECT 
  SUM(duration_minutes) as total_minutes
FROM work_sessions
WHERE status = 'Validé'
  AND strftime('%Y-%m', start_time) = '2026-04'
```

**Résultat** :
```
total_minutes: 125,430  -- 2,090h 30m
```

---

#### Requête 2 : Ratio 3-3-3 (global)
```sql
SELECT 
  COALESCE(t.task_type, 'Production') as type_333,
  SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
GROUP BY COALESCE(t.task_type, 'Production')
```

**Résultat** :
```javascript
[
  { type_333: 'Production', total_minutes: 450000 },           // 7,500h
  { type_333: 'Administration & Reporting', total_minutes: 90000 },  // 1,500h
  { type_333: 'Contrôle', total_minutes: 60000 }              // 1,000h
]
```

---

#### Requête 3 : Ratio 3-3-3 par département
```sql
SELECT 
  d.name as dept_name,
  d.id as dept_id,
  COUNT(DISTINCT u.id) as agent_count,
  COALESCE(t.task_type, 'Production') as type_333,
  SUM(ws.duration_minutes) as total_minutes
FROM work_sessions ws
LEFT JOIN tasks t ON ws.task_id = t.id
LEFT JOIN departments d ON ws.department_id = d.id
LEFT JOIN users u ON ws.user_id = u.id
WHERE ws.status = 'Validé'
  AND strftime('%Y-%m', ws.start_time) = '2026-04'
GROUP BY d.id, d.name, COALESCE(t.task_type, 'Production')
ORDER BY d.name
```

**Résultat** :
```javascript
[
  { dept_name: 'Direction Commerciale', agent_count: 3, type_333: 'Production', total_minutes: 5370 },
  { dept_name: 'Direction Commerciale', agent_count: 3, type_333: 'Administration & Reporting', total_minutes: 1110 },
  { dept_name: 'Direction Commerciale', agent_count: 3, type_333: 'Contrôle', total_minutes: 630 },
  ...
]
```

---

#### Requête 4 : Capacité par département
```sql
SELECT 
  d.id as dept_id,
  d.name as dept_name,
  COUNT(u.id) as agent_count,
  SUM(CASE WHEN u.works_saturday = 1 THEN 1 ELSE 0 END) as agents_with_saturday,
  SUM(CASE WHEN u.works_saturday = 0 THEN 1 ELSE 0 END) as agents_without_saturday
FROM departments d
LEFT JOIN users u ON u.department_id = d.id 
  AND u.status = 'Actif' 
  AND u.role IN ('Agent', 'Chef de Service')
WHERE d.status = 'Actif'
GROUP BY d.id, d.name
```

**Résultat** :
```javascript
[
  { 
    dept_name: 'Direction Commerciale', 
    agent_count: 3,
    agents_with_saturday: 1,
    agents_without_saturday: 2
  }
]
```

**Calcul de la capacité** :
```javascript
const jours_std = 22    // Lundi-Vendredi
const jours_sat = 26    // Lundi-Samedi
const capacité = (2 * jours_std * 480) + (1 * jours_sat * 480)
// = (2 × 22 × 480) + (1 × 26 × 480)
// = 21,120 + 12,480
// = 33,600 minutes = 560h
```

---

## 12. GLOSSAIRE DES TERMES

### 📚 Termes techniques

**Capacité théorique** :  
Nombre d'heures **théoriquement disponibles** pour travailler (agents × jours ouvrés × 8h).

**Heures productives** :  
Heures **effectivement travaillées** (validées) = Production + Admin + Contrôle.

**Heures non-productives** :  
Heures **NON travaillées** = Capacité - Heures productives.

**Taux d'utilisation** :  
Pourcentage de la capacité utilisée = (Heures productives / Capacité) × 100.

**Taux de validation** :  
Pourcentage de sessions validées = (Sessions validées / Total sessions) × 100.

**Règle 3-3-3** :  
Principe de répartition du temps en 3 catégories : Production, Admin & Reporting, Contrôle.

**Session de travail** :  
Période de temps pointée par un agent sur une tâche (avec début, fin, durée).

**Pointage** :  
Action d'enregistrer une session de travail (start/stop).

**Validation** :  
Action du chef de service pour **approuver** une session pointée.

**Week-end** :  
Samedi et dimanche (certains agents travaillent le samedi dans les banques).

---

### 📊 Termes métier bancaire

**Production** :  
Activités **cœur de métier** de la banque (octroi crédits, gestion comptes, vente produits).

**Administration & Reporting** :  
Tâches **administratives** (rapports, réunions, saisie, classement).

**Contrôle** :  
Activités de **vérification et conformité** (audit, contrôle qualité, validation).

**Conformité** :  
Respect des **règles et régulations** bancaires (lois, procédures internes).

**Objectif stratégique** :  
Cible fixée par la direction (ex: Production doit être à 60%).

---

## 📝 NOTES IMPORTANTES

### ⚠️ Limites et avertissements

1. **Données temps réel** : Le dashboard se rafraîchit toutes les 60 secondes, mais il peut y avoir un léger décalage.

2. **Week-ends** : Les calculs de productivité du jour ne fonctionnent pas les week-ends (capacité théorique différente).

3. **Jours fériés** : Non pris en compte automatiquement, peuvent fausser les calculs de capacité.

4. **Agents inactifs** : Exclus des calculs (seuls les agents "Actifs" sont comptés).

5. **Sessions en attente** : Ne comptent PAS dans les heures validées (seulement dans "En attente").

---

### 🔧 Maintenance

**Fréquence de mise à jour** :
- KPI : Temps réel (rafraîchissement auto 60s)
- Graphiques : Temps réel (rafraîchissement auto 60s)
- Tableaux : Temps réel (rafraîchissement auto 60s)

**Cache** :
- Navigateur : Vider le cache si problème d'affichage
- Version : Utilise un paramètre `?v=timestamp` pour forcer le rechargement

---

## ✅ CHECKLIST POUR EXPLIQUER LE DASHBOARD

### Présentation générale (5 min)
- [ ] Expliquer l'objectif : suivre la productivité en temps réel
- [ ] Montrer les 7 rangées principales
- [ ] Expliquer le rafraîchissement automatique

### Les KPI (3 min)
- [ ] Sessions du mois : nombre de pointages validés
- [ ] Heures du mois : temps total travaillé
- [ ] Taux de validation : % de sessions validées
- [ ] Agents actifs : nombre d'agents disponibles

### La règle 3-3-3 (5 min)
- [ ] Expliquer les 3 catégories (Production, Admin, Contrôle)
- [ ] Montrer le camembert
- [ ] Expliquer l'objectif : maximiser Production, minimiser Admin

### Les tableaux (10 min)
- [ ] Tableau Départements : 7 colonnes expliquées
- [ ] Expliquer "% du total" et "% cap."
- [ ] Montrer un bon vs mauvais département

### Les graphiques (5 min)
- [ ] Tendance mensuelle : évolution sur 30 jours
- [ ] Barres départements : visualiser productif vs non-productif
- [ ] Barres agents : identifier les agents en difficulté

### Actions à prendre (5 min)
- [ ] Comment identifier un problème
- [ ] Que faire si "% cap." > 50%
- [ ] Comment améliorer la productivité

---

**📄 FIN DU GUIDE - Version 1.0 - Avril 2026**

---

**Contact support** : admin@bgfibank.com  
**Documentation projet** : `/home/user/webapp/README.md`
