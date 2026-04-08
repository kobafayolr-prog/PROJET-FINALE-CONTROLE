-- Migration 001 : Ajouter process_type à la table processes et migrer les données
-- Cette migration est idempotente (peut être exécutée plusieurs fois sans problème)

-- Note: Le schema.sql récent contient déjà process_type, donc cette migration
--       est uniquement pour les bases de données existantes créées avec l'ancien schema

-- 1. Vérifier si la colonne existe déjà, sinon l'ajouter
-- MySQL ne supporte pas "ADD COLUMN IF NOT EXISTS" en syntaxe native
-- On utilise une procédure stockée temporaire pour gérer cela

DELIMITER $$

CREATE PROCEDURE AddProcessTypeColumn()
BEGIN
  -- Vérifier si la colonne process_type existe
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'processes' 
    AND COLUMN_NAME = 'process_type'
  ) THEN
    -- Ajouter la colonne process_type
    ALTER TABLE processes 
      ADD COLUMN process_type VARCHAR(100) NOT NULL DEFAULT 'Production' 
      COMMENT 'Production, Administration & Reporting, ou Contrôle';
    
    -- Migrer les données existantes d'objective_id vers process_type
    UPDATE processes SET process_type = 'Production' 
      WHERE objective_id = 10 OR objective_id IS NULL;
    
    UPDATE processes SET process_type = 'Administration & Reporting' 
      WHERE objective_id = 11;
    
    UPDATE processes SET process_type = 'Contrôle' 
      WHERE objective_id = 12;
    
    SELECT 'Column process_type added and data migrated' AS result;
  ELSE
    SELECT 'Column process_type already exists, skipping migration' AS result;
  END IF;
END$$

DELIMITER ;

-- Exécuter la procédure
CALL AddProcessTypeColumn();

-- Supprimer la procédure après utilisation
DROP PROCEDURE IF EXISTS AddProcessTypeColumn;

-- 2. Créer un index sur process_type pour optimiser les requêtes
-- Vérifier si l'index existe avant de le créer
CREATE INDEX IF NOT EXISTS idx_processes_type ON processes(process_type);

SELECT 'Migration 001 completed successfully' AS status;
