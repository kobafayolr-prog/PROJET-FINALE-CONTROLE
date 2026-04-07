-- Migration 0006 : ajout du champ works_saturday sur les utilisateurs
-- Permet de configurer par agent s'il travaille le samedi ou non
-- 0 = ne travaille pas le samedi (défaut)
-- 1 = travaille le samedi

ALTER TABLE users ADD COLUMN works_saturday INTEGER NOT NULL DEFAULT 0;

-- Index pour filtrer rapidement les agents qui travaillent le samedi
CREATE INDEX IF NOT EXISTS idx_users_works_saturday ON users(works_saturday);
