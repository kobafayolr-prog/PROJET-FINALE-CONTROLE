-- ============================================================
-- TimeTrack BGFIBank - Données initiales (MySQL)
-- À exécuter APRÈS schema.sql
-- ============================================================

USE timetrack_db;

-- ============================================================
-- Objectifs Stratégiques
-- ============================================================
INSERT INTO strategic_objectives (id, name, description, color, target_percentage, status) VALUES
(1, 'Développement Commercial',          'Croissance et acquisition clients',           '#22c55e', 30, 'Actif'),
(2, 'Expérience Client',                 'Amélioration de la satisfaction client',      '#f59e0b', 25, 'Actif'),
(3, 'Maîtrise des Frais Généraux',       'Optimisation et contrôle des coûts',          '#22c55e', 20, 'Actif'),
(4, 'Maîtrise des Pertes Opérationnelles','Réduction des risques et pertes',            '#ef4444', 15, 'Actif'),
(5, 'PNB',                               'Produit Net Bancaire',                        '#1e3a5f', 10, 'Actif')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================
-- Départements
-- ============================================================
INSERT INTO departments (id, name, code, description, status) VALUES
(1, 'Direction Commerciale',                  'DC',   'Direction en charge du développement commercial',     'Actif'),
(2, 'Direction Conformité',                   'DCONF','Direction en charge de la conformité réglementaire',  'Actif'),
(3, 'Direction Financière',                   'DF',   'Direction en charge des finances',                    'Actif'),
(4, 'Direction Générale',                     'DG',   'Direction Générale de la banque',                     'Actif'),
(5, 'Direction Informatique',                 'DI',   'Direction des systèmes d\'information',               'Actif'),
(6, 'Direction des Opérations et de la Trésorerie','DOT','Direction des opérations bancaires',               'Actif'),
(7, 'Direction des Ressources Humaines',      'DRH',  'Direction des ressources humaines',                   'Actif'),
(8, 'Direction des Risques',                  'DR',   'Direction en charge de la gestion des risques',       'Actif')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================
-- Processus
-- ============================================================
INSERT INTO processes (id, name, description, department_id, objective_id, status) VALUES
(1,  'Analyse financière',        'Analyse et interprétation financière',         3, 5, 'Actif'),
(2,  'Comptabilité',              'Tenue de la comptabilité',                     3, 3, 'Actif'),
(3,  'Conformité réglementaire',  'Suivi des obligations réglementaires',         2, 4, 'Actif'),
(4,  'Contrôle interne',          'Contrôle des opérations internes',             6, 4, 'Actif'),
(5,  'Développement système',     'Maintenance et développement SI',              5, 3, 'Actif'),
(6,  'Formation',                 'Formation du personnel',                       7, 3, 'Actif'),
(7,  'Gestion des crédits',       'Gestion du portefeuille crédit',              1, 5, 'Actif'),
(8,  'Gestion des risques',       'Identification et gestion des risques',       8, 4, 'Actif'),
(9,  'Lutte anti-blanchiment',    'Conformité anti-blanchiment',                 2, 4, 'Actif'),
(10, 'Prospection commerciale',   'Prospection et acquisition clients',          1, 1, 'Actif'),
(11, 'Recrutement',               'Recrutement du personnel',                    7, 3, 'Actif'),
(12, 'Service clientèle',         'Accueil et service clients',                  1, 2, 'Actif'),
(13, 'Support informatique',      'Support technique aux utilisateurs',          5, 3, 'Actif'),
(14, 'Traitement des opérations', 'Traitement des opérations bancaires',         6, 5, 'Actif')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================
-- Tâches prédéfinies
-- ============================================================
INSERT INTO tasks (id, name, description, department_id, process_id, objective_id, task_type, status) VALUES
-- Direction Commerciale
(1,  'Accueil clientèle',         'Réception et orientation des clients',                    1, 12, 2, 'Productive', 'Actif'),
(2,  'Démarchage téléphonique',   'Appels de prospection de nouveaux clients',               1, 10, 1, 'Productive', 'Actif'),
(3,  'Montage dossier crédit',    'Préparation et analyse des dossiers de crédit',           1,  7, 5, 'Productive', 'Actif'),
(4,  'Rendez-vous clients',       'Visites et entretiens commerciaux',                       1, 10, 1, 'Productive', 'Actif'),
(5,  'Suivi des engagements',     'Monitoring du portefeuille crédit',                       1,  7, 5, 'Productive', 'Actif'),
(6,  'Traitement des réclamations','Gestion et résolution des plaintes',                     1, 12, 2, 'Productive', 'Actif'),
-- Direction Conformité
(7,  'Contrôle KYC',              'Vérification de la conformité des clients',               2,  9, 4, 'Productive', 'Actif'),
(8,  'Déclarations COBAC',        'Préparation des déclarations réglementaires',             2,  3, 4, 'Productive', 'Actif'),
(9,  'Veille réglementaire',      'Suivi des évolutions réglementaires',                     2,  3, 4, 'Productive', 'Actif'),
-- Direction Financière
(10, 'Analyse du bilan',          'Étude et interprétation du bilan',                        3,  1, 5, 'Productive', 'Actif'),
(11, 'Clôture mensuelle',         'Arrêtés et clôtures comptables mensuels',                3,  2, 3, 'Productive', 'Actif'),
(12, 'Déclarations fiscales',     'Préparation des déclarations fiscales',                   3,  2, 3, 'Productive', 'Actif'),
(13, 'Gestion budgétaire',        'Suivi et contrôle budgétaire',                           3,  2, 3, 'Productive', 'Actif'),
-- Direction Informatique
(14, 'Développement système',     'Développement et maintenance des applications',           5,  5, 3, 'Productive', 'Actif'),
(15, 'Support technique',         'Assistance technique aux utilisateurs',                   5, 13, 3, 'Productive', 'Actif'),
-- Direction des Opérations
(16, 'Traitement des virements',  'Traitement des ordres de virement',                       6, 14, 5, 'Productive', 'Actif'),
(17, 'Contrôle des opérations',   'Vérification des opérations traitées',                   6,  4, 4, 'Productive', 'Actif'),
-- Direction RH
(18, 'Formation du personnel',    'Organisation et animation des formations',               7,  6, 3, 'Productive', 'Actif'),
(19, 'Recrutement',               'Processus de recrutement',                               7, 11, 3, 'Productive', 'Actif'),
-- Direction des Risques
(20, 'Analyse des risques crédit','Évaluation des risques de crédit',                        8,  8, 4, 'Productive', 'Actif'),
(21, 'Reporting risques',         'Préparation des rapports de risques',                     8,  8, 4, 'Productive', 'Actif')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================================
-- Utilisateurs par défaut — TOUS LES RÔLES COUVERTS
-- Hash SHA-256 hex | Chiffrement XOR+base64 (clé: bgfibank2024)
--
-- Compte admin    : admin@bgfibank.com              → admin123
-- Comptes DG      : dg@bgfibank.com                 → Bgfi@2024
-- Dir. Dép.       : dir.commercial@bgfibank.com     → Bgfi@2024
--                   dir.conformite@bgfibank.com     → Bgfi@2024
-- Chef de Dép.    : chef.commercial@bgfibank.com    → Chef@2024
--                   maidou@bgfi.com                 → Chef@2024
-- Chef de Service : chef.service@bgfibank.com       → Bgfi@2024
-- Agents          : agent.commercial@bgfibank.com   → Agent@2024
--                   eliel@bgfi.com                  → Agent@2024
--                   agent2@bgfibank.com             → Bgfi@2024
--
-- Note : La migration automatique SHA-256 → PBKDF2 s'effectue
--        à la première connexion de chaque utilisateur.
-- ============================================================
INSERT INTO users (id, first_name, last_name, email, password_hash, password_encrypted, role, department_id, status, works_saturday) VALUES
-- Administrateur
(1,  'Fayolle',   'KOBA',      'admin@bgfibank.com',             '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'AwMLAAxQXFg=',     'Administrateur',          NULL, 'Actif', 0),
-- Directeur Général
(6,  'Jean-Paul', 'OBIANG',    'dg@bgfibank.com',                '150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50', 'IAAAACJTXlkG',    'Directeur Général',       NULL, 'Actif', 0),
-- Directeurs de Département
(7,  'Hervé',     'NDONG',     'dir.commercial@bgfibank.com',    '150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50', 'IAAAACJTXlkG',    'Directeur de Département', 1,   'Actif', 0),
(8,  'Claire',    'MVELE',     'dir.conformite@bgfibank.com',    '150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50', 'IAAAACJTXlkG',    'Directeur de Département', 2,   'Actif', 0),
-- Chefs de Département
(2,  'Marc',      'NZOGHE',    'chef.commercial@bgfibank.com',   '918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', 'IQ8DDyJTXlkG',   'Chef de Département',      1,   'Actif', 0),
(5,  'Ingara',    'MAIDOU',    'maidou@bgfi.com',                '918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', 'IQ8DDyJTXlkG',   'Chef de Département',      8,   'Actif', 0),
-- Chef de Service
(9,  'Patricia',  'ENGONE',    'chef.service@bgfibank.com',      '150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50', 'IAAAACJTXlkG',   'Chef de Service',          1,   'Actif', 0),
-- Agents
(3,  'Sandra',    'MBOUMBA',   'agent.commercial@bgfibank.com',  'd8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', 'IwADBxYhXFsABA==','Agent',                   1,   'Actif', 0),
(4,  'Eliel',     'KAPOU',     'eliel@bgfi.com',                 'd8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', 'IwADBxYhXFsABA==','Agent',                   8,   'Actif', 1),
(10, 'Brice',     'MOUSSAVOU', 'agent2@bgfibank.com',            '150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50', 'IAAAACJTXlkG',   'Agent',                    1,   'Actif', 0)
ON DUPLICATE KEY UPDATE
  email=VALUES(email),
  role=VALUES(role),
  department_id=VALUES(department_id),
  works_saturday=VALUES(works_saturday),
  password_hash=VALUES(password_hash),
  password_encrypted=VALUES(password_encrypted);
