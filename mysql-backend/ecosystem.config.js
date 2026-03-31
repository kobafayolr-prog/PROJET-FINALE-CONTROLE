/**
 * PM2 Ecosystem Config - TimeTrack BGFIBank (MySQL)
 * Usage: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'timetrack',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_HOST:     'localhost',
        DB_PORT:     '3306',
        DB_USER:     'timetrack_user',
        DB_PASSWORD: 'TimeTrack@BGFIBank2024!',
        DB_NAME:     'timetrack_db',
        JWT_SECRET:  'timetrack-bgfibank-secret-2024-x9k2p7m'
      },
      error_file: 'logs/err.log',
      out_file:   'logs/out.log',
      merge_logs: true,
      max_memory_restart: '200M'
    }
  ]
}
