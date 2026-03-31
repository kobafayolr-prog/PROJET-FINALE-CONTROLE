-- Migration 0002 - Sécurité : ajout colonne password_encrypted
ALTER TABLE users ADD COLUMN password_encrypted TEXT DEFAULT NULL;
