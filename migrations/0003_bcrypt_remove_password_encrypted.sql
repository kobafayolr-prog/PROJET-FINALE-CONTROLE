-- Migration 0003 - Sécurité : passage bcrypt + suppression colonne password_encrypted
-- Les mots de passe sont maintenant hashés avec bcrypt (coût 12)
-- La colonne password_encrypted (XOR+Base64 réversible) est supprimée
-- SQLite >= 3.35.0 (Cloudflare D1 supporte DROP COLUMN)

ALTER TABLE users DROP COLUMN password_encrypted;
