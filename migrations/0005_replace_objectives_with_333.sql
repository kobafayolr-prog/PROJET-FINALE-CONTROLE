-- Migration 0005 : Remplacer les objectifs stratégiques par les 3 catégories 3-3-3
-- PRODUCTION (70%) | ADMINISTRATION & REPORTING (20%) | CONTRÔLE (10%)

-- 1. Désactiver les anciens objectifs stratégiques
UPDATE strategic_objectives SET status = 'Inactif' WHERE id IN (1, 2, 3, 4, 5);

-- 2. Insérer les 3 nouveaux objectifs 3-3-3 (s'ils n'existent pas déjà)
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

-- 3. Mettre à jour les tâches existantes selon leur task_type
UPDATE tasks SET objective_id = 10
WHERE task_type IN ('Productive', 'Production') OR task_type IS NULL;

UPDATE tasks SET objective_id = 11
WHERE task_type IN ('Non productive', 'Administration & Reporting');

UPDATE tasks SET objective_id = 12
WHERE task_type = 'Contrôle';

-- 4. Mettre à jour les sessions existantes selon le task_type de la tâche associée
UPDATE work_sessions SET objective_id = 10
WHERE task_id IN (SELECT id FROM tasks WHERE task_type IN ('Productive', 'Production') OR task_type IS NULL);

UPDATE work_sessions SET objective_id = 11
WHERE task_id IN (SELECT id FROM tasks WHERE task_type IN ('Non productive', 'Administration & Reporting'));

UPDATE work_sessions SET objective_id = 12
WHERE task_id IN (SELECT id FROM tasks WHERE task_type = 'Contrôle');

-- 5. Mettre à jour le task_type des tâches pour uniformiser les noms
UPDATE tasks SET task_type = 'Production' WHERE task_type IN ('Productive');
UPDATE tasks SET task_type = 'Administration & Reporting' WHERE task_type IN ('Non productive');
