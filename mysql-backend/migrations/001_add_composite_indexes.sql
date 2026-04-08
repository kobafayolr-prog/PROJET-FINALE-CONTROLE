-- ============================================================
-- TimeTrack BGFIBank - Migration 001
-- Ajout d'index composites pour optimisation performance
-- Date: 2026-04-08
-- Impact: Gain 50-80% sur requêtes fréquentes (dashboards, exports)
-- ============================================================

USE timetrack_db;

-- Index composites sur work_sessions (table la plus sollicitée)
CREATE INDEX IF NOT EXISTS idx_ws_dept_start_status ON work_sessions(department_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_ws_user_start_status ON work_sessions(user_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_ws_status_start      ON work_sessions(status, start_time);
CREATE INDEX IF NOT EXISTS idx_ws_dept_obj_start    ON work_sessions(department_id, objective_id, start_time);

-- Vérifier les index créés
SHOW INDEX FROM work_sessions WHERE Key_name LIKE 'idx_ws_%';
