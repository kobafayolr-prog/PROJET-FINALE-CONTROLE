/**
 * TimeTrack BGFIBank - Backend Node.js + Express + MySQL2
 * Même interface que la version Cloudflare Workers (D1/SQLite)
 * Toutes les routes et logiques sont identiques, seul le driver DB change.
 */

const express = require('express')
const mysql = require('mysql2/promise')
const path = require('path')
const crypto = require('crypto')

const app = express()
app.use(express.json())

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'timetrack-bgfibank-secret-2024-x9k2p7m'

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'timetrack_user',
  password: process.env.DB_PASSWORD || 'TimeTrack@BGFIBank2024!',
  database: process.env.DB_NAME     || 'timetrack_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
  charset: 'utf8mb4'
}

// Pool de connexions MySQL
let db

async function initDB () {
  db = mysql.createPool(DB_CONFIG)
  // Test connexion
  const conn = await db.getConnection()
  console.log('✅ Connecté à MySQL :', DB_CONFIG.host + ':' + DB_CONFIG.port + '/' + DB_CONFIG.database)
  conn.release()
}

// ============================================
// HEADERS DE SÉCURITÉ
// ============================================

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// ============================================
// UTILITAIRES
// ============================================

// Rate limiting en mémoire
const loginAttempts = new Map()
const MAX_ATTEMPTS = 3
const BLOCK_DURATION = 15 * 60 * 1000 // 15 min

function checkRateLimit (ip) {
  const now = Date.now()
  const attempts = loginAttempts.get(ip)
  if (!attempts) return { blocked: false, remaining: MAX_ATTEMPTS, minutesLeft: 0 }
  if (attempts.blockedUntil > now) {
    return { blocked: true, remaining: 0, minutesLeft: Math.ceil((attempts.blockedUntil - now) / 60000) }
  }
  if (attempts.blockedUntil > 0 && attempts.blockedUntil <= now) {
    loginAttempts.delete(ip)
    return { blocked: false, remaining: MAX_ATTEMPTS, minutesLeft: 0 }
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - attempts.count, minutesLeft: 0 }
}

function recordFailedAttempt (ip) {
  const now = Date.now()
  const attempts = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 }
  attempts.count += 1
  if (attempts.count >= MAX_ATTEMPTS) attempts.blockedUntil = now + BLOCK_DURATION
  loginAttempts.set(ip, attempts)
  return { blocked: attempts.count >= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - attempts.count) }
}

function resetAttempts (ip) { loginAttempts.delete(ip) }

function sanitizeString (str) {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[<>"'%;()&+]/g, '')
}

function validateEmail (email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function hashPassword (password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function minutesToHours (minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Chiffrement XOR + base64 (identique au frontend)
function encryptPassword (password) {
  const key = 'bgfibank2024'
  let result = ''
  for (let i = 0; i < password.length; i++) {
    result += String.fromCharCode(password.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return Buffer.from(result, 'binary').toString('base64')
}

function decryptPassword (encrypted) {
  try {
    const key = 'bgfibank2024'
    const decoded = Buffer.from(encrypted, 'base64').toString('binary')
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result
  } catch {
    return '••••••••'
  }
}

// JWT manuel HMAC-SHA256 (compatible avec le frontend existant)
function base64url (buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJWT (payload) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body   = base64url(Buffer.from(JSON.stringify(payload)))
  const data   = `${header}.${body}`
  const sig    = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest())
  return `${data}.${sig}`
}

function verifyJWT (token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const data = `${parts[0]}.${parts[1]}`
    const expectedSig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest())
    if (expectedSig !== parts[2]) return null
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    return payload
  } catch { return null }
}

function getUser (req) {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) return null
    return verifyJWT(auth.slice(7))
  } catch { return null }
}

// Helper pour exécuter une requête et retourner les lignes
async function query (sql, params = []) {
  const [rows] = await db.execute(sql, params)
  return rows
}

// Helper pour INSERT/UPDATE/DELETE → retourne insertId, affectedRows
async function run (sql, params = []) {
  const [result] = await db.execute(sql, params)
  return result
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'

    const rateCheck = checkRateLimit(ip)
    if (rateCheck.blocked) {
      return res.status(429).json({
        error: `Compte temporairement bloqué suite à ${MAX_ATTEMPTS} tentatives échouées. Réessayez dans ${rateCheck.minutesLeft} minute(s).`,
        blocked: true,
        minutesLeft: rateCheck.minutesLeft
      })
    }

    const { email: rawEmail, password } = req.body
    const email = sanitizeString(rawEmail || '')

    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })
    if (!validateEmail(email)) return res.status(400).json({ error: 'Format email invalide' })
    if (password.length < 4 || password.length > 100) return res.status(400).json({ error: 'Mot de passe invalide' })

    const rows = await query(
      'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email = ? AND u.status = "Actif"',
      [email]
    )
    const user = rows[0]

    if (!user) {
      recordFailedAttempt(ip)
      const remaining = MAX_ATTEMPTS - (loginAttempts.get(ip)?.count || 0)
      return res.status(401).json({
        error: `Email ou mot de passe incorrect. ${Math.max(0, remaining)} tentative(s) restante(s).`,
        remaining: Math.max(0, remaining)
      })
    }

    const passwordHash = hashPassword(password)
    if (passwordHash !== user.password_hash) {
      const result = recordFailedAttempt(ip)
      await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
        [user.id, 'LOGIN_FAILED', `Tentative de connexion échouée pour ${user.first_name} ${user.last_name} depuis IP ${ip}`])

      if (result.blocked) {
        return res.status(429).json({ error: 'Trop de tentatives échouées. Compte bloqué pendant 15 minutes.', blocked: true, minutesLeft: 15 })
      }
      return res.status(401).json({
        error: `Email ou mot de passe incorrect. ${result.remaining} tentative(s) restante(s).`,
        remaining: result.remaining
      })
    }

    resetAttempts(ip)
    await run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, 'LOGIN', `Connexion réussie de ${user.first_name} ${user.last_name}`])

    const token = signJWT({
      id: user.id, email: user.email, role: user.role,
      department_id: user.department_id, first_name: user.first_name,
      last_name: user.last_name, department_name: user.department_name
    })

    return res.json({
      token,
      user: {
        id: user.id, first_name: user.first_name, last_name: user.last_name,
        email: user.email, role: user.role,
        department_id: user.department_id, department_name: user.department_name
      }
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/auth/me', (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  res.json({ user })
})

// ============================================
// ADMIN - USERS
// ============================================

app.get('/api/admin/users', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id ORDER BY u.created_at DESC')
  res.json(rows)
})

app.post('/api/admin/users', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { first_name: fn, last_name: ln, email: em, password, role, department_id, status } = req.body
    const first_name = sanitizeString(fn || '')
    const last_name  = sanitizeString(ln || '')
    const email      = sanitizeString(em || '')
    if (!validateEmail(email)) return res.status(400).json({ error: 'Email invalide' })
    if (!password || password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court (min 4 caractères)' })

    const passwordHash      = hashPassword(password)
    const passwordEncrypted = encryptPassword(password)
    const result = await run(
      'INSERT INTO users (first_name, last_name, email, password_hash, password_encrypted, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, passwordHash, passwordEncrypted, role, department_id || null, status || 'Actif']
    )
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [currentUser.id, 'CREATE_USER', `Création de l\'utilisateur ${first_name} ${last_name}`])
    res.json({ id: result.insertId, message: 'Utilisateur créé avec succès' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/admin/users/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const id = req.params.id
    const { first_name, last_name, email, password, role, department_id, status } = req.body
    if (password) {
      const passwordHash      = hashPassword(password)
      const passwordEncrypted = encryptPassword(password)
      await run(
        'UPDATE users SET first_name=?, last_name=?, email=?, password_hash=?, password_encrypted=?, role=?, department_id=?, status=?, updated_at=NOW() WHERE id=?',
        [first_name, last_name, email, passwordHash, passwordEncrypted, role, department_id || null, status, id]
      )
    } else {
      await run(
        'UPDATE users SET first_name=?, last_name=?, email=?, role=?, department_id=?, status=?, updated_at=NOW() WHERE id=?',
        [first_name, last_name, email, role, department_id || null, status, id]
      )
    }
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [currentUser.id, 'UPDATE_USER', `Modification de l\'utilisateur ID ${id}`])
    res.json({ message: 'Utilisateur mis à jour' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/admin/users/:id/password', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const id = req.params.id
  const rows = await query('SELECT password_encrypted FROM users WHERE id = ?', [id])
  if (!rows[0]) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  const password = rows[0].password_encrypted ? decryptPassword(rows[0].password_encrypted) : '(mot de passe non disponible)'
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'VIEW_PASSWORD', `Consultation du mot de passe de l\'utilisateur ID ${id}`])
  res.json({ password })
})

app.delete('/api/admin/users/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  await run('DELETE FROM users WHERE id = ?', [req.params.id])
  res.json({ message: 'Utilisateur supprimé' })
})

// ============================================
// ADMIN - DEPARTMENTS
// ============================================

app.get('/api/admin/departments', async (req, res) => {
  const rows = await query('SELECT * FROM departments ORDER BY name')
  res.json(rows)
})

app.post('/api/admin/departments', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { name, code, description, status } = req.body
    const result = await run(
      'INSERT INTO departments (name, code, description, status) VALUES (?, ?, ?, ?)',
      [name, code, description || '', status || 'Actif']
    )
    res.json({ id: result.insertId, message: 'Département créé' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/admin/departments/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, code, description, status } = req.body
  await run(
    'UPDATE departments SET name=?, code=?, description=?, status=?, updated_at=NOW() WHERE id=?',
    [name, code, description || '', status, req.params.id]
  )
  res.json({ message: 'Département mis à jour' })
})

// ============================================
// ADMIN - OBJECTIVES
// ============================================

app.get('/api/admin/objectives', async (req, res) => {
  const rows = await query('SELECT * FROM strategic_objectives ORDER BY name')
  res.json(rows)
})

app.post('/api/admin/objectives', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, color, target_percentage, status } = req.body
  const result = await run(
    'INSERT INTO strategic_objectives (name, description, color, target_percentage, status) VALUES (?, ?, ?, ?, ?)',
    [name, description || '', color || '#1e3a5f', target_percentage || 0, status || 'Actif']
  )
  res.json({ id: result.insertId, message: 'Objectif créé' })
})

app.put('/api/admin/objectives/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, color, target_percentage, status } = req.body
  await run(
    'UPDATE strategic_objectives SET name=?, description=?, color=?, target_percentage=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', color || '#1e3a5f', target_percentage || 0, status, req.params.id]
  )
  res.json({ message: 'Objectif mis à jour' })
})

// ============================================
// ADMIN - PROCESSES
// ============================================

app.get('/api/admin/processes', async (req, res) => {
  const rows = await query(
    `SELECT p.*, d.name as department_name, o.name as objective_name, o.color as objective_color
     FROM processes p
     JOIN departments d ON p.department_id = d.id
     JOIN strategic_objectives o ON p.objective_id = o.id
     ORDER BY p.name`
  )
  res.json(rows)
})

app.post('/api/admin/processes', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, objective_id, status } = req.body
  const result = await run(
    'INSERT INTO processes (name, description, department_id, objective_id, status) VALUES (?, ?, ?, ?, ?)',
    [name, description || '', department_id, objective_id, status || 'Actif']
  )
  res.json({ id: result.insertId, message: 'Processus créé' })
})

app.put('/api/admin/processes/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, objective_id, status } = req.body
  await run(
    'UPDATE processes SET name=?, description=?, department_id=?, objective_id=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', department_id, objective_id, status, req.params.id]
  )
  res.json({ message: 'Processus mis à jour' })
})

// ============================================
// ADMIN - TASKS
// ============================================

app.get('/api/admin/tasks', async (req, res) => {
  const rows = await query(
    `SELECT t.*, d.name as department_name, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t
     JOIN departments d ON t.department_id = d.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON t.objective_id = o.id
     ORDER BY t.name`
  )
  res.json(rows)
})

app.post('/api/admin/tasks', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, process_id, objective_id, task_type, status } = req.body
  const result = await run(
    'INSERT INTO tasks (name, description, department_id, process_id, objective_id, task_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || '', department_id, process_id, objective_id, task_type || 'Productive', status || 'Actif']
  )
  res.json({ id: result.insertId, message: 'Tâche créée' })
})

app.put('/api/admin/tasks/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, process_id, objective_id, task_type, status } = req.body
  await run(
    'UPDATE tasks SET name=?, description=?, department_id=?, process_id=?, objective_id=?, task_type=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', department_id, process_id, objective_id, task_type || 'Productive', status, req.params.id]
  )
  res.json({ message: 'Tâche mise à jour' })
})

// ============================================
// ADMIN - SESSIONS
// ============================================

app.get('/api/admin/sessions', async (req, res) => {
  const rows = await query(
    `SELECT ws.*,
     CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     d.name as department_name,
     t.name as task_name,
     o.name as objective_name,
     o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN departments d ON ws.department_id = d.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     ORDER BY ws.created_at DESC
     LIMIT 200`
  )
  res.json(rows)
})

// ============================================
// ADMIN - STATS
// ============================================

app.get('/api/admin/stats', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })

  const hoursByObjective = await query(
    `SELECT o.name, o.color, o.target_percentage,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.status = 'Validé'
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color, o.target_percentage
     ORDER BY total_minutes DESC`
  )

  const hoursByDept = await query(
    `SELECT d.name, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM departments d
     LEFT JOIN work_sessions ws ON ws.department_id = d.id AND ws.status = 'Validé'
     GROUP BY d.id, d.name
     HAVING total_minutes > 0
     ORDER BY total_minutes DESC`
  )

  // MySQL: DATE_FORMAT au lieu de strftime
  const monthlyTrend = await query(
    `SELECT DATE_FORMAT(start_time, '%Y-%m') as month,
     COALESCE(SUM(duration_minutes), 0) as total_minutes
     FROM work_sessions WHERE status = 'Validé'
     GROUP BY DATE_FORMAT(start_time, '%Y-%m')
     ORDER BY month DESC LIMIT 6`
  )

  const totalAgents = await query(
    `SELECT COUNT(*) as count FROM users WHERE role = 'Agent' AND status = 'Actif'`
  )

  // MySQL: DATE() et CURDATE() au lieu de date() et date('now')
  const productivityToday = await query(
    `SELECT 
       u.id,
       CONCAT(u.first_name, ' ', u.last_name) as agent_name,
       d.name as department_name,
       COALESCE(SUM(ws.duration_minutes), 0) as productive_minutes,
       CASE WHEN 480 - COALESCE(SUM(ws.duration_minutes), 0) > 0 THEN 480 - COALESCE(SUM(ws.duration_minutes), 0) ELSE 0 END as non_productive_minutes
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN work_sessions ws ON ws.user_id = u.id 
       AND ws.status = 'Validé' 
       AND DATE(ws.start_time) = CURDATE()
     WHERE u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name, d.name`
  )

  const agentsCount = totalAgents[0]?.count || 0
  const totalProductiveToday  = productivityToday.reduce((s, a) => s + Math.min(a.productive_minutes, 480), 0)
  const totalNonProductiveToday = productivityToday.reduce((s, a) => s + a.non_productive_minutes, 0)
  const totalCapacityToday = agentsCount * 480

  const totalMinutes = hoursByObjective.reduce((sum, o) => sum + o.total_minutes, 0)
  const objectivesWithPct = hoursByObjective.map(o => ({
    ...o,
    percentage: totalMinutes > 0 ? Math.round((o.total_minutes / totalMinutes) * 100) : 0,
    hours_display: minutesToHours(o.total_minutes)
  }))

  res.json({
    hoursByObjective: objectivesWithPct,
    hoursByDept,
    monthlyTrend,
    productivity: {
      total_agents: agentsCount,
      total_capacity_today: totalCapacityToday,
      productive_minutes_today: totalProductiveToday,
      non_productive_minutes_today: totalNonProductiveToday,
      productive_hours_today: minutesToHours(totalProductiveToday),
      non_productive_hours_today: minutesToHours(totalNonProductiveToday),
      productive_pct: totalCapacityToday > 0 ? Math.round((totalProductiveToday / totalCapacityToday) * 100) : 0,
      non_productive_pct: totalCapacityToday > 0 ? Math.round((totalNonProductiveToday / totalCapacityToday) * 100) : 0,
      agents_detail: productivityToday.map(a => ({
        ...a,
        productive_hours: minutesToHours(Math.min(a.productive_minutes, 480)),
        non_productive_hours: minutesToHours(a.non_productive_minutes),
        productive_pct: Math.round((Math.min(a.productive_minutes, 480) / 480) * 100),
        non_productive_pct: Math.round((a.non_productive_minutes / 480) * 100)
      }))
    }
  })
})

// ============================================
// ADMIN - RAPPORTS & AUDIT
// ============================================

app.get('/api/admin/reports', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT ws.*,
     CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     d.name as department_name,
     t.name as task_name,
     p.name as process_name,
     o.name as objective_name,
     o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN departments d ON ws.department_id = d.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     ORDER BY ws.start_time DESC`
  )
  res.json(rows)
})

app.get('/api/admin/audit', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT al.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC LIMIT 100`
  )
  res.json(rows)
})

// ============================================
// AGENT - DASHBOARD
// ============================================

app.get('/api/agent/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  const today = new Date().toISOString().split('T')[0]

  const todayStats = await query(
    `SELECT COALESCE(SUM(duration_minutes), 0) as today_minutes
     FROM work_sessions WHERE user_id = ? AND DATE(start_time) = ? AND status IN ('Validé', 'Terminé')`,
    [user.id, today]
  )
  const totalStats = await query(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
     FROM work_sessions WHERE user_id = ? AND status IN ('Validé', 'Terminé')`,
    [user.id]
  )
  const sessionStats = await query(
    `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Rejeté' THEN 1 ELSE 0 END) as rejected
     FROM work_sessions WHERE user_id = ?`,
    [user.id]
  )
  const byObjective = await query(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.user_id = ? AND ws.status IN ('Validé', 'Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color
     HAVING total_minutes > 0
     ORDER BY total_minutes DESC`,
    [user.id]
  )

  const totalMin = byObjective.reduce((sum, o) => sum + o.total_minutes, 0)
  res.json({
    today_minutes: todayStats[0]?.today_minutes || 0,
    today_hours: minutesToHours(todayStats[0]?.today_minutes || 0),
    total_minutes: totalStats[0]?.total_minutes || 0,
    total_hours: minutesToHours(totalStats[0]?.total_minutes || 0),
    total_sessions: sessionStats[0]?.total || 0,
    rejected_sessions: sessionStats[0]?.rejected || 0,
    byObjective: byObjective.map(o => ({
      ...o,
      percentage: totalMin > 0 ? Math.round((o.total_minutes / totalMin) * 100) : 0,
      hours_display: minutesToHours(o.total_minutes)
    }))
  })
})

// ============================================
// AGENT - TÂCHES
// ============================================

app.get('/api/agent/tasks', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT t.*, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON t.objective_id = o.id
     WHERE t.department_id = ? AND t.status = 'Actif'
     ORDER BY o.name, t.name`,
    [user.department_id]
  )
  res.json(rows)
})

// ============================================
// AGENT - SESSIONS
// ============================================

app.get('/api/agent/sessions', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT ws.*, t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.user_id = ?
     ORDER BY ws.start_time DESC`,
    [user.id]
  )
  res.json(rows)
})

app.get('/api/agent/sessions/active', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT ws.*, t.name as task_name, o.name as objective_name
     FROM work_sessions ws
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.user_id = ? AND ws.status = 'En cours'
     LIMIT 1`,
    [user.id]
  )
  res.json(rows[0] || null)
})

app.post('/api/agent/sessions/start', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { task_id } = req.body
    const active = await query('SELECT id FROM work_sessions WHERE user_id = ? AND status = "En cours"', [user.id])
    if (active.length > 0) return res.status(400).json({ error: 'Une session est déjà en cours' })

    const task = await query('SELECT * FROM tasks WHERE id = ?', [task_id])
    if (!task[0]) return res.status(404).json({ error: 'Tâche non trouvée' })

    const result = await run(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, session_type, status) VALUES (?, ?, ?, ?, NOW(), "Auto", "En cours")',
      [user.id, task_id, task[0].objective_id, user.department_id]
    )
    res.json({ id: result.insertId, message: 'Session démarrée' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/agent/sessions/stop', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const active = await query('SELECT * FROM work_sessions WHERE user_id = ? AND status = "En cours"', [user.id])
    if (!active[0]) return res.status(400).json({ error: 'Aucune session en cours' })
    const durationMinutes = Math.round((Date.now() - new Date(active[0].start_time).getTime()) / 60000)
    await run(
      'UPDATE work_sessions SET end_time=NOW(), duration_minutes=?, status="Terminé", updated_at=NOW() WHERE id=?',
      [durationMinutes, active[0].id]
    )
    res.json({ message: 'Session arrêtée', duration_minutes: durationMinutes })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/agent/sessions/manual', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { task_id, start_time, end_time, comment } = req.body
    const task = await query('SELECT * FROM tasks WHERE id = ?', [task_id])
    if (!task[0]) return res.status(404).json({ error: 'Tâche non trouvée' })
    const durationMinutes = Math.round((new Date(end_time) - new Date(start_time)) / 60000)
    if (durationMinutes < 0) return res.status(400).json({ error: 'La date de fin doit être après la date de début' })
    const result = await run(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, end_time, duration_minutes, session_type, status, comment) VALUES (?, ?, ?, ?, ?, ?, ?, "Manuelle", "Terminé", ?)',
      [user.id, task_id, task[0].objective_id, user.department_id, start_time, end_time, durationMinutes, comment || '']
    )
    res.json({ id: result.insertId, message: 'Session enregistrée' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ============================================
// AGENT - STATS
// ============================================

app.get('/api/agent/stats', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const today = new Date().toISOString().split('T')[0]

  const todayMin      = await query(`SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND DATE(start_time)=? AND status IN ('Validé','Terminé')`, [user.id, today])
  const totalMin      = await query(`SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`, [user.id])
  const validatedMin  = await query(`SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND status='Validé'`, [user.id])
  const totalSessions = await query(`SELECT COUNT(*) as c FROM work_sessions WHERE user_id=?`, [user.id])
  const byObjective   = await query(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes, COUNT(ws.id) as session_count
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.user_id = ? AND ws.status IN ('Validé','Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color
     ORDER BY total_minutes DESC`,
    [user.id]
  )
  const totalM = byObjective.reduce((sum, o) => sum + o.total_minutes, 0)
  res.json({
    today_hours: minutesToHours(todayMin[0]?.m || 0),
    total_hours: minutesToHours(totalMin[0]?.m || 0),
    validated_hours: minutesToHours(validatedMin[0]?.m || 0),
    total_sessions: totalSessions[0]?.c || 0,
    byObjective: byObjective.map(o => ({
      ...o,
      percentage: totalM > 0 ? Math.round((o.total_minutes / totalM) * 100) : 0,
      hours_display: minutesToHours(o.total_minutes)
    }))
  })
})

// ============================================
// CHEF - DASHBOARD
// ============================================

app.get('/api/chef/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const deptId = user.department_id

  const activeAgents = await query(
    `SELECT COUNT(DISTINCT user_id) as count FROM work_sessions WHERE department_id = ? AND DATE(start_time) = CURDATE()`,
    [deptId]
  )
  const totalTeamHours = await query(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions 
     WHERE department_id = ? AND DATE_FORMAT(start_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') AND status IN ('Validé','Terminé')`,
    [deptId]
  )
  const toValidate = await query(
    `SELECT COUNT(*) as c FROM work_sessions WHERE department_id = ? AND status = 'Terminé'`,
    [deptId]
  )
  const hoursByAgent = await query(
    `SELECT CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND ws.status IN ('Validé','Terminé')
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`,
    [deptId]
  )
  const byObjective = await query(
    `SELECT o.name, o.color, o.target_percentage,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.department_id = ? AND ws.status IN ('Validé','Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color, o.target_percentage
     HAVING total_minutes > 0`,
    [deptId]
  )
  const agentDetail = await query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     COUNT(ws.id) as total_sessions,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END) * 100.0 / NULLIF(SUM(ws.duration_minutes), 0), 0) as pct_validated
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`,
    [deptId]
  )
  const agentProductivityToday = await query(
    `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     COALESCE(SUM(ws.duration_minutes), 0) as productive_minutes_today,
     CASE WHEN 480 - COALESCE(SUM(ws.duration_minutes), 0) > 0 THEN 480 - COALESCE(SUM(ws.duration_minutes), 0) ELSE 0 END as non_productive_minutes_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id 
       AND ws.status = 'Validé' 
       AND DATE(ws.start_time) = CURDATE()
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`,
    [deptId]
  )

  const objData = byObjective
  const totalMin = objData.reduce((sum, o) => sum + o.total_minutes, 0)
  const productivityMap = {}
  for (const p of agentProductivityToday) productivityMap[p.id] = p

  const nbAgents = agentDetail.length
  const totalProductiveTeam   = agentProductivityToday.reduce((s, a) => s + Math.min(a.productive_minutes_today, 480), 0)
  const totalNonProductiveTeam = agentProductivityToday.reduce((s, a) => s + a.non_productive_minutes_today, 0)

  res.json({
    active_agents: activeAgents[0]?.count || 0,
    total_team_hours: minutesToHours(totalTeamHours[0]?.m || 0),
    to_validate: toValidate[0]?.c || 0,
    hoursByAgent,
    byObjective: objData.map(o => ({
      ...o,
      percentage: totalMin > 0 ? Math.round((o.total_minutes / totalMin) * 100) : 0,
      hours_display: minutesToHours(o.total_minutes)
    })),
    agentDetail: agentDetail.map(a => {
      const p = productivityMap[a.id] || { productive_minutes_today: 0, non_productive_minutes_today: 480 }
      return {
        ...a,
        total_hours: minutesToHours(a.total_minutes),
        validated_hours: minutesToHours(a.validated_minutes),
        productive_minutes_today: Math.min(p.productive_minutes_today, 480),
        non_productive_minutes_today: p.non_productive_minutes_today,
        productive_hours_today: minutesToHours(Math.min(p.productive_minutes_today, 480)),
        non_productive_hours_today: minutesToHours(p.non_productive_minutes_today),
        productive_pct_today: Math.round((Math.min(p.productive_minutes_today, 480) / 480) * 100),
        non_productive_pct_today: Math.round((p.non_productive_minutes_today / 480) * 100)
      }
    }),
    team_productivity: {
      total_agents: nbAgents,
      productive_hours_today: minutesToHours(totalProductiveTeam),
      non_productive_hours_today: minutesToHours(totalNonProductiveTeam),
      productive_pct: nbAgents > 0 ? Math.round((totalProductiveTeam / (nbAgents * 480)) * 100) : 0,
      non_productive_pct: nbAgents > 0 ? Math.round((totalNonProductiveTeam / (nbAgents * 480)) * 100) : 0
    }
  })
})

// ============================================
// CHEF - ÉQUIPE
// ============================================

app.get('/api/chef/team', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const today = new Date().toISOString().split('T')[0]
  const members = await query(
    `SELECT u.*,
     COALESCE(SUM(CASE WHEN DATE(ws.start_time) = ? THEN 1 ELSE 0 END), 0) as today_sessions,
     COALESCE(SUM(CASE WHEN DATE(ws.start_time) = ? THEN ws.duration_minutes ELSE 0 END), 0) as today_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND ws.status IN ('Validé','Terminé')
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id`,
    [today, today, user.department_id]
  )
  res.json(members.map(m => ({ ...m, today_hours: minutesToHours(m.today_minutes), password_hash: undefined })))
})

// ============================================
// CHEF - VALIDATION
// ============================================

app.get('/api/chef/validation', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const rows = await query(
    `SELECT ws.*, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.department_id = ? AND ws.status = 'Terminé'
     ORDER BY ws.start_time DESC`,
    [user.department_id]
  )
  res.json(rows)
})

app.post('/api/chef/validate/:id', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const id = req.params.id
  await run('UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=NOW(), updated_at=NOW() WHERE id=?', [user.id, id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)', [user.id, 'VALIDATION', `Session #${id} validée`])
  res.json({ message: 'Session validée' })
})

app.post('/api/chef/reject/:id', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const id = req.params.id
  const reason = req.body?.reason || ''
  await run('UPDATE work_sessions SET status="Rejeté", rejected_reason=?, updated_at=NOW() WHERE id=?', [reason, id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)', [user.id, 'REJET', `Session #${id} rejetée`])
  res.json({ message: 'Session rejetée' })
})

app.post('/api/chef/validate-all', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  await run('UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=NOW() WHERE department_id=? AND status="Terminé"', [user.id, user.department_id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)', [user.id, 'VALIDATION', 'Validation groupée de toutes les sessions du département'])
  res.json({ message: 'Toutes les sessions validées' })
})

// ============================================
// CHEF - RAPPORTS
// ============================================

app.get('/api/chef/reports', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const rows = await query(
    `SELECT ws.*, CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     t.name as task_name, p.name as process_name,
     o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.department_id = ?
     ORDER BY ws.start_time DESC`,
    [user.department_id]
  )
  res.json(rows)
})

// ============================================
// FICHIERS STATIQUES + SPA ROUTES
// ============================================

const staticDir = path.join(__dirname, 'public', 'static')
app.use('/static', express.static(staticDir))

// HTML templates (identiques à la version Cloudflare)
function getLoginHTML () {
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack - BGFIBank</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<style>
  body { background: linear-gradient(135deg, #0f2544 0%, #1e3a5f 50%, #0f2544 100%); min-height: 100vh; }
  .login-card { background: white; border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,0.35); }
  .btn-primary { background: #1e3a5f; color: white; transition: all 0.2s; }
  .btn-primary:hover { background: #0f2544; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30,58,95,0.4); }
  .input-field { border: 1px solid #d1d5db; border-radius: 8px; padding: 11px 14px; width: 100%; outline: none; transition: border 0.2s; font-size: 14px; }
  .input-field:focus { border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.12); }
  .logo-wrapper { background: #fff; border-radius: 12px; padding: 16px 24px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.10); margin-bottom: 20px; }
  .logo-wrapper img { height: 64px; width: auto; display: block; }
  .divider { height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent); margin: 20px 0; }
  .app-badge { display: inline-flex; align-items: center; gap: 6px; background: #f0f4f8; border-radius: 20px; padding: 4px 12px; font-size: 12px; color: #4b6080; font-weight: 500; }
</style>
</head>
<body class="flex items-center justify-center min-h-screen p-4">
<div class="login-card w-full max-w-md p-8">
  <div class="text-center mb-6">
    <div class="logo-wrapper">
      <img src="/static/bgfibank-logo.png" alt="BGFIBank - Votre partenaire pour l'avenir">
    </div>
    <div class="divider"></div>
    <div class="app-badge">
      <i class="fas fa-clock" style="color:#1e3a5f"></i>
      <span>TimeTrack &mdash; Suivi du temps</span>
    </div>
  </div>
  <div id="error-msg" class="hidden bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm"></div>
  <form id="login-form">
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
      <input type="email" id="email" class="input-field" placeholder="email@bgfibank.com" required>
    </div>
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
      <div class="relative">
        <input type="password" id="password" class="input-field pr-10" placeholder="••••••••" required>
        <button type="button" onclick="togglePwd()" class="absolute right-3 top-3 text-gray-400">
          <i class="fas fa-eye" id="eye-icon"></i>
        </button>
      </div>
    </div>
    <button type="submit" class="btn-primary w-full py-3 rounded-lg font-semibold text-sm" id="login-btn">
      <i class="fas fa-sign-in-alt mr-2"></i>Se connecter
    </button>
  </form>
</div>
<script>
function togglePwd(){const p=document.getElementById('password');const i=document.getElementById('eye-icon');if(p.type==='password'){p.type='text';i.className='fas fa-eye-slash';}else{p.type='password';i.className='fas fa-eye';}}
document.getElementById('login-form').addEventListener('submit',async(e)=>{
  e.preventDefault();const btn=document.getElementById('login-btn');const err=document.getElementById('error-msg');
  btn.innerHTML='<i class="fas fa-spinner fa-spin mr-2"></i>Connexion...';btn.disabled=true;err.classList.add('hidden');
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});
    const d=await r.json();
    if(!r.ok){
      if(d.blocked){err.innerHTML='<i class="fas fa-lock mr-1"></i> '+d.error;err.classList.remove('hidden');btn.innerHTML='<i class="fas fa-lock mr-2"></i>Compte bloqué';btn.disabled=true;setTimeout(()=>{btn.innerHTML='<i class="fas fa-sign-in-alt mr-2"></i>Se connecter';btn.disabled=false;},d.minutesLeft*60*1000);}
      else{err.innerHTML='<i class="fas fa-exclamation-circle mr-1"></i> '+(d.error||'Erreur de connexion');err.classList.remove('hidden');btn.innerHTML='<i class="fas fa-sign-in-alt mr-2"></i>Se connecter';btn.disabled=false;}
      return;
    }
    localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));
    if(d.user.role==='Administrateur')window.location='/admin/dashboard';
    else if(d.user.role==='Chef de Département')window.location='/chef/dashboard';
    else window.location='/agent/dashboard';
  }catch(e){err.innerHTML='<i class="fas fa-exclamation-circle mr-1"></i> '+e.message;err.classList.remove('hidden');btn.innerHTML='<i class="fas fa-sign-in-alt mr-2"></i>Se connecter';btn.disabled=false;}
});
const t=localStorage.getItem('token');if(t){const u=JSON.parse(localStorage.getItem('user')||'{}');if(u.role==='Administrateur')window.location='/admin/dashboard';else if(u.role==='Chef de Département')window.location='/chef/dashboard';else if(u.role==='Agent')window.location='/agent/dashboard';}
</script></body></html>`
}

app.get('/login', (req, res) => res.send(getLoginHTML()))
app.get('/admin*', (req, res) => res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TimeTrack Admin - BGFIBank</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><link rel="stylesheet" href="/static/admin.css"></head><body><div id="app"></div><script src="/static/admin.js"></script></body></html>`))
app.get('/agent*', (req, res) => res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TimeTrack Agent - BGFIBank</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><link rel="stylesheet" href="/static/agent.css"></head><body><div id="app"></div><script src="/static/agent.js"></script></body></html>`))
app.get('/chef*', (req, res) => res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>TimeTrack Chef - BGFIBank</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><link rel="stylesheet" href="/static/chef.css"></head><body><div id="app"></div><script src="/static/chef.js"></script></body></html>`))
app.get('/', (req, res) => res.redirect('/login'))

// ============================================
// DÉMARRAGE
// ============================================

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TimeTrack BGFIBank (MySQL) démarré sur http://0.0.0.0:${PORT}`)
    console.log(`   Base de données: ${DB_CONFIG.database} @ ${DB_CONFIG.host}:${DB_CONFIG.port}`)
    console.log(`   Accès local:   http://localhost:${PORT}/login`)
  })
}).catch(err => {
  console.error('❌ Impossible de se connecter à MySQL:', err.message)
  console.error('   Vérifiez que MySQL est démarré et que les paramètres de connexion sont corrects.')
  console.error('   Paramètres actuels:', JSON.stringify({ host: DB_CONFIG.host, port: DB_CONFIG.port, user: DB_CONFIG.user, database: DB_CONFIG.database }))
  process.exit(1)
})
