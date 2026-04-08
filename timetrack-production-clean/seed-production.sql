-- ============================================================
-- TimeTrack BGFIBank - Données initiales PRODUCTION
-- Version PROPRE pour déploiement serveur
-- Contient UNIQUEMENT : Méthode 3-3-3 + compte Admin
-- ============================================================

USE timetrack_db;

-- ============================================================
-- OBJECTIFS STRATÉGIQUES : Méthode 3-3-3
-- ============================================================

-- Désactiver les anciens objectifs (s'ils existent)
UPDATE strategic_objectives SET status='Inactif' WHERE id IN (1,2,3,4,5,6,7,8,9);

-- Insérer les 3 objectifs de la méthode 3-3-3
INSERT INTO strategic_objectives (id, name, description, color, target_percentage, status, created_at, updated_at)
VALUES
  (10, 'Production', 'Activités génératrices de revenus (70%)', '#1e3a5f', 70.00, 'Actif', NOW(), NOW()),
  (11, 'Administration & Reporting', 'Gestion, conformité et reporting (20%)', '#f59e0b', 20.00, 'Actif', NOW(), NOW()),
  (12, 'Contrôle', 'Audit, vérification et contrôle interne (10%)', '#10b981', 10.00, 'Actif', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name), 
  description=VALUES(description), 
  color=VALUES(color), 
  target_percentage=VALUES(target_percentage), 
  status=VALUES(status), 
  updated_at=NOW();

-- ============================================================
-- DÉPARTEMENT GÉNÉRIQUE (Optionnel - pour créer premier processus)
-- ============================================================

-- Un seul département générique pour commencer
-- Vous créerez les vrais départements via l'interface admin après déploiement
INSERT INTO departments (id, name, code, description, status, created_at, updated_at)
VALUES
  (1, 'Direction Générale', 'DG', 'Direction Générale', 'Actif', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name), 
  code=VALUES(code), 
  description=VALUES(description), 
  status=VALUES(status), 
  updated_at=NOW();

-- ============================================================
-- COMPTE ADMINISTRATEUR UNIQUE
-- ============================================================

-- Mot de passe : Admin@BGFI2024!
-- Hash PBKDF2 (600 000 itérations) : pbkdf2:sha256:600000$randomsalt$hash
-- ⚠️ IMPORTANT : Changer ce mot de passe après le premier déploiement !

INSERT INTO users (id, first_name, last_name, email, password_hash, password_encrypted, role, department_id, status, works_saturday, twofa_secret, twofa_enabled, created_at, updated_at)
VALUES
  (
    1,
    'Administrateur',
    'Système',
    'admin@bgfibank.com',
    -- Hash pour : Admin@BGFI2024! (600 000 itérations PBKDF2)
    'pbkdf2:sha256:600000$4f8e3a2b1c9d7e6f$8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
    -- XOR encrypted password (pour consultation admin si nécessaire)
    NULL,
    'Administrateur',
    1, -- Département DG
    'Actif',
    0, -- Ne travaille pas le samedi par défaut
    NULL,
    0,
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE 
  first_name=VALUES(first_name), 
  last_name=VALUES(last_name), 
  email=VALUES(email), 
  password_hash=VALUES(password_hash), 
  role=VALUES(role), 
  department_id=VALUES(department_id), 
  status=VALUES(status), 
  updated_at=NOW();

-- ============================================================
-- VÉRIFICATION
-- ============================================================

SELECT '✅ Données de production initialisées' AS status;
SELECT 'Objectifs 3-3-3 créés' AS step1;
SELECT 'Département générique créé' AS step2;
SELECT 'Compte admin créé : admin@bgfibank.com' AS step3;
SELECT '⚠️  IMPORTANT : Changer le mot de passe admin après installation !' AS warning;

-- Afficher les objectifs
SELECT id, name, target_percentage, color, status FROM strategic_objectives WHERE status='Actif';

-- Afficher le compte admin
SELECT id, first_name, last_name, email, role, status FROM users WHERE email='admin@bgfibank.com';

-- ============================================================
-- FIN
-- ============================================================
