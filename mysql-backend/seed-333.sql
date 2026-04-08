-- ============================================================
-- TimeTrack BGFIBank - Données initiales (MySQL) - Méthode 3-3-3
-- À exécuter APRÈS schema.sql
-- Version finale avec process_type au lieu d'objective_id
-- ============================================================

USE timetrack_db;

-- ============================================================
-- Objectifs Stratégiques - Méthode 3-3-3
-- ============================================================
INSERT INTO strategic_objectives (id, name, description, color, target_percentage, status) VALUES
(10, 'Production',                'Activités directement productives : traitement des opérations, service client, production bancaire.', '#1e3a5f', 33, 'Actif'),
(11, 'Administration & Reporting', 'Activités administratives, reporting, réunions, formation et tâches de support.', '#f59e0b', 33, 'Actif'),
(12, 'Contrôle',                  'Activités de contrôle, audit, conformité, supervision et vérification.', '#10b981', 33, 'Actif')
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  description=VALUES(description),
  color=VALUES(color),
  target_percentage=VALUES(target_percentage),
  status=VALUES(status);

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
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  description=VALUES(description),
  status=VALUES(status);

-- ============================================================
-- Processus avec process_type (Production, Administration & Reporting, Contrôle)
-- ============================================================
INSERT INTO processes (id, name, description, department_id, process_type, status) VALUES
-- Production (activités métier)
(1,  'Accueil clientèle',           'Réception et service clients',                         1, 'Production', 'Actif'),
(2,  'Prospection commerciale',     'Prospection et acquisition de clients',                1, 'Production', 'Actif'),
(3,  'Gestion des crédits',         'Montage et suivi des dossiers de crédit',             1, 'Production', 'Actif'),
(4,  'Traitement des opérations',   'Traitement des opérations bancaires courantes',       6, 'Production', 'Actif'),
(5,  'Analyse financière',          'Analyse et reporting financier',                      3, 'Production', 'Actif'),
(6,  'Comptabilité',                'Tenue de la comptabilité générale',                   3, 'Production', 'Actif'),
(7,  'Gestion de trésorerie',       'Gestion quotidienne de la trésorerie',                6, 'Production', 'Actif'),
(8,  'Support informatique',        'Assistance technique aux utilisateurs',               5, 'Production', 'Actif'),
(9,  'Développement système',       'Développement et maintenance SI',                     5, 'Production', 'Actif'),

-- Administration & Reporting
(10, 'Reporting RH',                'Rapports et tableaux de bord RH',                     7, 'Administration & Reporting', 'Actif'),
(11, 'Formation',                   'Organisation et animation des formations',            7, 'Administration & Reporting', 'Actif'),
(12, 'Réunions de coordination',    'Réunions de suivi et coordination',                   4, 'Administration & Reporting', 'Actif'),
(13, 'Documentation',               'Création et mise à jour de la documentation',         4, 'Administration & Reporting', 'Actif'),
(14, 'Reporting financier',         'Rapports financiers et déclarations',                 3, 'Administration & Reporting', 'Actif'),

-- Contrôle
(15, 'Contrôle interne',            'Contrôle des procédures et opérations',               6, 'Contrôle', 'Actif'),
(16, 'Conformité réglementaire',    'Suivi de la conformité aux règlements',               2, 'Contrôle', 'Actif'),
(17, 'Lutte anti-blanchiment',      'Contrôle KYC et déclarations TRACFIN',                2, 'Contrôle', 'Actif'),
(18, 'Gestion des risques',         'Identification et mitigation des risques',            8, 'Contrôle', 'Actif'),
(19, 'Audit interne',               'Audits de conformité et de procédures',               8, 'Contrôle', 'Actif')
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  description=VALUES(description),
  department_id=VALUES(department_id),
  process_type=VALUES(process_type),
  status=VALUES(status);

-- ============================================================
-- Tâches prédéfinies avec task_type cohérent
-- ============================================================
INSERT INTO tasks (id, name, description, department_id, process_id, objective_id, task_type, status) VALUES
-- Direction Commerciale - Production
(1,  'Accueil clientèle',          'Réception et orientation des clients',                    1, 1, 10, 'Production', 'Actif'),
(2,  'Démarchage téléphonique',    'Appels de prospection de nouveaux clients',               1, 2, 10, 'Production', 'Actif'),
(3,  'Montage dossier crédit',     'Préparation et analyse des dossiers de crédit',           1, 3, 10, 'Production', 'Actif'),
(4,  'Suivi des engagements',      'Monitoring du portefeuille crédit',                       1, 3, 10, 'Production', 'Actif'),
(5,  'Traitement des réclamations','Gestion et résolution des plaintes',                      1, 1, 10, 'Production', 'Actif'),

-- Direction Conformité - Contrôle
(6,  'Contrôle KYC',               'Vérification de la conformité des clients',               2, 17, 12, 'Contrôle', 'Actif'),
(7,  'Déclarations TRACFIN',       'Déclarations d\'opérations suspectes',                    2, 17, 12, 'Contrôle', 'Actif'),
(8,  'Veille réglementaire',       'Suivi des évolutions réglementaires',                     2, 16, 12, 'Contrôle', 'Actif'),
(9,  'Audit conformité',           'Audits de conformité réglementaire',                      2, 16, 12, 'Contrôle', 'Actif'),

-- Direction Financière - Production + Admin
(10, 'Analyse du bilan',           'Étude et interprétation du bilan',                        3, 5, 10, 'Production', 'Actif'),
(11, 'Clôture mensuelle',          'Arrêtés et clôtures comptables mensuels',                 3, 6, 10, 'Production', 'Actif'),
(12, 'Déclarations fiscales',      'Préparation des déclarations fiscales',                   3, 14, 11, 'Administration & Reporting', 'Actif'),
(13, 'Gestion budgétaire',         'Suivi et contrôle budgétaire',                            3, 14, 11, 'Administration & Reporting', 'Actif'),

-- Direction Informatique - Production + Admin
(14, 'Développement système',      'Développement et maintenance des applications',           5, 9, 10, 'Production', 'Actif'),
(15, 'Support technique',          'Assistance technique aux utilisateurs',                   5, 8, 10, 'Production', 'Actif'),
(16, 'Documentation technique',    'Rédaction de la documentation technique',                 5, 13, 11, 'Administration & Reporting', 'Actif'),

-- Direction des Opérations - Production + Contrôle
(17, 'Traitement des virements',   'Traitement des ordres de virement',                       6, 4, 10, 'Production', 'Actif'),
(18, 'Contrôle des opérations',    'Vérification des opérations traitées',                    6, 15, 12, 'Contrôle', 'Actif'),
(19, 'Gestion de la trésorerie',   'Suivi quotidien de la trésorerie',                        6, 7, 10, 'Production', 'Actif'),

-- Direction RH - Administration
(20, 'Formation du personnel',     'Organisation et animation des formations',                7, 11, 11, 'Administration & Reporting', 'Actif'),
(21, 'Recrutement',                'Processus de recrutement',                                7, 10, 11, 'Administration & Reporting', 'Actif'),
(22, 'Gestion de la paie',         'Traitement de la paie mensuelle',                         7, 10, 11, 'Administration & Reporting', 'Actif'),

-- Direction des Risques - Contrôle
(23, 'Évaluation des risques',     'Identification et évaluation des risques',                8, 18, 12, 'Contrôle', 'Actif'),
(24, 'Audit interne',              'Réalisation d\'audits internes',                          8, 19, 12, 'Contrôle', 'Actif'),
(25, 'Reporting risques',          'Rapports de gestion des risques',                         8, 18, 11, 'Administration & Reporting', 'Actif')
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  description=VALUES(description),
  task_type=VALUES(task_type),
  status=VALUES(status);

-- ============================================================
-- Utilisateurs de test (mots de passe : admin123 pour tous)
-- ============================================================
-- Hash PBKDF2 pour "admin123" (600k itérations)
SET @admin_hash = 'pbkdf2:sha256:600000$8fc9d9e1afb94c23a9f2ed7b8c12e345$a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

INSERT INTO users (id, first_name, last_name, email, password_hash, role, department_id, status, works_saturday) VALUES
(1,  'Admin',    'Système',     'admin@bgfibank.com',       @admin_hash, 'Administrateur',              NULL, 'Actif', 0),
(2,  'Pierre',   'NGUEMA',      'pierre.nguema@bgfibank.com', @admin_hash, 'Directeur Général',         4, 'Actif', 0),
(3,  'Marie',    'OBIANG',      'marie.obiang@bgfibank.com',  @admin_hash, 'Directeur de Département',  1, 'Actif', 0),
(4,  'Jean',     'MBA',         'jean.mba@bgfibank.com',      @admin_hash, 'Chef de Département',       1, 'Actif', 1),
(5,  'Sophie',   'ELLA',        'sophie.ella@bgfibank.com',   @admin_hash, 'Chef de Service',           3, 'Actif', 0),
(6,  'Thomas',   'KOUMBA',      'thomas.koumba@bgfibank.com', @admin_hash, 'Agent',                     1, 'Actif', 1),
(7,  'Alice',    'NTOUTOUME',   'alice.ntoutoume@bgfibank.com', @admin_hash, 'Agent',                   2, 'Actif', 0),
(8,  'Paul',     'ONDO',        'paul.ondo@bgfibank.com',     @admin_hash, 'Agent',                     3, 'Actif', 0),
(9,  'Claire',   'MEZUI',       'claire.mezui@bgfibank.com',  @admin_hash, 'Agent',                     6, 'Actif', 0),
(10, 'Marc',     'ALLOGHO',     'marc.allogho@bgfibank.com',  @admin_hash, 'Agent',                     5, 'Actif', 1)
ON DUPLICATE KEY UPDATE 
  first_name=VALUES(first_name),
  last_name=VALUES(last_name),
  role=VALUES(role),
  department_id=VALUES(department_id),
  status=VALUES(status);

-- ============================================================
-- Fin du fichier seed-333.sql
-- ============================================================
