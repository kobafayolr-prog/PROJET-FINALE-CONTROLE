-- ============================================================
-- TimeTrack BGFIBank — SEED DE PRODUCTION
-- À exécuter UNE SEULE FOIS après le premier déploiement
-- Commande : npx wrangler d1 execute timetrack-production --remote --file=./seed_production.sql
--
-- Ce fichier contient :
--   1. Les objectifs stratégiques (3-3-3)
--   2. Les départements
--   3. Les processus / services
--   4. Les tâches (Production / Administration & Reporting / Contrôle)
--   5. Le compte Administrateur initial
--
-- Ce fichier NE contient PAS :
--   - Les sessions de travail (données de test uniquement)
--   - Les autres utilisateurs (à créer via l'interface Admin)
-- ============================================================

-- ============================================================
-- 1. OBJECTIFS STRATÉGIQUES — Méthode 3-3-3
-- ============================================================
-- Désactiver les anciens objectifs s'ils existent
UPDATE strategic_objectives SET status = 'Inactif' WHERE id IN (1,2,3,4,5);

INSERT OR IGNORE INTO strategic_objectives (id, name, description, color, target_percentage, status)
VALUES
  (10, 'Production',
   'Activités directement productives : traitement des opérations, service client, production bancaire.',
   '#1e3a5f', 70, 'Actif'),
  (11, 'Administration & Reporting',
   'Activités administratives, reporting, réunions, formation et tâches de support.',
   '#f59e0b', 20, 'Actif'),
  (12, 'Contrôle',
   'Activités de contrôle, audit, conformité, supervision et vérification.',
   '#10b981', 10, 'Actif');

-- ============================================================
-- 2. DÉPARTEMENTS
-- ============================================================
INSERT OR IGNORE INTO departments (id, name, code, description, status)
VALUES
  (1, 'Direction Commerciale',                    'DC',   'Direction en charge du développement commercial',       'Actif'),
  (2, 'Direction Conformité',                     'DCONF','Direction en charge de la conformité réglementaire',    'Actif'),
  (3, 'Direction Financière',                     'DF',   'Direction en charge des finances',                      'Actif'),
  (4, 'Direction Générale',                       'DG',   'Direction Générale de la banque',                       'Actif'),
  (5, 'Direction Informatique',                   'DI',   'Direction des systèmes d''information',                 'Actif'),
  (6, 'Direction des Opérations et de la Trésorerie', 'DOT', 'Direction des opérations bancaires',               'Actif'),
  (7, 'Direction des Ressources Humaines',        'DRH',  'Direction des ressources humaines',                     'Actif'),
  (8, 'Direction des Risques',                    'DR',   'Direction en charge de la gestion des risques',         'Actif'),
  (9, 'CONTROLE PERMANENT',                       'CP',   'Direction du contrôle permanent',                       'Actif');

-- ============================================================
-- 3. PROCESSUS / SERVICES
-- (objective_id = anciens IDs conservés pour compatibilité FK)
-- ============================================================
INSERT OR IGNORE INTO processes (id, name, description, department_id, objective_id, status)
VALUES
  (1,  'Analyse financière',         'Analyse et interprétation financière',          3, 10, 'Actif'),
  (2,  'Comptabilité',               'Tenue de la comptabilité',                      3, 10, 'Actif'),
  (3,  'Conformité réglementaire',   'Suivi des obligations réglementaires',          2, 10, 'Actif'),
  (4,  'Contrôle interne',           'Contrôle des opérations internes',              6, 10, 'Actif'),
  (5,  'Développement système',      'Maintenance et développement SI',               5, 10, 'Actif'),
  (6,  'Formation',                  'Formation du personnel',                        7, 10, 'Actif'),
  (7,  'Gestion des crédits',        'Gestion du portefeuille crédit',                1, 10, 'Actif'),
  (8,  'Gestion des risques',        'Identification et gestion des risques',         8, 10, 'Actif'),
  (9,  'Lutte anti-blanchiment',     'Conformité anti-blanchiment',                   2, 10, 'Actif'),
  (10, 'Prospection commerciale',    'Prospection et acquisition clients',            1, 10, 'Actif'),
  (11, 'Recrutement',                'Recrutement du personnel',                      7, 10, 'Actif'),
  (12, 'Service clientèle',          'Accueil et service clients',                    1, 10, 'Actif'),
  (13, 'Support informatique',       'Support technique aux utilisateurs',            5, 10, 'Actif'),
  (14, 'Traitement des opérations',  'Traitement des opérations bancaires',           6, 10, 'Actif');

-- ============================================================
-- 4a. TÂCHES — Catégorie : Production (objective_id = 10)
-- ============================================================
INSERT OR IGNORE INTO tasks (id, name, description, department_id, process_id, objective_id, task_type, status)
VALUES
  -- Direction Commerciale
  (1,  'Accueil clientèle',          'Réception et orientation des clients',                    1, 12, 10, 'Production', 'Actif'),
  (2,  'Démarchage téléphonique',    'Appels de prospection de nouveaux clients',               1, 10, 10, 'Production', 'Actif'),
  (3,  'Montage dossier crédit',     'Préparation et analyse des dossiers de crédit',           1,  7, 10, 'Production', 'Actif'),
  (4,  'Rendez-vous clients',        'Visites et entretiens commerciaux',                       1, 10, 10, 'Production', 'Actif'),
  (5,  'Suivi des engagements',      'Monitoring du portefeuille crédit',                       1,  7, 10, 'Production', 'Actif'),
  (6,  'Traitement des réclamations','Gestion et résolution des plaintes',                      1, 12, 10, 'Production', 'Actif'),
  -- Direction Conformité
  (7,  'Contrôle KYC',              'Vérification de la conformité des clients',                2,  9, 10, 'Production', 'Actif'),
  (8,  'Déclarations COBAC',        'Préparation des déclarations réglementaires',              2,  3, 10, 'Production', 'Actif'),
  (9,  'Veille réglementaire',      'Suivi des évolutions réglementaires',                      2,  3, 10, 'Production', 'Actif'),
  -- Direction Financière
  (10, 'Analyse du bilan',          'Étude et interprétation du bilan',                         3,  1, 10, 'Production', 'Actif'),
  (11, 'Clôture mensuelle',         'Arrêtés et clôtures comptables mensuels',                  3,  2, 10, 'Production', 'Actif'),
  (12, 'Déclarations fiscales',     'Préparation des déclarations fiscales',                    3,  2, 10, 'Production', 'Actif'),
  (13, 'Gestion budgétaire',        'Suivi et contrôle budgétaire',                             3,  2, 10, 'Production', 'Actif'),
  -- Direction Informatique
  (14, 'Développement système',     'Développement et maintenance des applications',             5,  5, 10, 'Production', 'Actif'),
  (15, 'Support technique',         'Assistance technique aux utilisateurs',                    5, 13, 10, 'Production', 'Actif'),
  -- Direction des Opérations et de la Trésorerie
  (16, 'Traitement des virements',  'Traitement des ordres de virement',                        6, 14, 10, 'Production', 'Actif'),
  (17, 'Contrôle des opérations',   'Vérification des opérations traitées',                     6,  4, 10, 'Production', 'Actif'),
  -- Direction des Ressources Humaines
  (18, 'Formation du personnel',    'Organisation et animation des formations',                 7,  6, 10, 'Production', 'Actif'),
  (19, 'Recrutement',               'Processus de recrutement',                                 7, 11, 10, 'Production', 'Actif'),
  -- Direction des Risques
  (20, 'Analyse des risques crédit','Évaluation des risques de crédit',                         8,  8, 10, 'Production', 'Actif'),
  (21, 'Reporting risques',         'Préparation des rapports de risques',                      8,  8, 10, 'Production', 'Actif');

-- ============================================================
-- 4b. TÂCHES — Catégorie : Administration & Reporting (objective_id = 11)
-- ============================================================
INSERT OR IGNORE INTO tasks (id, name, description, department_id, process_id, objective_id, task_type, status)
VALUES
  (50, 'Rédaction de rapports',           'Rapports périodiques',                1, 10, 11, 'Administration & Reporting', 'Actif'),
  (51, 'Réunion d''équipe',               'Réunions internes',                   1, 10, 11, 'Administration & Reporting', 'Actif'),
  (52, 'Mise à jour tableaux de bord',    'Tableaux de bord mensuels',           2,  3, 11, 'Administration & Reporting', 'Actif'),
  (53, 'Compte-rendu de réunion',         'CR des réunions de direction',        3,  1, 11, 'Administration & Reporting', 'Actif'),
  (54, 'Reporting mensuel DG',            'Rapport mensuel direction',           4,  1, 11, 'Administration & Reporting', 'Actif');

-- ============================================================
-- 4c. TÂCHES — Catégorie : Contrôle (objective_id = 12)
-- ============================================================
INSERT OR IGNORE INTO tasks (id, name, description, department_id, process_id, objective_id, task_type, status)
VALUES
  (55, 'Contrôle des dossiers',      'Vérification dossiers clients',           1,  7, 12, 'Contrôle', 'Actif'),
  (56, 'Audit interne',              'Audit des processus',                     2,  4, 12, 'Contrôle', 'Actif'),
  (57, 'Vérification conformité',    'Contrôle conformité réglementaire',       2,  3, 12, 'Contrôle', 'Actif'),
  (58, 'Contrôle qualité',           'Qualité des livrables',                   3,  4, 12, 'Contrôle', 'Actif'),
  (59, 'Supervision opérations',     'Supervision quotidienne',                 1, 10, 12, 'Contrôle', 'Actif');

-- ============================================================
-- 5. COMPTE ADMINISTRATEUR INITIAL
-- Email    : admin@bgfibank.com
-- Mot de passe : (à définir après déploiement via l'interface)
-- IMPORTANT : Changer le mot de passe immédiatement après la première connexion
--
-- Hash SHA-256 du mot de passe temporaire "Admin@Bgfi2024!" :
-- 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
-- ============================================================
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role, department_id, status)
VALUES (
  1,
  'Administrateur',
  'Système',
  'admin@bgfibank.com',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'Administrateur',
  NULL,
  'Actif'
);

-- ============================================================
-- FIN DU SEED DE PRODUCTION
-- ============================================================
-- Après exécution :
-- 1. Connectez-vous avec admin@bgfibank.com / Admin@Bgfi2024!
-- 2. CHANGEZ IMMÉDIATEMENT LE MOT DE PASSE ADMINISTRATEUR
-- 3. Créez les autres utilisateurs via l'interface Administration
-- ============================================================
