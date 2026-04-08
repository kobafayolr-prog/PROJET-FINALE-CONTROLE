/**
 * PM2 Ecosystem Config - TimeTrack BGFIBank (MySQL)
 * Usage: pm2 start ecosystem.config.js
 * 
 * IMPORTANT: Les secrets (DB_PASSWORD, JWT_SECRET) doivent être définis
 * dans un fichier .env à la racine du projet (non versionné).
 * Copiez .env.example vers .env et adaptez les valeurs.
 */
require('dotenv').config()

module.exports = {
  apps: [
    {
      name: 'timetrack',
      script: 'server.js',
      cwd: __dirname,
      // ⭐ MODE CLUSTER pour supporter 200+ utilisateurs simultanés
      instances: 4,        // 4 instances (utilise 4 cœurs CPU)
      exec_mode: 'cluster', // Mode cluster au lieu de fork
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        DB_HOST:     process.env.DB_HOST     || 'localhost',
        DB_PORT:     process.env.DB_PORT     || '3306',
        DB_USER:     process.env.DB_USER     || 'timetrack_user',
        DB_PASSWORD: process.env.DB_PASSWORD || '',  // DOIT être défini dans .env
        DB_NAME:     process.env.DB_NAME     || 'timetrack_db',
        JWT_SECRET:  process.env.JWT_SECRET  || '',  // DOIT être défini dans .env
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
      },
      error_file: 'logs/err.log',
      out_file:   'logs/out.log',
      merge_logs: true,
      // ⭐ Augmenter limite mémoire pour haute charge
      max_memory_restart: '500M'
    }
  ]
}
