/**
 * TimeTrack BGFIBank - Script de monitoring système
 * Surveille MySQL, connexions, performance
 * Usage: pm2 start scripts/monitor.js --name timetrack-monitor
 */

const mysql = require('mysql2/promise')

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'timetrack_user',
  password: process.env.DB_PASSWORD || 'TimeTrack@BGFIBank2024!',
  database: process.env.DB_NAME || 'timetrack_db'
}

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const ALERT_THRESHOLD = {
  connections: 450,      // Alerte si > 450 connexions
  slowQueries: 100,      // Alerte si > 100 requêtes lentes
  diskUsage: 90          // Alerte si > 90% disque
}

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
}

function log(level, message) {
  const timestamp = new Date().toISOString()
  const color = {
    'INFO': colors.green,
    'WARN': colors.yellow,
    'ERROR': colors.red,
    'DEBUG': colors.blue
  }[level] || colors.reset

  console.log(`${color}[${timestamp}] [${level}] ${message}${colors.reset}`)
}

async function checkMySQLHealth() {
  let db
  try {
    // Connexion MySQL
    db = await mysql.createConnection(DB_CONFIG)
    log('INFO', '✅ Connexion MySQL OK')

    // Vérifier nombre de connexions
    const [conns] = await db.execute("SHOW STATUS LIKE 'Threads_connected'")
    const connections = parseInt(conns[0].Value)
    
    if (connections > ALERT_THRESHOLD.connections) {
      log('WARN', `⚠️  ALERTE: Connexions MySQL élevées: ${connections}/${ALERT_THRESHOLD.connections}`)
      await sendAlert(`Connexions MySQL élevées: ${connections}`)
    } else {
      log('INFO', `📊 Connexions MySQL: ${connections}`)
    }

    // Vérifier max connexions atteintes
    const [maxConn] = await db.execute("SHOW STATUS LIKE 'Max_used_connections'")
    const maxUsed = parseInt(maxConn[0].Value)
    log('INFO', `📈 Max connexions utilisées: ${maxUsed}`)

    // Vérifier requêtes lentes
    const [slowQ] = await db.execute("SHOW STATUS LIKE 'Slow_queries'")
    const slowQueries = parseInt(slowQ[0].Value)
    
    if (slowQueries > ALERT_THRESHOLD.slowQueries) {
      log('WARN', `⚠️  ALERTE: Requêtes lentes détectées: ${slowQueries}`)
    } else {
      log('INFO', `🐌 Requêtes lentes: ${slowQueries}`)
    }

    // Vérifier uptime MySQL
    const [uptime] = await db.execute("SHOW STATUS LIKE 'Uptime'")
    const uptimeSeconds = parseInt(uptime[0].Value)
    const uptimeHours = Math.floor(uptimeSeconds / 3600)
    log('INFO', `⏱️  MySQL uptime: ${uptimeHours} heures`)

    // Statistiques base de données
    const [users] = await db.execute('SELECT COUNT(*) as count FROM users WHERE status="Actif"')
    const [sessions] = await db.execute('SELECT COUNT(*) as count FROM work_sessions')
    const [tasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE status="Actif"')
    
    log('INFO', `👥 Utilisateurs actifs: ${users[0].count}`)
    log('INFO', `📝 Sessions enregistrées: ${sessions[0].count}`)
    log('INFO', `✅ Tâches actives: ${tasks[0].count}`)

    // Vérifier taille de la base
    const [dbSize] = await db.execute(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
    `, [DB_CONFIG.database])
    
    log('INFO', `💾 Taille base de données: ${dbSize[0].size_mb} MB`)

    return true
  } catch (err) {
    log('ERROR', `❌ Erreur MySQL: ${err.message}`)
    await sendAlert(`Erreur système MySQL: ${err.message}`)
    return false
  } finally {
    if (db) await db.end()
  }
}

async function checkSystemHealth() {
  try {
    // Vérifier mémoire Node.js
    const memUsage = process.memoryUsage()
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    
    log('INFO', `🧠 Mémoire Node.js: ${memMB} MB`)

    // Vérifier processus PM2 (si disponible)
    if (process.env.pm_id !== undefined) {
      log('INFO', `🔧 PM2 Instance ID: ${process.env.pm_id}`)
    }

    return true
  } catch (err) {
    log('ERROR', `❌ Erreur système: ${err.message}`)
    return false
  }
}

async function sendAlert(message) {
  // TODO: Intégrer l'envoi d'emails ou notifications
  // Pour l'instant, juste log
  log('WARN', `🚨 ALERTE: ${message}`)
  
  // Exemple avec nodemailer (à configurer)
  /*
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    host: 'smtp.bgfibank.com',
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })
  
  await transporter.sendMail({
    from: 'timetrack@bgfibank.com',
    to: 'admin@bgfibank.com',
    subject: '🚨 TimeTrack Alert',
    text: message
  })
  */
}

async function runChecks() {
  log('INFO', '═══════════════════════════════════════════════════════')
  log('INFO', '🔍 Démarrage vérification système TimeTrack BGFIBank')
  log('INFO', '═══════════════════════════════════════════════════════')
  
  const mysqlOk = await checkMySQLHealth()
  const systemOk = await checkSystemHealth()
  
  if (mysqlOk && systemOk) {
    log('INFO', '✅ Tous les contrôles sont OK !')
  } else {
    log('WARN', '⚠️  Certains contrôles ont échoué')
  }
  
  log('INFO', '═══════════════════════════════════════════════════════')
  log('INFO', `⏰ Prochaine vérification dans ${CHECK_INTERVAL / 60000} minutes`)
  log('INFO', '═══════════════════════════════════════════════════════')
}

// Vérification immédiate au démarrage
log('INFO', '🚀 TimeTrack Monitoring démarré')
runChecks()

// Vérifications périodiques
setInterval(runChecks, CHECK_INTERVAL)

// Gérer arrêt propre
process.on('SIGINT', () => {
  log('INFO', '🛑 Arrêt du monitoring')
  process.exit(0)
})

process.on('SIGTERM', () => {
  log('INFO', '🛑 Arrêt du monitoring')
  process.exit(0)
})
