-- Migration 0004 - Ajout des nouveaux rôles bancaires
-- Nouveaux rôles : Chef de Service, Directeur de Département, Directeur Général

-- Note: SQLite ne supporte pas ALTER TABLE ... MODIFY COLUMN pour les contraintes CHECK
-- Les rôles sont gérés au niveau applicatif (VALID_ROLES dans l'API)
-- Cette migration ajoute les comptes de démonstration pour les nouveaux rôles

-- Directeur Général (voit tout, lecture seule) - password: admin123
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role, department_id, status)
VALUES (100, 'Jean-Marc', 'DIRECTEUR', 'dg@bgfibank.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Directeur Général', NULL, 'Actif');

-- Note: Les Directeurs de Département et Chefs de Service seront créés
-- via l'interface admin avec leur département respectif
