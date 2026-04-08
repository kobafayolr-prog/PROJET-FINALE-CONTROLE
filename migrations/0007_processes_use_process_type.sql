-- Migration 0007 : Remplacer objective_id par process_type dans la table processes

-- 1. Ajouter la colonne process_type
ALTER TABLE processes ADD COLUMN process_type TEXT DEFAULT 'Production';

-- 2. Migrer les données existantes d'objective_id vers process_type
UPDATE processes SET process_type = 'Production' WHERE objective_id = 10 OR objective_id IS NULL;
UPDATE processes SET process_type = 'Administration & Reporting' WHERE objective_id = 11;
UPDATE processes SET process_type = 'Contrôle' WHERE objective_id = 12;

-- Note: On ne peut pas supprimer la colonne objective_id en SQLite facilement
-- On la garde pour compatibilité mais on utilise process_type maintenant
