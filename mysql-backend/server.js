/**
 * TimeTrack BGFIBank - Backend Node.js + Express + MySQL2
 * Version COMPLÈTE — 61 routes (identique à index.tsx)
 * Sécurité : PBKDF2 (600 000 itérations), JWT avec expiration 8h,
 *             rate-limiting, audit logs, CORS restreint
 */

'use strict'

const express = require('express')
const mysql   = require('mysql2/promise')
const path    = require('path')
const crypto  = require('crypto')
const QRCode  = require('qrcode')
const twofa   = require('./src/utils/twofa')

const app = express()
app.use(express.json())

// ============================================
// CONFIGURATION
// ============================================

const PORT       = process.env.PORT       || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'timetrack-bgfibank-secret-2024-x9k2p7m'
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY_SECONDS || '28800') // 8 heures par défaut

const DB_CONFIG = {
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'timetrack_user',
  password:           process.env.DB_PASSWORD || 'TimeTrack@BGFIBank2024!',
  database:           process.env.DB_NAME     || 'timetrack_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4'
}

let db

async function initDB () {
  db = mysql.createPool(DB_CONFIG)
  const conn = await db.getConnection()
  console.log('✅ Connecté à MySQL :', DB_CONFIG.host + ':' + DB_CONFIG.port + '/' + DB_CONFIG.database)
  conn.release()
}

// ============================================
// HEADERS DE SÉCURITÉ + CORS
// ============================================

// SÉCURITÉ: CORS restrictif par défaut (localhost uniquement)
// En production, définir ALLOWED_ORIGINS dans .env avec les domaines autorisés
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS[0] === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // ✅ NOUVEAU: Content-Security-Policy (CSP) — Protection XSS bancaire stricte
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ')
  res.setHeader('Content-Security-Policy', cspDirectives)
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// ============================================
// UTILITAIRES GÉNÉRAUX
// ============================================

function sanitizeString (str) {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[<>"'%;()&+]/g, '')
}

function validateEmail (email) {
  // Regex renforcée : alphanumérique + . _ % + - uniquement
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
}

function minutesToHours (minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Validation du format YYYY-MM pour prévenir injection SQL
function validateMonthFormat (month) {
  if (!month) return null
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  return month
}

// ============================================
// HACHAGE MOT DE PASSE (PBKDF2 — identique au frontend)
// Format stocké : pbkdf2:sha256:600000:<salt_hex>:<hash_hex>
// ============================================

function hashPassword (password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex')
  return `pbkdf2:sha256:600000:${salt}:${hash}`
}

function verifyPassword (password, storedHash) {
  try {
    if (!storedHash) return false
    // Format PBKDF2
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':')
      if (parts.length !== 5) return false
      const [, algo, iters, salt, expected] = parts
      const iterations = parseInt(iters)
      const computed = crypto.pbkdf2Sync(password, salt, iterations, 32, algo).toString('hex')
      return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expected, 'hex'))
    }
    // Rétrocompatibilité SHA-256 simple (ancien format)
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex')
    return sha256Hash === storedHash
  } catch { return false }
}

// ============================================
// CHIFFREMENT XOR+BASE64 (consultation mot de passe admin)
// ============================================

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
  } catch { return '••••••••' }
}

// ============================================
// JWT MANUEL HMAC-SHA256 (avec expiration)
// ============================================

function base64url (buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJWT (payload, expiresInSeconds = JWT_EXPIRY) {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds }
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body   = base64url(Buffer.from(JSON.stringify(fullPayload)))
  const data   = `${header}.${body}`
  const sig    = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest())
  return `${data}.${sig}`
}

function verifyJWT (token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const data        = `${parts[0]}.${parts[1]}`
    const expectedSig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest())
    if (expectedSig !== parts[2]) return null
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    // Vérifier expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch { return null }
}

// ============================================
// BLACKLIST JWT (logout serveur)
// ============================================
// JWT BLACKLIST (persistante en base SQL)
// ============================================

// Hash SHA-256 d'un token pour stockage sécurisé
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Vérifier si un token est blacklisté (async)
async function isTokenBlacklisted(token) {
  const hash = hashToken(token)
  const rows = await query('SELECT id FROM invalidated_tokens WHERE token_hash = ?', [hash])
  return rows.length > 0
}

// Ajouter un token à la blacklist
async function blacklistToken(token) {
  const hash = hashToken(token)
  const payload = verifyJWT(token)
  if (!payload || !payload.exp) return
  const expiresAt = new Date(payload.exp * 1000)
  await run('INSERT IGNORE INTO invalidated_tokens (token_hash, expires_at) VALUES (?, ?)', [hash, expiresAt])
}

// Nettoyer les tokens expirés (cron quotidien)
setInterval(async () => {
  await run('DELETE FROM invalidated_tokens WHERE expires_at < NOW()')
}, 24 * 60 * 60 * 1000) // Toutes les 24h

async function getUser (req) {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) return null
    const token = auth.slice(7)
    if (await isTokenBlacklisted(token)) return null
    return verifyJWT(token)
  } catch { return null }
}

function getRawToken (req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// ============================================
// MIDDLEWARE UNIFIÉ : AUTORISATION PAR RÔLE
// ============================================

/**
 * Middleware Express pour vérifier l'authentification et les rôles autorisés
 * @param {...string} allowedRoles - Rôles autorisés (ex: 'Agent', 'Administrateur')
 * @returns {Function} Middleware Express
 * 
 * Usage:
 *   app.get('/api/admin/users', requireRole('Administrateur'), async (req, res) => { ... })
 *   app.get('/api/chef/sessions', requireRole('Chef de Département', 'Administrateur'), async (req, res) => { ... })
 */
function requireRole (...allowedRoles) {
  return async (req, res, next) => {
    const user = await getUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Accès interdit - rôle insuffisant' })
    }
    req.user = user // Injecter user dans req pour éviter getUser() dans la route
    next()
  }
}

// ============================================
// RATE LIMITING (tentatives de connexion)
// ============================================

const loginAttempts = new Map()
const MAX_ATTEMPTS  = 3
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

// ============================================
// CODES RESET MOT DE PASSE (en mémoire, 30 min)
// ============================================

const resetCodes = new Map()

// Rate-limiting sur tentatives de reset (anti brute-force)
const resetAttempts = new Map()
const MAX_RESET_ATTEMPTS = 3
const RESET_BLOCK_DURATION = 15 * 60 * 1000 // 15 min

function checkResetRateLimit(email) {
  const now = Date.now()
  const attempts = resetAttempts.get(email)
  if (!attempts) return { blocked: false, remaining: MAX_RESET_ATTEMPTS }
  if (attempts.blockedUntil > now) {
    return { blocked: true, remaining: 0, minutesLeft: Math.ceil((attempts.blockedUntil - now) / 60000) }
  }
  if (attempts.blockedUntil > 0 && attempts.blockedUntil <= now) {
    resetAttempts.delete(email)
    return { blocked: false, remaining: MAX_RESET_ATTEMPTS }
  }
  return { blocked: false, remaining: MAX_RESET_ATTEMPTS - attempts.count }
}

function recordResetAttempt(email) {
  const now = Date.now()
  const attempts = resetAttempts.get(email) || { count: 0, blockedUntil: 0 }
  attempts.count++
  if (attempts.count >= MAX_RESET_ATTEMPTS) attempts.blockedUntil = now + RESET_BLOCK_DURATION
  resetAttempts.set(email, attempts)
}

function clearResetAttempts(email) { resetAttempts.delete(email) }

function generateResetCode () {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ============================================
// HELPERS BASE DE DONNÉES
// ============================================

async function query (sql, params = []) {
  const [rows] = await db.execute(sql, params)
  return rows
}

async function run (sql, params = []) {
  const [result] = await db.execute(sql, params)
  return result
}

/**
 * ✅ NOUVEAU: Wrapper de transaction SQL atomique
 * Garantit que toutes les opérations réussissent ou échouent ensemble (ACID)
 * @param {Function} callback - Fonction async qui reçoit un objet { query, run }
 * @returns {Promise<any>} Résultat de la transaction
 * 
 * Usage:
 *   await transaction(async ({ query, run }) => {
 *     await run('INSERT INTO users ...')
 *     await run('UPDATE departments ...')
 *   })
 */
async function transaction (callback) {
  const connection = await db.getConnection()
  await connection.beginTransaction()
  try {
    const txQuery = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params)
      return rows
    }
    const txRun = async (sql, params = []) => {
      const [result] = await connection.execute(sql, params)
      return result
    }
    const result = await callback({ query: txQuery, run: txRun })
    await connection.commit()
    connection.release()
    return result
  } catch (error) {
    await connection.rollback()
    connection.release()
    throw error
  }
}

// Helper : calcule les jours ouvrés d'un mois (lun-ven ou lun-sam)
function calcWorkingDays (monthStr, includeSaturday = false) {
  const [y, mo] = monthStr.split('-').map(Number)
  const now = new Date()
  const isCurrentMonth = y === now.getFullYear() && mo === now.getMonth() + 1
  const lastDay = isCurrentMonth ? now.getDate() : new Date(y, mo, 0).getDate()
  let count = 0
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(y, mo - 1, d).getDay()
    if (dow === 0) continue
    if (dow === 6 && !includeSaturday) continue
    count++
  }
  return count || 1
}

// Normalisation type 3-3-3
function norm333 (t) {
  if (!t || t === 'Productive' || t === 'Production') return 'Production'
  if (t.includes('Admin') || t.includes('Reporting') || t === 'Non productive') return 'Administration & Reporting'
  if (t.includes('Contr')) return 'Contrôle'
  return 'Production'
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
        blocked: true, minutesLeft: rateCheck.minutesLeft
      })
    }

    const { email: rawEmail, password } = req.body
    const email = sanitizeString(rawEmail || '')

    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })
    if (!validateEmail(email)) return res.status(400).json({ error: 'Format email invalide' })
    if (password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' })

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

    const valid = verifyPassword(password, user.password_hash)
    if (!valid) {
      const result = recordFailedAttempt(ip)
      await run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
        [user.id, 'LOGIN_FAILED', `Tentative de connexion échouée pour ${user.first_name} ${user.last_name}`, ip])

      if (result.blocked) {
        return res.status(429).json({ error: 'Trop de tentatives échouées. Compte bloqué 15 minutes.', blocked: true, minutesLeft: 15 })
      }
      return res.status(401).json({
        error: `Email ou mot de passe incorrect. ${result.remaining} tentative(s) restante(s).`,
        remaining: result.remaining
      })
    }

    // Migrer SHA-256 → PBKDF2 à la volée si nécessaire
    if (!user.password_hash.startsWith('pbkdf2:')) {
      const newHash = hashPassword(password)
      const newEnc  = encryptPassword(password)
      await run('UPDATE users SET password_hash=?, password_encrypted=? WHERE id=?', [newHash, newEnc, user.id])
    }

    resetAttempts(ip)

    // ✅ NOUVEAU: Vérifier si 2FA activé
    if (user.twofa_enabled) {
      // Si 2FA activé, on retourne requires_2fa au lieu du token
      return res.json({
        requires_2fa: true,
        temp_token: signJWT({ id: user.id, email: user.email, temp_2fa: true }, 300), // Token temporaire 5 min
        message: 'Code 2FA requis'
      })
    }

    await run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])
    await run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, 'LOGIN', `Connexion réussie de ${user.first_name} ${user.last_name}`, ip])

    const token = signJWT({
      id: user.id, email: user.email, role: user.role,
      department_id: user.department_id, first_name: user.first_name,
      last_name: user.last_name, department_name: user.department_name,
      works_saturday: user.works_saturday || 0
    })

    return res.json({
      token,
      user: {
        id: user.id, first_name: user.first_name, last_name: user.last_name,
        email: user.email, role: user.role,
        department_id: user.department_id, department_name: user.department_name,
        works_saturday: user.works_saturday || 0
      }
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.get('/api/auth/me', (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  res.json({ user })
})

app.post('/api/auth/logout', async (req, res) => {
  const token = getRawToken(req)
  if (token) await blacklistToken(token)
  res.json({ message: 'Déconnecté avec succès' })
})

// ============================================
// AUTHENTIFICATION À DEUX FACTEURS (2FA TOTP)
// ============================================

// Générer QR code pour configurer 2FA (utilisateur authentifié)
app.post('/api/2fa/setup', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const secret = twofa.generateSecret()
    const otpauthUrl = twofa.generateOtpauthUrl(secret, user.email, 'TimeTrack BGFIBank')
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)
    const backupCodes = twofa.generateBackupCodes()

    // Stocker secret temporairement (non activé tant que non vérifié)
    await run('UPDATE users SET twofa_secret = ?, twofa_backup_codes = ? WHERE id = ?',
      [secret, JSON.stringify(backupCodes), user.id])

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      backupCodes,
      message: 'Scannez le QR code avec votre application d\'authentification (Google Authenticator, Microsoft Authenticator, Authy)'
    })
  } catch (e) {
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  }
})

// Activer 2FA après vérification du code (utilisateur authentifié)
app.post('/api/2fa/enable', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Code TOTP requis' })

    const rows = await query('SELECT twofa_secret FROM users WHERE id = ?', [user.id])
    const secret = rows[0]?.twofa_secret

    if (!secret) return res.status(400).json({ error: 'Aucun secret 2FA configuré. Appelez /api/2fa/setup d\'abord.' })

    const valid = twofa.verifyTOTP(token, secret)
    if (!valid) return res.status(400).json({ error: 'Code TOTP invalide' })

    await run('UPDATE users SET twofa_enabled = 1 WHERE id = ?', [user.id])
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, '2FA_ENABLED', `2FA activé pour ${user.first_name} ${user.last_name}`])

    res.json({ message: '2FA activé avec succès. Conservez vos codes de secours en lieu sûr.' })
  } catch (e) {
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  }
})

// Vérifier code 2FA au login (avec temp_token)
app.post('/api/2fa/verify', async (req, res) => {
  try {
    const { temp_token, code } = req.body
    if (!temp_token || !code) return res.status(400).json({ error: 'temp_token et code requis' })

    const payload = verifyJWT(temp_token)
    if (!payload || !payload.temp_2fa) return res.status(401).json({ error: 'Token temporaire invalide' })

    const rows = await query(
      'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ? AND u.status = "Actif"',
      [payload.id]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' })
    if (!user.twofa_enabled) return res.status(400).json({ error: '2FA non activé' })

    // Vérifier code TOTP
    let validCode = false
    if (twofa.verifyTOTP(code, user.twofa_secret)) {
      validCode = true
    } else {
      // Vérifier codes de secours
      const backupCodes = user.twofa_backup_codes ? JSON.parse(user.twofa_backup_codes) : []
      if (backupCodes.includes(code.toUpperCase())) {
        validCode = true
        // Supprimer le code de secours utilisé
        const newBackupCodes = backupCodes.filter(c => c !== code.toUpperCase())
        await run('UPDATE users SET twofa_backup_codes = ? WHERE id = ?', [JSON.stringify(newBackupCodes), user.id])
      }
    }

    if (!validCode) return res.status(401).json({ error: 'Code 2FA invalide' })

    await run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])
    await run('INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, 'LOGIN_2FA', `Connexion réussie avec 2FA de ${user.first_name} ${user.last_name}`, req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress])

    const token = signJWT({
      id: user.id, email: user.email, role: user.role,
      department_id: user.department_id, first_name: user.first_name,
      last_name: user.last_name, department_name: user.department_name,
      works_saturday: user.works_saturday || 0
    })

    res.json({
      token,
      user: {
        id: user.id, first_name: user.first_name, last_name: user.last_name,
        email: user.email, role: user.role,
        department_id: user.department_id, department_name: user.department_name,
        works_saturday: user.works_saturday || 0
      }
    })
  } catch (e) {
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  }
})

// Désactiver 2FA (utilisateur authentifié + mot de passe)
app.post('/api/2fa/disable', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ error: 'Mot de passe requis pour désactiver 2FA' })

    const rows = await query('SELECT password_hash FROM users WHERE id = ?', [user.id])
    const valid = verifyPassword(password, rows[0]?.password_hash)
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' })

    await run('UPDATE users SET twofa_enabled = 0, twofa_secret = NULL, twofa_backup_codes = NULL WHERE id = ?', [user.id])
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, '2FA_DISABLED', `2FA désactivé pour ${user.first_name} ${user.last_name}`])

    res.json({ message: '2FA désactivé avec succès' })
  } catch (e) {
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  }
})

// Obtenir statut 2FA (utilisateur authentifié)
app.get('/api/2fa/status', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const rows = await query('SELECT twofa_enabled, twofa_backup_codes FROM users WHERE id = ?', [user.id])
    const data = rows[0]
    const backupCodes = data.twofa_backup_codes ? JSON.parse(data.twofa_backup_codes) : []
    res.json({
      enabled: Boolean(data.twofa_enabled),
      backup_codes_remaining: backupCodes.length
    })
  } catch (e) {
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' })
  }
})

app.post('/api/auth/reset-request', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id requis' })
    const rows = await query('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [user_id])
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    const target = rows[0]
    const code = generateResetCode()
    const expiresAt = Date.now() + 30 * 60 * 1000
    resetCodes.set(target.email, { code, expiresAt, userId: target.id })
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [currentUser.id, 'RESET_PASSWORD_REQUEST', `Code de réinitialisation généré pour ${target.first_name} ${target.last_name} (ID ${target.id})`])
    // SÉCURITÉ: Le code ne doit JAMAIS être retourné dans la réponse HTTP
    // Il doit être affiché UNIQUEMENT dans l'interface admin (côté client)
    console.log(`[RESET CODE] ${target.email} → ${code} (expire dans 30 min)`)
    res.json({ 
      message: 'Code généré avec succès', 
      user_name: `${target.first_name} ${target.last_name}`, 
      email: target.email, 
      expires_in_minutes: 30,
      // Le code est retourné UNIQUEMENT pour affichage UI admin (pas de log réseau)
      code  
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.post('/api/auth/reset-confirm', async (req, res) => {
  try {
    const { email, code, new_password } = req.body
    if (!email || !code || !new_password) return res.status(400).json({ error: 'email, code et new_password requis' })
    
    // SÉCURITÉ: Rate-limiting anti brute-force du code
    const rateCheck = checkResetRateLimit(email)
    if (rateCheck.blocked) {
      return res.status(429).json({ 
        error: `Trop de tentatives échouées. Réessayez dans ${rateCheck.minutesLeft} minute(s).` 
      })
    }
    
    if (new_password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' })
    const entry = resetCodes.get(email)
    if (!entry) return res.status(400).json({ error: 'Aucun code en attente pour cet email' })
    if (Date.now() > entry.expiresAt) { 
      resetCodes.delete(email)
      clearResetAttempts(email)
      return res.status(400).json({ error: 'Code expiré' }) 
    }
    if (entry.code !== code.toUpperCase()) {
      recordResetAttempt(email)
      const remaining = MAX_RESET_ATTEMPTS - (resetAttempts.get(email)?.count || 0)
      return res.status(400).json({ 
        error: 'Code incorrect', 
        remaining_attempts: remaining 
      })
    }
    // Code valide → réinitialiser compteur tentatives
    clearResetAttempts(email)
    
    const newHash = hashPassword(new_password)
    const newEnc  = encryptPassword(new_password)
    await run('UPDATE users SET password_hash=?, password_encrypted=?, updated_at=NOW() WHERE id=?', [newHash, newEnc, entry.userId])
    resetCodes.delete(email)
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [entry.userId, 'RESET_PASSWORD_DONE', 'Mot de passe réinitialisé via code temporaire'])
    res.json({ message: 'Mot de passe réinitialisé avec succès' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// NOTIFICATIONS
// ============================================

app.get('/api/notifications', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const since = req.query.since || new Date(Date.now() - 5 * 60 * 1000).toISOString()
    let rows = []
    if (user.role === 'Agent' || user.role === 'Chef de Service') {
      rows = await query(
        `SELECT ws.id, ws.status, ws.rejected_reason, ws.updated_at,
         t.name as task_name, o.name as objective_name,
         CONCAT(uv.first_name, ' ', uv.last_name) as validated_by_name
         FROM work_sessions ws
         JOIN tasks t ON ws.task_id = t.id
         JOIN strategic_objectives o ON ws.objective_id = o.id
         LEFT JOIN users uv ON ws.validated_by = uv.id
         WHERE ws.user_id = ? AND ws.status IN ('Validé','Rejeté') AND ws.updated_at >= ?
         ORDER BY ws.updated_at DESC LIMIT 10`,
        [user.id, since]
      )
    } else if (['Chef de Département', 'Directeur de Département', 'Directeur Général', 'Administrateur'].includes(user.role)) {
      rows = await query(
        `SELECT ws.id, ws.status, ws.updated_at,
         CONCAT(u.first_name, ' ', u.last_name) as agent_name,
         t.name as task_name
         FROM work_sessions ws
         JOIN users u ON ws.user_id = u.id
         JOIN tasks t ON ws.task_id = t.id
         WHERE ws.department_id = ? AND ws.status = 'Terminé' AND ws.updated_at >= ?
         ORDER BY ws.updated_at DESC LIMIT 10`,
        [user.department_id, since]
      )
    }
    res.json(rows)
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// ADMIN - USERS
// ============================================

// ✅ REFACTORÉ: Utilisation du middleware requireRole
app.get('/api/admin/users', requireRole('Administrateur'), async (req, res) => {
  const rows = await query('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id ORDER BY u.created_at DESC')
  res.json(rows.map(r => ({ ...r, password_hash: undefined })))
})

// ✅ REFACTORÉ: Utilisation du middleware requireRole + req.user
app.post('/api/admin/users', requireRole('Administrateur'), async (req, res) => {
  try {
    const { first_name: fn, last_name: ln, email: em, password, role, department_id, status, works_saturday } = req.body
    const first_name = sanitizeString(fn || '')
    const last_name  = sanitizeString(ln || '')
    const email      = sanitizeString(em || '')
    if (!validateEmail(email)) return res.status(400).json({ error: 'Email invalide' })
    if (!password || password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' })
    const passwordHash = hashPassword(password)
    const passwordEnc  = encryptPassword(password)
    const result = await run(
      'INSERT INTO users (first_name, last_name, email, password_hash, password_encrypted, role, department_id, status, works_saturday) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, passwordHash, passwordEnc, role, department_id || null, status || 'Actif', works_saturday ? 1 : 0]
    )
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'CREATE_USER', `Création de l'utilisateur ${first_name} ${last_name}`])
    res.json({ id: result.insertId, message: 'Utilisateur créé avec succès' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.put('/api/admin/users/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const id = req.params.id
    const { first_name, last_name, email, password, role, department_id, status, works_saturday } = req.body
    
    // Empêcher admin de modifier son propre rôle
    if (parseInt(id) === currentUser.id && role !== 'Administrateur') {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
    }
    if (password) {
      const newHash = hashPassword(password)
      const newEnc  = encryptPassword(password)
      await run(
        'UPDATE users SET first_name=?, last_name=?, email=?, password_hash=?, password_encrypted=?, role=?, department_id=?, status=?, works_saturday=?, updated_at=NOW() WHERE id=?',
        [first_name, last_name, email, newHash, newEnc, role, department_id || null, status, works_saturday ? 1 : 0, id]
      )
    } else {
      await run(
        'UPDATE users SET first_name=?, last_name=?, email=?, role=?, department_id=?, status=?, works_saturday=?, updated_at=NOW() WHERE id=?',
        [first_name, last_name, email, role, department_id || null, status, works_saturday ? 1 : 0, id]
      )
    }
    await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
      [currentUser.id, 'UPDATE_USER', `Modification de l'utilisateur ID ${id}`])
    res.json({ message: 'Utilisateur mis à jour' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.get('/api/admin/users/:id/password', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query('SELECT password_encrypted FROM users WHERE id = ?', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  const password = rows[0].password_encrypted ? decryptPassword(rows[0].password_encrypted) : '(mot de passe non disponible)'
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'VIEW_PASSWORD', `Consultation du mot de passe de l'utilisateur ID ${req.params.id}`])
  res.json({ password })
})

app.delete('/api/admin/users/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  
  // Vérifier si c'est un admin et qu'il ne reste qu'un seul admin
  const targetUser = await query('SELECT role FROM users WHERE id = ?', [req.params.id])
  if (!targetUser[0]) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  
  if (targetUser[0].role === 'Administrateur') {
    const adminCount = await query('SELECT COUNT(*) as c FROM users WHERE role = "Administrateur"')
    if (adminCount[0].c <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur' })
    }
  }
  
  await run('DELETE FROM users WHERE id = ?', [req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'DELETE_USER', `Suppression de l'utilisateur ID ${req.params.id}`])
  res.json({ message: 'Utilisateur supprimé' })
})

// ============================================
// ADMIN - DEPARTMENTS
// ============================================

app.get('/api/admin/departments', async (req, res) => {
  res.json(await query('SELECT * FROM departments ORDER BY name'))
})

app.post('/api/admin/departments', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { name, code, description, status } = req.body
    const result = await run('INSERT INTO departments (name, code, description, status) VALUES (?, ?, ?, ?)',
      [name, code, description || '', status || 'Actif'])
    res.json({ id: result.insertId, message: 'Département créé' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.put('/api/admin/departments/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, code, description, status } = req.body
  await run('UPDATE departments SET name=?, code=?, description=?, status=?, updated_at=NOW() WHERE id=?',
    [name, code, description || '', status, req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'UPDATE_DEPT', `Département ID ${req.params.id} mis à jour`])
  res.json({ message: 'Département mis à jour' })
})

app.delete('/api/admin/departments/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  await run('UPDATE departments SET status=?, updated_at=NOW() WHERE id=?', ['Inactif', req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'DELETE_DEPT', `Département ID ${req.params.id} désactivé`])
  res.json({ message: 'Département désactivé' })
})

// ============================================
// ADMIN - OBJECTIVES
// ============================================

app.get('/api/admin/objectives', async (req, res) => {
  res.json(await query('SELECT * FROM strategic_objectives ORDER BY name'))
})

app.post('/api/admin/objectives', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, color, target_percentage, status } = req.body
  const result = await run('INSERT INTO strategic_objectives (name, description, color, target_percentage, status) VALUES (?, ?, ?, ?, ?)',
    [name, description || '', color || '#1e3a5f', target_percentage || 0, status || 'Actif'])
  res.json({ id: result.insertId, message: 'Objectif créé' })
})

app.put('/api/admin/objectives/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, color, target_percentage, status } = req.body
  await run('UPDATE strategic_objectives SET name=?, description=?, color=?, target_percentage=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', color || '#1e3a5f', target_percentage || 0, status, req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'UPDATE_OBJECTIVE', `Objectif ID ${req.params.id} mis à jour`])
  res.json({ message: 'Objectif mis à jour' })
})

app.delete('/api/admin/objectives/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  await run('UPDATE strategic_objectives SET status=?, updated_at=NOW() WHERE id=?', ['Inactif', req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'DELETE_OBJECTIVE', `Objectif ID ${req.params.id} désactivé`])
  res.json({ message: 'Objectif désactivé' })
})

// ============================================
// ADMIN - PROCESSES
// ============================================

app.get('/api/admin/processes', async (req, res) => {
  res.json(await query(
    `SELECT p.*, d.name as department_name, o.name as objective_name, o.color as objective_color
     FROM processes p
     JOIN departments d ON p.department_id = d.id
     JOIN strategic_objectives o ON p.objective_id = o.id
     ORDER BY p.name`
  ))
})

app.post('/api/admin/processes', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, objective_id, status } = req.body
  const result = await run('INSERT INTO processes (name, description, department_id, objective_id, status) VALUES (?, ?, ?, ?, ?)',
    [name, description || '', department_id, objective_id, status || 'Actif'])
  res.json({ id: result.insertId, message: 'Processus créé' })
})

app.put('/api/admin/processes/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, objective_id, status } = req.body
  await run('UPDATE processes SET name=?, description=?, department_id=?, objective_id=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', department_id, objective_id, status, req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'UPDATE_PROCESS', `Processus ID ${req.params.id} mis à jour`])
  res.json({ message: 'Processus mis à jour' })
})

app.delete('/api/admin/processes/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  await run('UPDATE processes SET status=?, updated_at=NOW() WHERE id=?', ['Inactif', req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'DELETE_PROCESS', `Processus ID ${req.params.id} désactivé`])
  res.json({ message: 'Processus désactivé' })
})

// ============================================
// ADMIN - TASKS
// ============================================

app.get('/api/admin/tasks', async (req, res) => {
  res.json(await query(
    `SELECT t.*, d.name as department_name, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t
     JOIN departments d ON t.department_id = d.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON t.objective_id = o.id
     ORDER BY t.name`
  ))
})

app.post('/api/admin/tasks', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, process_id, objective_id, task_type, status } = req.body
  const result = await run(
    'INSERT INTO tasks (name, description, department_id, process_id, objective_id, task_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || '', department_id, process_id, objective_id, task_type || 'Production', status || 'Actif']
  )
  res.json({ id: result.insertId, message: 'Tâche créée' })
})

app.put('/api/admin/tasks/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { name, description, department_id, process_id, objective_id, task_type, status } = req.body
  await run(
    'UPDATE tasks SET name=?, description=?, department_id=?, process_id=?, objective_id=?, task_type=?, status=?, updated_at=NOW() WHERE id=?',
    [name, description || '', department_id, process_id, objective_id, task_type, status, req.params.id]
  )
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'UPDATE_TASK', `Tâche ID ${req.params.id} mise à jour`])
  res.json({ message: 'Tâche mise à jour' })
})

app.delete('/api/admin/tasks/:id', async (req, res) => {
  const currentUser = getUser(req)
  if (!currentUser || currentUser.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  await run('UPDATE tasks SET status=?, updated_at=NOW() WHERE id=?', ['Inactif', req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [currentUser.id, 'DELETE_TASK', `Tâche ID ${req.params.id} désactivée`])
  res.json({ message: 'Tâche désactivée' })
})

// ============================================
// ADMIN - SESSIONS
// ============================================

app.get('/api/admin/sessions', async (req, res) => {
  res.json(await query(
    `SELECT ws.*,
     CONCAT(u.first_name, ' ', u.last_name) as agent_name,
     d.name as department_name, t.name as task_name,
     o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN departments d ON ws.department_id = d.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     ORDER BY ws.created_at DESC LIMIT 200`
  ))
})

// ============================================
// ADMIN - STATS (avec jours ouvrés, 3-3-3, productivité)
// ============================================

app.get('/api/admin/stats', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const rawMonth  = req.query.month  || new Date().toISOString().slice(0, 7)
    const rawMonth2 = req.query.month2 || null
    const month  = validateMonthFormat(rawMonth)  || new Date().toISOString().slice(0, 7)
    const month2 = validateMonthFormat(rawMonth2) || null

    const wdStd  = calcWorkingDays(month, false)
    const wdSat  = calcWorkingDays(month, true)
    const wdStd2 = month2 ? calcWorkingDays(month2, false) : null
    const wdSat2 = month2 ? calcWorkingDays(month2, true)  : null

    const STATUSES = `ws.status IN ('Validé','En attente','En cours')`
    const mf = (m) => `DATE_FORMAT(ws.start_time, '%Y-%m') = '${m}'`

    // Fonction 3-3-3 pour un mois
    async function getRatio333 (m) {
      const ratio333 = await query(
        `SELECT COALESCE(t.task_type,'Production') as type_333,
         COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws LEFT JOIN tasks t ON ws.task_id=t.id
         WHERE ${STATUSES} AND ${mf(m)}
         GROUP BY COALESCE(t.task_type,'Production')`
      )
      const ratio333ByDept = await query(
        `SELECT d.name as dept_name, d.id as dept_id,
         COALESCE(t.task_type,'Production') as type_333,
         COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws
         LEFT JOIN tasks t ON ws.task_id=t.id
         LEFT JOIN departments d ON ws.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)}
         GROUP BY d.id, d.name, COALESCE(t.task_type,'Production') ORDER BY d.name`
      )
      const ratio333ByAgent = await query(
        `SELECT CONCAT(u.first_name,' ',u.last_name) as agent_name, u.id as agent_id,
         d.name as dept_name, u.works_saturday,
         COALESCE(t.task_type,'Production') as type_333,
         COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws
         LEFT JOIN tasks t ON ws.task_id=t.id
         LEFT JOIN users u ON ws.user_id=u.id
         LEFT JOIN departments d ON u.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)}
         GROUP BY u.id, d.name, u.works_saturday, COALESCE(t.task_type,'Production') ORDER BY d.name, u.last_name`
      )
      const deptCapacity = await query(
        `SELECT d.id as dept_id, d.name as dept_name,
         COUNT(u.id) as agent_count,
         SUM(CASE WHEN u.works_saturday=1 THEN 1 ELSE 0 END) as agents_with_saturday,
         SUM(CASE WHEN u.works_saturday=0 THEN 1 ELSE 0 END) as agents_without_saturday
         FROM departments d
         LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif' AND u.role IN ('Agent','Chef de Service')
         WHERE d.status='Actif' GROUP BY d.id, d.name`
      )
      return { ratio333, ratio333ByDept, ratio333ByAgent, deptCapacity }
    }

    function build333Result (raw) {
      const map = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
      raw.forEach(r => { const k = norm333(r.type_333); map[k] = (map[k] || 0) + Number(r.total_minutes) })
      const total = Object.values(map).reduce((s, v) => s + v, 0)
      return Object.entries(map).map(([label, minutes]) => ({
        label, minutes, hours_display: minutesToHours(minutes),
        percentage: total > 0 ? Math.round(minutes * 100 / total) : 0
      }))
    }

    function buildDeptComparison (raw, caps, wStd, wSat) {
      const depts = {}
      raw.forEach(r => {
        if (!depts[r.dept_name]) {
          const cap = caps.find(ci => ci.dept_name === r.dept_name)
          const agSat   = Number(cap?.agents_with_saturday || 0)
          const agNoSat = Number(cap?.agents_without_saturday || 0)
          const capacity = (agSat * wSat + agNoSat * wStd) * 480
          depts[r.dept_name] = {
            dept_name: r.dept_name, agent_count: cap?.agent_count || 0,
            agents_with_saturday: agSat, agents_without_saturday: agNoSat,
            capacity_minutes: capacity, Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        depts[r.dept_name][norm333(r.type_333)] += Number(r.total_minutes)
      })
      return Object.values(depts).map(d => {
        const tot = d.Production + d['Administration & Reporting'] + d['Contrôle']
        const pct = d.capacity_minutes > 0 ? Math.round(tot * 100 / d.capacity_minutes) : 0
        return { ...d, total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(d.capacity_minutes) }
      })
    }

    function buildAgentComparison (raw, wStd, wSat) {
      const agents = {}
      raw.forEach(r => {
        if (!agents[r.agent_id]) {
          const wd = r.works_saturday ? wSat : wStd
          agents[r.agent_id] = {
            agent_name: r.agent_name, dept_name: r.dept_name,
            works_saturday: r.works_saturday || 0,
            capacity_minutes: wd * 480, working_days: wd,
            Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        agents[r.agent_id][norm333(r.type_333)] += Number(r.total_minutes)
      })
      return Object.values(agents).map(a => {
        const tot = a.Production + a['Administration & Reporting'] + a['Contrôle']
        const pct = a.capacity_minutes > 0 ? Math.round(tot * 100 / a.capacity_minutes) : 0
        return { ...a, total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(a.capacity_minutes) }
      })
    }

    const r1 = await getRatio333(month)
    const ratio333Result = build333Result(r1.ratio333)
    const deptComparison  = buildDeptComparison(r1.ratio333ByDept, r1.deptCapacity, wdStd, wdSat)
    const agentComparison = buildAgentComparison(r1.ratio333ByAgent, wdStd, wdSat)

    let ratio333Month2 = null, deptComparisonMonth2 = null, agentComparisonMonth2 = null
    if (month2 && wdStd2 && wdSat2) {
      const r2 = await getRatio333(month2)
      ratio333Month2       = build333Result(r2.ratio333)
      deptComparisonMonth2  = buildDeptComparison(r2.ratio333ByDept, r2.deptCapacity, wdStd2, wdSat2)
      agentComparisonMonth2 = buildAgentComparison(r2.ratio333ByAgent, wdStd2, wdSat2)
    }

    const hoursByObjective = await query(
      `SELECT o.name, o.color, o.target_percentage,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM strategic_objectives o
       LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ${STATUSES} AND ${mf(month)}
       WHERE o.status='Actif' GROUP BY o.id, o.name, o.color, o.target_percentage ORDER BY total_minutes DESC`
    )
    const hoursByDept = await query(
      `SELECT d.name, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM departments d
       LEFT JOIN work_sessions ws ON ws.department_id=d.id AND ${STATUSES} AND ${mf(month)}
       GROUP BY d.id, d.name HAVING total_minutes>0 ORDER BY total_minutes DESC`
    )
    const monthlyTrend = await query(
      `SELECT DATE_FORMAT(ws.start_time,'%Y-%m') as month, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws WHERE ${STATUSES}
       GROUP BY DATE_FORMAT(ws.start_time,'%Y-%m') ORDER BY month DESC LIMIT 6`
    )
    const totalAgentsRow = await query(`SELECT COUNT(*) as count FROM users WHERE role IN ('Agent','Chef de Service') AND status='Actif'`)
    const totalAgents = totalAgentsRow[0]?.count || 0

    const todayDow = new Date().getDay()
    const isWeekend = todayDow === 0 || todayDow === 6
    const capacityPerAgent = isWeekend ? 0 : 480
    const totalCapacityToday = totalAgents * capacityPerAgent

    const productivityToday = await query(
      `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) as agent_name, d.name as department_name,
       COALESCE(SUM(CASE WHEN ws.status='Validé'     THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes,
       COALESCE(SUM(CASE WHEN ws.status='En attente' THEN ws.duration_minutes ELSE 0 END),0) as pending_minutes,
       COALESCE(SUM(CASE WHEN ws.status='En cours'   THEN ws.duration_minutes ELSE 0 END),0) as inprogress_minutes
       FROM users u
       LEFT JOIN departments d ON u.department_id=d.id
       LEFT JOIN work_sessions ws ON ws.user_id=u.id AND DATE(ws.start_time)=CURDATE() AND ws.status IN ('Validé','En attente','En cours')
       WHERE u.role IN ('Agent','Chef de Service') AND u.status='Actif'
       GROUP BY u.id, u.first_name, u.last_name, d.name`
    )

    const agentsTodayMapped = productivityToday.map(a => {
      const total_pointed = Math.min(a.validated_minutes + a.pending_minutes + a.inprogress_minutes, capacityPerAgent || 480)
      const non_pointed   = capacityPerAgent > 0 ? Math.max(capacityPerAgent - (a.validated_minutes + a.pending_minutes + a.inprogress_minutes), 0) : 0
      return {
        ...a, total_pointed, non_pointed,
        validated_hours:   minutesToHours(a.validated_minutes),
        pending_hours:     minutesToHours(a.pending_minutes),
        inprogress_hours:  minutesToHours(a.inprogress_minutes),
        non_pointed_hours: minutesToHours(non_pointed),
        productive_minutes: total_pointed, non_productive_minutes: non_pointed,
        productive_pct: capacityPerAgent > 0 ? Math.round((total_pointed / capacityPerAgent) * 100) : 0,
        is_weekend: isWeekend
      }
    })

    const totalPointedToday    = agentsTodayMapped.reduce((s, a) => s + a.total_pointed, 0)
    const totalNonPointedToday = agentsTodayMapped.reduce((s, a) => s + a.non_pointed, 0)
    const totalValidatedToday  = agentsTodayMapped.reduce((s, a) => s + Math.min(a.validated_minutes, capacityPerAgent || 480), 0)
    const totalPendingToday    = agentsTodayMapped.reduce((s, a) => s + Math.min(a.pending_minutes, capacityPerAgent || 480), 0)

    const objTotal = hoursByObjective.reduce((s, o) => s + Number(o.total_minutes), 0)

    res.json({
      month, month2: month2 || null,
      working_days: wdStd, working_days_month2: wdStd2,
      hoursByObjective: hoursByObjective.map(o => ({
        ...o, total_minutes: Number(o.total_minutes),
        percentage: objTotal > 0 ? Math.round(Number(o.total_minutes) * 100 / objTotal) : 0,
        hours_display: minutesToHours(Number(o.total_minutes))
      })),
      hoursByDept, monthlyTrend,
      ratio333: ratio333Result, ratio333Month2,
      deptComparison, deptComparisonMonth2,
      agentComparison, agentComparisonMonth2,
      is_weekend: isWeekend,
      productivity: {
        total_agents: totalAgents, total_capacity_today: totalCapacityToday,
        is_weekend: isWeekend,
        validated_minutes_today: totalValidatedToday, validated_hours_today: minutesToHours(totalValidatedToday),
        validated_pct: totalCapacityToday > 0 ? Math.round(totalValidatedToday / totalCapacityToday * 100) : 0,
        pending_minutes_today: totalPendingToday, pending_hours_today: minutesToHours(totalPendingToday),
        productive_minutes_today: totalPointedToday, non_productive_minutes_today: totalNonPointedToday,
        productive_hours_today: minutesToHours(totalPointedToday), non_productive_hours_today: minutesToHours(totalNonPointedToday),
        productive_pct:     totalCapacityToday > 0 ? Math.round(totalPointedToday    / totalCapacityToday * 100) : 0,
        non_productive_pct: totalCapacityToday > 0 ? Math.round(totalNonPointedToday / totalCapacityToday * 100) : 0,
        agents_detail: agentsTodayMapped
      }
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// ADMIN - RAPPORTS & EXPORT CSV ENRICHI
// ============================================

app.get('/api/admin/reports', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { date_from, date_to, dept_id, status: statusFilter, export: exportType } = req.query
  let sql = `SELECT ws.*,
     CONCAT(u.first_name,' ',u.last_name) as agent_name, d.name as department_name,
     t.name as task_name, p.name as process_name, t.task_type,
     o.name as objective_name, o.color as objective_color, ws.rejected_reason
     FROM work_sessions ws
     JOIN users u ON ws.user_id=u.id JOIN departments d ON ws.department_id=d.id
     JOIN tasks t ON ws.task_id=t.id JOIN processes p ON t.process_id=p.id
     JOIN strategic_objectives o ON ws.objective_id=o.id WHERE 1=1`
  const params = []
  if (date_from)    { sql += ' AND DATE(ws.start_time) >= ?'; params.push(date_from) }
  if (date_to)      { sql += ' AND DATE(ws.start_time) <= ?'; params.push(date_to) }
  if (dept_id)      { sql += ' AND ws.department_id = ?';     params.push(dept_id) }
  if (statusFilter) { sql += ' AND ws.status = ?';            params.push(statusFilter) }
  sql += ' ORDER BY ws.start_time DESC'
  const rows = await query(sql, params)

  if (exportType === 'csv') {
    // Calcul des pourcentages 3-3-3 par agent/mois
    const agentMonthMap = {}
    for (const r of rows) {
      if (r.status !== 'Validé') continue
      const key = `${r.agent_name}|${(r.start_time ? new Date(r.start_time).toISOString() : '').slice(0, 7)}`
      if (!agentMonthMap[key]) agentMonthMap[key] = { prod: 0, admin: 0, ctrl: 0, total: 0 }
      const cat = norm333(r.task_type)
      const dur = Number(r.duration_minutes || 0)
      agentMonthMap[key].total += dur
      if (cat === 'Production') agentMonthMap[key].prod += dur
      else if (cat === 'Administration & Reporting') agentMonthMap[key].admin += dur
      else if (cat === 'Contrôle') agentMonthMap[key].ctrl += dur
    }
    const pct = (num, den) => den > 0 ? (num / den * 100).toFixed(1) + '%' : '0%'
    const hhmm = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h}h ${String(m).padStart(2, '0')}m` }

    const header = 'Agent,Département,Tâche,Processus,Objectif,Date début,Date fin,Durée (min),Heures (hh:mm),Heures (décimal),Catégorie 3-3-3,Mois,Journée,Type,Statut,Motif rejet,% Productif (mois),% Admin-Reporting (mois),% Contrôle (mois),% Non productif (mois),Temps reporting (mois hh:mm)\n'
    const csvRows = rows.map(r => {
      const dur  = Number(r.duration_minutes || 0)
      const cat  = norm333(r.task_type)
      const st   = r.start_time ? new Date(r.start_time).toISOString() : ''
      const mois = st.slice(0, 7)
      const jour = st.slice(0, 10)
      const key  = `${r.agent_name}|${mois}`
      const am   = agentMonthMap[key] || { prod: 0, admin: 0, ctrl: 0, total: 0 }
      const np   = Math.max(0, am.total - am.prod - am.admin - am.ctrl)
      return [
        `"${r.agent_name || ''}"`, `"${r.department_name || ''}"`, `"${r.task_name || ''}"`,
        `"${r.process_name || ''}"`, `"${r.objective_name || ''}"`,
        r.start_time ? new Date(r.start_time).toLocaleString('fr-FR') : '',
        r.end_time   ? new Date(r.end_time).toLocaleString('fr-FR')   : '',
        dur, hhmm(dur), (dur / 60).toFixed(2), cat, mois, jour,
        r.session_type || '', r.status || '',
        `"${(r.rejected_reason || '').replace(/"/g, '""')}"`,
        pct(am.prod, am.total), pct(am.admin, am.total), pct(am.ctrl, am.total),
        pct(np, am.total), hhmm(am.admin + am.ctrl)
      ].join(',')
    }).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="rapport_admin_${new Date().toISOString().split('T')[0]}.csv"`)
    return res.send('\uFEFF' + header + csvRows)
  }
  res.json(rows)
})

app.get('/api/admin/audit', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Administrateur') return res.status(401).json({ error: 'Non autorisé' })
  const { date_from, date_to, action: actionFilter, export: exportType } = req.query
  let sql = `SELECT al.*, CONCAT(u.first_name,' ',u.last_name) as user_name
     FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id WHERE 1=1`
  const params = []
  if (date_from)    { sql += ' AND DATE(al.created_at) >= ?'; params.push(date_from) }
  if (date_to)      { sql += ' AND DATE(al.created_at) <= ?'; params.push(date_to) }
  if (actionFilter) { sql += ' AND al.action LIKE ?';         params.push(`%${actionFilter}%`) }
  sql += ' ORDER BY al.created_at DESC LIMIT 500'
  const rows = await query(sql, params)
  if (exportType === 'csv') {
    const header = 'ID,Utilisateur,Action,Détails,IP,Date\n'
    const csvRows = rows.map(r => [
      r.id, `"${r.user_name || 'Système'}"`, r.action,
      `"${(r.details || '').replace(/"/g, "'")}"`,
      r.ip_address || '',
      r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : ''
    ].join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="audit_${new Date().toISOString().split('T')[0]}.csv"`)
    return res.send('\uFEFF' + header + csvRows)
  }
  res.json(rows)
})

// ============================================
// AGENT - DASHBOARD
// ============================================

app.get('/api/agent/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const today = new Date().toISOString().split('T')[0]
  const todayStats = await query(`SELECT COALESCE(SUM(duration_minutes),0) as today_minutes FROM work_sessions WHERE user_id=? AND DATE(start_time)=? AND status IN ('Validé','Terminé')`, [user.id, today])
  const totalStats = await query(`SELECT COALESCE(SUM(duration_minutes),0) as total_minutes FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`, [user.id])
  const sessionStats = await query(`SELECT COUNT(*) as total, SUM(CASE WHEN status='Rejeté' THEN 1 ELSE 0 END) as rejected FROM work_sessions WHERE user_id=?`, [user.id])
  const byObjective = await query(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.user_id=? AND ws.status IN ('Validé','Terminé')
     WHERE o.status='Actif' GROUP BY o.id, o.name, o.color HAVING total_minutes>0 ORDER BY total_minutes DESC`,
    [user.id]
  )
  const totalMin = byObjective.reduce((s, o) => s + Number(o.total_minutes), 0)
  res.json({
    today_minutes: Number(todayStats[0]?.today_minutes || 0),
    today_hours:   minutesToHours(Number(todayStats[0]?.today_minutes || 0)),
    total_minutes: Number(totalStats[0]?.total_minutes || 0),
    total_hours:   minutesToHours(Number(totalStats[0]?.total_minutes || 0)),
    total_sessions:    Number(sessionStats[0]?.total    || 0),
    rejected_sessions: Number(sessionStats[0]?.rejected || 0),
    byObjective: byObjective.map(o => ({
      ...o, total_minutes: Number(o.total_minutes),
      percentage:   totalMin > 0 ? Math.round(Number(o.total_minutes) * 100 / totalMin) : 0,
      hours_display: minutesToHours(Number(o.total_minutes))
    }))
  })
})

// ============================================
// AGENT - TÂCHES
// ============================================

app.get('/api/agent/tasks', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  res.json(await query(
    `SELECT t.*, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t JOIN processes p ON t.process_id=p.id JOIN strategic_objectives o ON t.objective_id=o.id
     WHERE t.department_id=? AND t.status='Actif' ORDER BY o.name, t.name`,
    [user.department_id]
  ))
})

// ============================================
// AGENT - SESSIONS
// ============================================

app.get('/api/agent/sessions', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  res.json(await query(
    `SELECT ws.*, t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.user_id=? ORDER BY ws.start_time DESC`,
    [user.id]
  ))
})

app.get('/api/agent/sessions/active', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT ws.*, t.name as task_name, o.name as objective_name
     FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.user_id=? AND ws.status='En cours' LIMIT 1`,
    [user.id]
  )
  res.json(rows[0] || null)
})

app.post('/api/agent/sessions/start', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { task_id } = req.body
    // Vérifier plafond 8h aujourd'hui
    const todayTotal = await query(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND DATE(start_time)=CURDATE() AND status IN ('Validé','Terminé','En cours')`,
      [user.id]
    )
    if (Number(todayTotal[0]?.m || 0) >= 480) return res.status(400).json({ error: 'Plafond journalier de 8h atteint' })

    const active = await query('SELECT id FROM work_sessions WHERE user_id=? AND status="En cours"', [user.id])
    if (active.length > 0) return res.status(400).json({ error: 'Une session est déjà en cours' })

    // Vérifier si samedi autorisé
    const todayDow = new Date().getDay()
    if (todayDow === 0) return res.status(400).json({ error: 'Pas de pointage le dimanche' })
    if (todayDow === 6 && !user.works_saturday) return res.status(400).json({ error: 'Vous n\'êtes pas autorisé à travailler le samedi' })

    const task = await query('SELECT * FROM tasks WHERE id=?', [task_id])
    if (!task[0]) return res.status(404).json({ error: 'Tâche non trouvée' })
    const result = await run(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, session_type, status) VALUES (?,?,?,?,NOW(),"Auto","En cours")',
      [user.id, task_id, task[0].objective_id, user.department_id]
    )
    res.json({ id: result.insertId, message: 'Session démarrée' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.post('/api/agent/sessions/stop', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { comment } = req.body || {}
    const active = await query('SELECT * FROM work_sessions WHERE user_id=? AND status="En cours"', [user.id])
    if (!active[0]) return res.status(400).json({ error: 'Aucune session en cours' })
    const durationMinutes = Math.min(Math.round((Date.now() - new Date(active[0].start_time).getTime()) / 60000), 480)
    await run('UPDATE work_sessions SET end_time=NOW(), duration_minutes=?, status="Terminé", comment=?, updated_at=NOW() WHERE id=?',
      [durationMinutes, comment || null, active[0].id])
    res.json({ message: 'Session arrêtée', duration_minutes: durationMinutes })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.post('/api/agent/sessions/manual', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { task_id, start_time, end_time, comment } = req.body
    const task = await query('SELECT * FROM tasks WHERE id=?', [task_id])
    if (!task[0]) return res.status(404).json({ error: 'Tâche non trouvée' })
    
    // SÉCURITÉ: Validation dates (anti-fraude)
    const now = Date.now()
    const startMs = new Date(start_time).getTime()
    const endMs = new Date(end_time).getTime()
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000)
    
    if (startMs > now || endMs > now) {
      return res.status(400).json({ error: 'Les dates ne peuvent pas être dans le futur' })
    }
    if (startMs < ninetyDaysAgo) {
      return res.status(400).json({ error: 'Les sessions de plus de 90 jours ne peuvent pas être créées' })
    }
    
    let durationMinutes = Math.round((endMs - startMs) / 60000)
    if (durationMinutes <= 0) return res.status(400).json({ error: 'La date de fin doit être après la date de début' })
    durationMinutes = Math.min(durationMinutes, 480)
    const result = await run(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, end_time, duration_minutes, session_type, status, comment) VALUES (?,?,?,?,?,?,?,"Manuelle","Terminé",?)',
      [user.id, task_id, task[0].objective_id, user.department_id, start_time, end_time, durationMinutes, comment || '']
    )
    res.json({ id: result.insertId, message: 'Session enregistrée' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// AGENT - STATS
// ============================================

app.get('/api/agent/stats', async (req, res) => {
  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })
  const today = new Date().toISOString().split('T')[0]
  const todayMin     = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND DATE(start_time)=? AND status IN ('Validé','Terminé')`, [user.id, today])
  const totalMin     = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`, [user.id])
  const validatedMin = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND status='Validé'`, [user.id])
  const totalSess    = await query(`SELECT COUNT(*) as c FROM work_sessions WHERE user_id=?`, [user.id])
  const byObjective  = await query(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes),0) as total_minutes, COUNT(ws.id) as session_count
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.user_id=? AND ws.status IN ('Validé','Terminé')
     WHERE o.status='Actif' GROUP BY o.id, o.name, o.color ORDER BY total_minutes DESC`,
    [user.id]
  )
  const totalM = byObjective.reduce((s, o) => s + Number(o.total_minutes), 0)
  res.json({
    today_hours:     minutesToHours(Number(todayMin[0]?.m || 0)),
    total_hours:     minutesToHours(Number(totalMin[0]?.m || 0)),
    validated_hours: minutesToHours(Number(validatedMin[0]?.m || 0)),
    total_sessions:  Number(totalSess[0]?.c || 0),
    byObjective: byObjective.map(o => ({
      ...o, total_minutes: Number(o.total_minutes),
      percentage: totalM > 0 ? Math.round(Number(o.total_minutes) * 100 / totalM) : 0,
      hours_display: minutesToHours(Number(o.total_minutes))
    }))
  })
})

// ============================================
// CHEF DE DÉPARTEMENT - DASHBOARD (complet avec 3-3-3 + cumul)
// ============================================

app.get('/api/chef/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const deptId = user.department_id
  const rawMonth  = req.query.month  || new Date().toISOString().slice(0, 7)
  const rawMonth2 = req.query.month2 || null
  const month  = validateMonthFormat(rawMonth)  || new Date().toISOString().slice(0, 7)
  const month2 = validateMonthFormat(rawMonth2) || null
  const CIBLES = { 'Production': 70, 'Administration & Reporting': 20, 'Contrôle': 10 }

  const activeAgents = await query(`SELECT COUNT(DISTINCT user_id) as count FROM work_sessions WHERE department_id=? AND DATE(start_time)=CURDATE()`, [deptId])
  const totalTeamHours = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE department_id=? AND DATE_FORMAT(start_time,'%Y-%m')=? AND status IN ('Validé','Terminé')`, [deptId, month])
  const toValidate = await query(`SELECT COUNT(*) as c FROM work_sessions WHERE department_id=? AND status='Terminé'`, [deptId])

  const hoursByAgent = await query(
    `SELECT CONCAT(u.first_name,' ',u.last_name) as agent_name, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
     FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id AND ws.status IN ('Validé','Terminé') AND DATE_FORMAT(ws.start_time,'%Y-%m')=?
     WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif' GROUP BY u.id, u.first_name, u.last_name`,
    [month, deptId]
  )

  const agentDetail = await query(
    `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) as agent_name,
     COUNT(ws.id) as total_sessions,
     COALESCE(SUM(ws.duration_minutes),0) as total_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END)*100.0/NULLIF(SUM(ws.duration_minutes),0),0) as pct_validated
     FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id AND DATE_FORMAT(ws.start_time,'%Y-%m')=?
     WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif'
     GROUP BY u.id, u.first_name, u.last_name`,
    [month, deptId]
  )

  const todayDow = new Date().getDay()
  const isWeekend = todayDow === 0 || todayDow === 6
  const capPerAgent = isWeekend ? 0 : 480

  const agentProductivityToday = await query(
    `SELECT u.id,
     COALESCE(SUM(CASE WHEN ws.status='Validé'     THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes_today,
     COALESCE(SUM(CASE WHEN ws.status='En attente' THEN ws.duration_minutes ELSE 0 END),0) as pending_minutes_today,
     COALESCE(SUM(CASE WHEN ws.status='En cours'   THEN ws.duration_minutes ELSE 0 END),0) as inprogress_minutes_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id=u.id AND DATE(ws.start_time)=CURDATE() AND ws.status IN ('Validé','En attente','En cours')
     WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif' GROUP BY u.id`,
    [deptId]
  )
  const prodMap = {}
  agentProductivityToday.forEach(p => { prodMap[p.id] = p })

  // 3-3-3 pour un mois donné
  async function get333ForMonth (m) {
    const raw = await query(
      `SELECT CONCAT(u.first_name,' ',u.last_name) as agent_name, u.id as agent_id,
       COALESCE(t.task_type,'Production') as type_333,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws
       LEFT JOIN tasks t ON ws.task_id=t.id LEFT JOIN users u ON ws.user_id=u.id
       WHERE ws.department_id=? AND ws.status IN ('Validé','En attente','En cours')
         AND DATE_FORMAT(ws.start_time,'%Y-%m')=?
       GROUP BY u.id, u.first_name, u.last_name, COALESCE(t.task_type,'Production')`,
      [deptId, m]
    )
    const agentMap = {}
    raw.forEach(r => {
      if (!agentMap[r.agent_id]) agentMap[r.agent_id] = { agent_name: r.agent_name, Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
      agentMap[r.agent_id][norm333(r.type_333)] += Number(r.total_minutes)
    })
    const agentRows = Object.values(agentMap).map(a => {
      const total = a.Production + a['Administration & Reporting'] + a['Contrôle']
      return { ...a, total_minutes: total, hours_display: minutesToHours(total) }
    })
    const globalMap = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
    raw.forEach(r => { globalMap[norm333(r.type_333)] += Number(r.total_minutes) })
    const globalTotal = Object.values(globalMap).reduce((s, v) => s + v, 0)
    const global333 = Object.entries(globalMap).map(([label, minutes]) => ({
      label, minutes, hours_display: minutesToHours(minutes),
      percentage: globalTotal > 0 ? Math.round(minutes * 100 / globalTotal) : 0,
      cible: CIBLES[label] || 0,
      ecart: (globalTotal > 0 ? Math.round(minutes * 100 / globalTotal) : 0) - (CIBLES[label] || 0)
    }))
    return { global333, agentRows }
  }

  const r333Main  = await get333ForMonth(month)
  const r333M2    = month2 ? await get333ForMonth(month2) : null

  // Cumul 6 mois par agent
  const last6 = await query(
    `SELECT DISTINCT DATE_FORMAT(start_time,'%Y-%m') as m FROM work_sessions WHERE status IN ('Validé','Terminé') AND department_id=? ORDER BY m DESC LIMIT 6`,
    [deptId]
  )
  const cumulMonths = last6.map(r => r.m)
  let cumulAgentComparison = []
  if (cumulMonths.length > 0) {
    const placeholders = cumulMonths.map(() => '?').join(',')
    const cumulRaw = await query(
      `SELECT ws.user_id as agent_id, CONCAT(u.first_name,' ',u.last_name) as agent_name,
       u.works_saturday, DATE_FORMAT(ws.start_time,'%Y-%m') as month,
       COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN users u ON ws.user_id=u.id
       WHERE ws.department_id=? AND ws.status IN ('Validé','Terminé') AND DATE_FORMAT(ws.start_time,'%Y-%m') IN (${placeholders})
       GROUP BY ws.user_id, DATE_FORMAT(ws.start_time,'%Y-%m'), t.task_type`,
      [deptId, ...cumulMonths]
    )
    const aMap = {}
    cumulRaw.forEach(r => {
      if (!aMap[r.agent_id]) aMap[r.agent_id] = {
        agent_id: r.agent_id, agent_name: r.agent_name, works_saturday: r.works_saturday || 0,
        months_included: new Set(), Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
      }
      aMap[r.agent_id][norm333(r.type_333)] += Number(r.total_minutes)
      aMap[r.agent_id].months_included.add(r.month)
    })
    cumulAgentComparison = Object.values(aMap).map(a => {
      const nbM = a.months_included.size || 1
      const wd  = a.works_saturday ? 26 : 22
      const cap = wd * 480 * nbM
      const tot = a.Production + a['Administration & Reporting'] + a['Contrôle']
      const pct = cap > 0 ? Math.round(tot * 100 / cap) : 0
      return {
        agent_id: a.agent_id, agent_name: a.agent_name, works_saturday: a.works_saturday,
        capacity_minutes: cap, Production: a.Production,
        'Administration & Reporting': a['Administration & Reporting'], 'Contrôle': a['Contrôle'],
        total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
        hours_display: minutesToHours(tot), months_count: nbM
      }
    }).sort((a, b) => b.total_minutes - a.total_minutes)
  }

  const nbAgents = agentDetail.length
  const prodMap2 = {}
  agentProductivityToday.forEach(p => { prodMap2[p.id] = p })
  const totalValidatedTeam  = agentProductivityToday.reduce((s, a) => s + Math.min(a.validated_minutes_today, capPerAgent || 480), 0)
  const totalPendingTeam    = agentProductivityToday.reduce((s, a) => s + Math.min(a.pending_minutes_today, capPerAgent || 480), 0)
  const totalInprogressTeam = agentProductivityToday.reduce((s, a) => s + Math.min(a.inprogress_minutes_today, capPerAgent || 480), 0)
  const totalPointedTeam    = Math.min(totalValidatedTeam + totalPendingTeam + totalInprogressTeam, nbAgents * (capPerAgent || 480))
  const totalNonPointedTeam = capPerAgent > 0 ? Math.max(nbAgents * capPerAgent - totalPointedTeam, 0) : 0

  res.json({
    month, month2: month2 || null,
    active_agents: Number(activeAgents[0]?.count || 0),
    total_team_hours: minutesToHours(Number(totalTeamHours[0]?.m || 0)),
    to_validate: Number(toValidate[0]?.c || 0),
    is_weekend: isWeekend,
    hoursByAgent,
    byObjective: [],
    ratio333: r333Main.global333,
    ratio333Month2: r333M2 ? r333M2.global333 : null,
    agentComparison: r333Main.agentRows,
    agentComparisonMonth2: r333M2 ? r333M2.agentRows : null,
    cumulAgentComparison, cumulMonths,
    agentDetail: agentDetail.map(a => {
      const p   = prodMap2[a.id] || { validated_minutes_today: 0, pending_minutes_today: 0, inprogress_minutes_today: 0 }
      const cap = capPerAgent || 480
      const total_pointed = Math.min(p.validated_minutes_today + p.pending_minutes_today + p.inprogress_minutes_today, cap)
      const non_pointed   = capPerAgent > 0 ? Math.max(cap - total_pointed, 0) : 0
      return {
        ...a, total_minutes: Number(a.total_minutes),
        total_hours: minutesToHours(Number(a.total_minutes)),
        validated_hours: minutesToHours(Number(a.validated_minutes)),
        validated_minutes_today: Math.min(p.validated_minutes_today, cap),
        pending_minutes_today: Math.min(p.pending_minutes_today, cap),
        inprogress_minutes_today: Math.min(p.inprogress_minutes_today, cap),
        non_pointed_today: non_pointed,
        productive_minutes_today: total_pointed, non_productive_minutes_today: non_pointed,
        productive_pct_today: cap > 0 ? Math.round(total_pointed / cap * 100) : 0,
        is_weekend: isWeekend
      }
    }),
    team_productivity: {
      total_agents: nbAgents, is_weekend: isWeekend,
      validated_hours_today: minutesToHours(totalValidatedTeam),
      productive_hours_today: minutesToHours(totalPointedTeam),
      non_productive_hours_today: minutesToHours(totalNonPointedTeam),
      productive_pct:     nbAgents > 0 && capPerAgent > 0 ? Math.round(totalPointedTeam    / (nbAgents * capPerAgent) * 100) : 0,
      non_productive_pct: nbAgents > 0 && capPerAgent > 0 ? Math.round(totalNonPointedTeam / (nbAgents * capPerAgent) * 100) : 0
    }
  })
})

// ============================================
// CHEF - LIVE (statut temps réel des agents)
// ============================================

app.get('/api/chef/live', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const deptId = user.department_id
  const todayDow = new Date().getDay()
  const isWeekend = todayDow === 0 || todayDow === 6

  const liveData = await query(
    `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) as agent_name, u.works_saturday,
     MAX(CASE WHEN ws.status='En cours' THEN 1 ELSE 0 END) as is_active_now,
     MAX(CASE WHEN ws.status='En cours' THEN t.name ELSE NULL END) as current_task,
     MAX(CASE WHEN ws.status='En cours' THEN t.task_type ELSE NULL END) as current_task_type,
     MAX(CASE WHEN ws.status='En cours' THEN ws.start_time ELSE NULL END) as session_start,
     COALESCE(SUM(CASE WHEN ws.status='Validé'     THEN ws.duration_minutes ELSE 0 END),0) as validated_min,
     COALESCE(SUM(CASE WHEN ws.status='En attente' THEN ws.duration_minutes ELSE 0 END),0) as pending_min,
     COALESCE(SUM(CASE WHEN ws.status='En cours'   THEN ws.duration_minutes ELSE 0 END),0) as inprogress_min,
     COUNT(CASE WHEN ws.status IN ('Validé','En attente','Terminé') THEN 1 END) as sessions_done_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id=u.id AND DATE(ws.start_time)=CURDATE() AND ws.status IN ('Validé','En attente','En cours','Terminé')
     LEFT JOIN tasks t ON ws.task_id=t.id
     WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif'
     GROUP BY u.id, u.first_name, u.last_name, u.works_saturday ORDER BY u.last_name`,
    [deptId]
  )

  const agents = liveData.map(a => {
    const totalPointed = Number(a.validated_min) + Number(a.pending_min) + Number(a.inprogress_min)
    const cap = isWeekend ? 0 : 480
    const nonPointed = cap > 0 ? Math.max(cap - totalPointed, 0) : 0
    const pct = cap > 0 ? Math.round(totalPointed * 100 / cap) : 0
    let liveStatus = 'not_started'
    if (isWeekend) liveStatus = 'weekend'
    else if (a.is_active_now) liveStatus = 'working'
    else if (totalPointed > 0) liveStatus = 'paused'
    return {
      ...a,
      live_status: liveStatus, total_pointed_min: totalPointed,
      total_pointed_hours: minutesToHours(totalPointed),
      non_pointed_min: nonPointed, non_pointed_hours: minutesToHours(nonPointed),
      productive_pct: pct, capacity_min: cap
    }
  })

  const summary = {
    total: agents.length,
    working_now: agents.filter(a => a.live_status === 'working').length,
    paused:      agents.filter(a => a.live_status === 'paused').length,
    not_started: agents.filter(a => a.live_status === 'not_started').length,
    is_weekend: isWeekend
  }

  res.json({ agents, summary, is_weekend: isWeekend })
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
     COALESCE(SUM(CASE WHEN DATE(ws.start_time)=? THEN 1 ELSE 0 END),0) as today_sessions,
     COALESCE(SUM(CASE WHEN DATE(ws.start_time)=? THEN ws.duration_minutes ELSE 0 END),0) as today_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id=u.id AND ws.status IN ('Validé','Terminé')
     WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif' GROUP BY u.id`,
    [today, today, user.department_id]
  )
  res.json(members.map(m => ({ ...m, today_hours: minutesToHours(Number(m.today_minutes || 0)), password_hash: undefined, password_encrypted: undefined })))
})

// ============================================
// CHEF - VALIDATION
// ============================================

app.get('/api/chef/validation', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  res.json(await query(
    `SELECT ws.*, CONCAT(u.first_name,' ',u.last_name) as agent_name,
     t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws JOIN users u ON ws.user_id=u.id JOIN tasks t ON ws.task_id=t.id
     JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.department_id=? AND ws.status='Terminé' ORDER BY ws.start_time DESC`,
    [user.department_id]
  ))
})

app.post('/api/chef/validate/:id', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  // Vérifier que la session appartient au département du chef (sauf admin)
  if (user.role === 'Chef de Département') {
    const session = await query('SELECT department_id FROM work_sessions WHERE id=?', [req.params.id])
    if (!session[0]) return res.status(404).json({ error: 'Session non trouvée' })
    if (session[0].department_id !== user.department_id) {
      return res.status(403).json({ error: 'Cette session n\'appartient pas à votre département' })
    }
  }
  await run('UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=NOW(), updated_at=NOW() WHERE id=?', [user.id, req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?,?,?)', [user.id, 'VALIDATION', `Session #${req.params.id} validée`])
  res.json({ message: 'Session validée' })
})

app.post('/api/chef/reject/:id', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  // Vérifier que la session appartient au département du chef (sauf admin)
  if (user.role === 'Chef de Département') {
    const session = await query('SELECT department_id FROM work_sessions WHERE id=?', [req.params.id])
    if (!session[0]) return res.status(404).json({ error: 'Session non trouvée' })
    if (session[0].department_id !== user.department_id) {
      return res.status(403).json({ error: 'Cette session n\'appartient pas à votre département' })
    }
  }
  const reason = req.body?.reason || ''
  if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Un motif de rejet est obligatoire (min 3 caractères)' })
  await run('UPDATE work_sessions SET status="Rejeté", rejected_reason=?, updated_at=NOW() WHERE id=?', [reason.trim(), req.params.id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?,?,?)', [user.id, 'REJET', `Session #${req.params.id} rejetée – ${reason}`])
  res.json({ message: 'Session rejetée' })
})

app.post('/api/chef/validate-all', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  await run('UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=NOW() WHERE department_id=? AND status="Terminé"', [user.id, user.department_id])
  await run('INSERT INTO audit_logs (user_id, action, details) VALUES (?,?,?)', [user.id, 'VALIDATION', 'Validation groupée de toutes les sessions'])
  res.json({ message: 'Toutes les sessions validées' })
})

// ============================================
// CHEF - RAPPORTS & TREND
// ============================================

app.get('/api/chef/reports', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const { date_from, date_to, agent_id, status: statusFilter, export: exportType } = req.query
  let sql = `SELECT ws.*, CONCAT(u.first_name,' ',u.last_name) as agent_name,
     t.name as task_name, t.task_type, p.name as process_name,
     o.name as objective_name, o.color as objective_color
     FROM work_sessions ws JOIN users u ON ws.user_id=u.id JOIN tasks t ON ws.task_id=t.id
     JOIN processes p ON t.process_id=p.id JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.department_id=?`
  const params = [user.department_id]
  if (date_from)    { sql += ' AND DATE(ws.start_time) >= ?'; params.push(date_from) }
  if (date_to)      { sql += ' AND DATE(ws.start_time) <= ?'; params.push(date_to) }
  if (agent_id)     { sql += ' AND ws.user_id=?';             params.push(agent_id) }
  if (statusFilter) { sql += ' AND ws.status=?';              params.push(statusFilter) }
  sql += ' ORDER BY ws.start_time DESC'
  const rows = await query(sql, params)

  if (exportType === 'csv') {
    const agentMonthMap = {}
    for (const r of rows) {
      if (r.status !== 'Validé') continue
      const key = `${r.agent_name}|${(r.start_time ? new Date(r.start_time).toISOString() : '').slice(0, 7)}`
      if (!agentMonthMap[key]) agentMonthMap[key] = { prod: 0, admin: 0, ctrl: 0, total: 0 }
      const cat = norm333(r.task_type)
      const dur = Number(r.duration_minutes || 0)
      agentMonthMap[key].total += dur
      if (cat === 'Production') agentMonthMap[key].prod += dur
      else if (cat === 'Administration & Reporting') agentMonthMap[key].admin += dur
      else agentMonthMap[key].ctrl += dur
    }
    const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + '%' : '0%'
    const hhmm = min => { const h = Math.floor(min / 60), m = min % 60; return `${h}h ${String(m).padStart(2, '0')}m` }
    const header = 'Agent,Tâche,Processus,Objectif,Date début,Date fin,Durée (min),Catégorie 3-3-3,Statut,Motif rejet,% Productif (mois),% Admin-Reporting (mois),% Contrôle (mois)\n'
    const csvRows = rows.map(r => {
      const dur = Number(r.duration_minutes || 0)
      const cat = norm333(r.task_type)
      const mois = r.start_time ? new Date(r.start_time).toISOString().slice(0, 7) : ''
      const key  = `${r.agent_name}|${mois}`
      const am   = agentMonthMap[key] || { prod: 0, admin: 0, ctrl: 0, total: 0 }
      return [
        `"${r.agent_name || ''}"`, `"${r.task_name || ''}"`, `"${r.process_name || ''}"`, `"${r.objective_name || ''}"`,
        r.start_time ? new Date(r.start_time).toLocaleString('fr-FR') : '',
        r.end_time   ? new Date(r.end_time).toLocaleString('fr-FR')   : '',
        dur, cat, r.status || '',
        `"${(r.rejected_reason || '').replace(/"/g, '""')}"`,
        pct(am.prod, am.total), pct(am.admin, am.total), pct(am.ctrl, am.total)
      ].join(',')
    }).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="rapport_chef_${new Date().toISOString().split('T')[0]}.csv"`)
    return res.send('\uFEFF' + header + csvRows)
  }
  res.json(rows)
})

app.get('/api/chef/productivity-trend', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const days = Math.min(parseInt(req.query.period || '30') || 30, 90)
  const rows = await query(
    `SELECT DATE(ws.start_time) as jour,
     CONCAT(u.first_name,' ',u.last_name) as agent_name,
     COALESCE(SUM(ws.duration_minutes),0) as total_minutes
     FROM work_sessions ws JOIN users u ON ws.user_id=u.id
     WHERE ws.department_id=? AND ws.status IN ('Validé','Terminé')
       AND DATE(ws.start_time) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(ws.start_time), ws.user_id, u.first_name, u.last_name ORDER BY jour ASC, agent_name`,
    [user.department_id, days]
  )
  const dates  = [...new Set(rows.map(r => r.jour instanceof Date ? r.jour.toISOString().split('T')[0] : String(r.jour)))]
  const agents = [...new Set(rows.map(r => r.agent_name))]
  const pivot  = {}
  for (const r of rows) {
    const jour = r.jour instanceof Date ? r.jour.toISOString().split('T')[0] : String(r.jour)
    if (!pivot[r.agent_name]) pivot[r.agent_name] = {}
    pivot[r.agent_name][jour] = Number(r.total_minutes)
  }
  res.json({ dates, agents, pivot })
})

// ============================================
// CHEF DE SERVICE — identique Agent mais rôle Chef de Service
// ============================================

app.get('/api/chef-service/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Service' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  try {
    const todayMin    = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND DATE(start_time)=CURDATE()`, [user.id])
    const totalMin    = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`, [user.id])
    const sessionStats = await query(`SELECT COUNT(*) as total, SUM(CASE WHEN status='Rejeté' THEN 1 ELSE 0 END) as rejected FROM work_sessions WHERE user_id=?`, [user.id])
    const team = await query(
      `SELECT u.id, CONCAT(u.first_name,' ',u.last_name) as name, u.role,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes,
       COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes,
       COUNT(ws.id) as total_sessions
       FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id
       WHERE u.department_id=? AND u.role='Agent' AND u.status='Actif' GROUP BY u.id, u.first_name, u.last_name`,
      [user.department_id]
    )
    const byObjective = await query(
      `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM strategic_objectives o
       LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.user_id=? WHERE o.status='Actif'
       GROUP BY o.id, o.name, o.color HAVING total_minutes>0`,
      [user.id]
    )
    res.json({
      today_hours: minutesToHours(Number(todayMin[0]?.m || 0)),
      total_hours: minutesToHours(Number(totalMin[0]?.m || 0)),
      total_sessions:    Number(sessionStats[0]?.total    || 0),
      rejected_sessions: Number(sessionStats[0]?.rejected || 0),
      team, byObjective
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.get('/api/chef-service/tasks', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Chef de Service' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  res.json(await query(
    `SELECT t.*, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t JOIN processes p ON t.process_id=p.id JOIN strategic_objectives o ON t.objective_id=o.id
     WHERE t.department_id=? AND t.status='Actif' ORDER BY t.name`,
    [user.department_id]
  ))
})

app.get('/api/chef-service/sessions', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Chef de Service') return res.status(401).json({ error: 'Non autorisé' })
  res.json(await query(
    `SELECT ws.*, t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.user_id=? ORDER BY ws.start_time DESC LIMIT 50`,
    [user.id]
  ))
})

app.get('/api/chef-service/sessions/active', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Chef de Service') return res.status(401).json({ error: 'Non autorisé' })
  const rows = await query(
    `SELECT ws.*, t.name as task_name FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id
     WHERE ws.user_id=? AND ws.status='En cours' ORDER BY ws.start_time DESC LIMIT 1`,
    [user.id]
  )
  res.json(rows[0] || null)
})

app.post('/api/chef-service/sessions/start', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Chef de Service') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { task_id } = req.body
    const existing = await query(`SELECT id FROM work_sessions WHERE user_id=? AND status='En cours'`, [user.id])
    if (existing.length > 0) return res.status(400).json({ error: 'Une session est déjà en cours. Terminez-la d\'abord.' })
    const task = await query('SELECT * FROM tasks WHERE id=?', [task_id])
    if (!task[0]) return res.status(404).json({ error: 'Tâche introuvable' })
    const result = await run(
      `INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, status, session_type) VALUES (?,?,?,?,NOW(),'En cours','Auto')`,
      [user.id, task_id, task[0].objective_id, user.department_id]
    )
    res.json({ id: result.insertId, message: 'Session démarrée' })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

app.post('/api/chef-service/sessions/stop', async (req, res) => {
  const user = getUser(req)
  if (!user || user.role !== 'Chef de Service') return res.status(401).json({ error: 'Non autorisé' })
  try {
    const { comment } = req.body || {}
    const session = await query(`SELECT * FROM work_sessions WHERE user_id=? AND status='En cours' ORDER BY start_time DESC LIMIT 1`, [user.id])
    if (!session[0]) return res.status(404).json({ error: 'Aucune session en cours' })
    const durationMinutes = Math.min(Math.round((Date.now() - new Date(session[0].start_time).getTime()) / 60000), 480)
    await run(`UPDATE work_sessions SET end_time=NOW(), duration_minutes=?, status='Terminé', comment=?, updated_at=NOW() WHERE id=?`,
      [durationMinutes, comment || null, session[0].id])
    res.json({ message: 'Session terminée', duration_minutes: durationMinutes })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// DIRECTEUR DE DÉPARTEMENT
// ============================================

app.get('/api/dir-dept/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Directeur de Département' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  const deptId = user.department_id
  try {
    const dept         = await query('SELECT name FROM departments WHERE id=?', [deptId])
    const activeAgents = await query(`SELECT COUNT(DISTINCT user_id) as c FROM work_sessions WHERE department_id=? AND DATE(start_time)=CURDATE()`, [deptId])
    const totalHours   = await query(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE department_id=? AND DATE_FORMAT(start_time,'%Y-%m')=DATE_FORMAT(NOW(),'%Y-%m') AND status IN ('Validé','Terminé')`,
      [deptId]
    )
    const toValidate   = await query(`SELECT COUNT(*) as c FROM work_sessions WHERE department_id=? AND status='Terminé'`, [deptId])
    const byObjective  = await query(
      `SELECT o.name, o.color, o.target_percentage, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM strategic_objectives o
       LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.department_id=? AND ws.status IN ('Validé','Terminé')
       WHERE o.status='Actif' GROUP BY o.id, o.name, o.color, o.target_percentage HAVING total_minutes>0`,
      [deptId]
    )
    const agentPerf = await query(
      `SELECT CONCAT(u.first_name,' ',u.last_name) as name, u.role,
       COUNT(ws.id) as sessions, COALESCE(SUM(ws.duration_minutes),0) as total_minutes,
       COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes
       FROM users u LEFT JOIN work_sessions ws ON ws.user_id=u.id AND ws.status IN ('Validé','Terminé')
       WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif'
       GROUP BY u.id ORDER BY total_minutes DESC`,
      [deptId]
    )
    const recentSessions = await query(
      `SELECT ws.*, CONCAT(u.first_name,' ',u.last_name) as agent_name, t.name as task_name, o.name as objective_name
       FROM work_sessions ws JOIN users u ON ws.user_id=u.id JOIN tasks t ON ws.task_id=t.id
       JOIN strategic_objectives o ON ws.objective_id=o.id
       WHERE ws.department_id=? ORDER BY ws.start_time DESC LIMIT 20`,
      [deptId]
    )
    const grandTotal = byObjective.reduce((s, o) => s + Number(o.total_minutes), 0)
    res.json({
      department_name: dept[0]?.name || '',
      active_agents: Number(activeAgents[0]?.c || 0),
      total_hours: minutesToHours(Number(totalHours[0]?.m || 0)),
      to_validate: Number(toValidate[0]?.c || 0),
      byObjective: byObjective.map(o => ({
        ...o, total_minutes: Number(o.total_minutes),
        percentage: grandTotal > 0 ? Math.round(Number(o.total_minutes) * 100 / grandTotal) : 0,
        hours_display: minutesToHours(Number(o.total_minutes))
      })),
      agentPerf, recentSessions
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// DIRECTEUR GÉNÉRAL — Dashboard complet (3-3-3 + comparaison + cumul 6 mois)
// ============================================

app.get('/api/dg/dashboard', async (req, res) => {
  const user = getUser(req)
  if (!user || (user.role !== 'Directeur Général' && user.role !== 'Administrateur')) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  try {
    const rawMonth  = req.query.month  || new Date().toISOString().slice(0, 7)
    const rawMonth2 = req.query.month2 || null
    const month  = validateMonthFormat(rawMonth)  || new Date().toISOString().slice(0, 7)
    const month2 = validateMonthFormat(rawMonth2) || null

    const dgWdStd  = calcWorkingDays(month, false)
    const dgWdSat  = calcWorkingDays(month, true)
    const dgWdStd2 = month2 ? calcWorkingDays(month2, false) : null
    const dgWdSat2 = month2 ? calcWorkingDays(month2, true)  : null

    const STATUSES = `ws.status IN ('Validé','Terminé')`
    const mf = m => `DATE_FORMAT(ws.start_time,'%Y-%m')='${m}'`

    const totalUsers     = await query(`SELECT COUNT(*) as c FROM users WHERE status='Actif' AND role NOT IN ('Administrateur','Directeur Général')`)
    const totalHoursMonth = await query(`SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions ws WHERE ${STATUSES} AND ${mf(month)}`)
    const toValidate     = await query(`SELECT COUNT(*) as c FROM work_sessions WHERE status='Terminé'`)

    const deptCap = await query(
      `SELECT d.name as dept_name, COUNT(u.id) as agent_count,
       SUM(CASE WHEN u.works_saturday=1 THEN 1 ELSE 0 END) as agents_with_saturday,
       SUM(CASE WHEN u.works_saturday=0 THEN 1 ELSE 0 END) as agents_without_saturday
       FROM departments d
       LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif' AND u.role IN ('Agent','Chef de Service')
       WHERE d.status='Actif' GROUP BY d.id, d.name`
    )

    async function getDgRatio333 (m, wdStd, wdSat) {
      const raw333 = await query(
        `SELECT COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id WHERE ${STATUSES} AND ${mf(m)} GROUP BY t.task_type`
      )
      const raw333Dept = await query(
        `SELECT d.name as dept_name, COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN departments d ON ws.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)} GROUP BY d.id, t.task_type`
      )
      const raw333Agent = await query(
        `SELECT ws.user_id as agent_id, CONCAT(u.first_name,' ',u.last_name) as agent_name,
         d.name as dept_name, u.works_saturday,
         COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN users u ON ws.user_id=u.id JOIN departments d ON ws.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)} GROUP BY ws.user_id, t.task_type`
      )

      // Ratio global
      const gMap = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
      raw333.forEach(r => { const k = norm333(r.type_333); gMap[k] = (gMap[k] || 0) + Number(r.total_minutes) })
      const gTotal = Object.values(gMap).reduce((s, v) => s + v, 0)
      const ratio333 = Object.entries(gMap).map(([label, minutes]) => ({
        label, minutes, hours_display: minutesToHours(minutes),
        percentage: gTotal > 0 ? Math.round(minutes * 100 / gTotal) : 0
      }))

      // Par département
      const dMap = {}
      raw333Dept.forEach(r => {
        if (!dMap[r.dept_name]) {
          const cap = deptCap.find(ci => ci.dept_name === r.dept_name)
          const agSat   = Number(cap?.agents_with_saturday   || 0)
          const agNoSat = Number(cap?.agents_without_saturday || 0)
          dMap[r.dept_name] = {
            dept_name: r.dept_name, agent_count: cap?.agent_count || 0,
            agents_with_saturday: agSat, agents_without_saturday: agNoSat,
            capacity_minutes: (agSat * wdSat + agNoSat * wdStd) * 480, working_days: wdStd,
            Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        dMap[r.dept_name][norm333(r.type_333)] += Number(r.total_minutes)
      })
      const deptComparison = Object.values(dMap).map(d => {
        const tot = d.Production + d['Administration & Reporting'] + d['Contrôle']
        const pct = d.capacity_minutes > 0 ? Math.round(tot * 100 / d.capacity_minutes) : 0
        return { ...d, total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(d.capacity_minutes) }
      })

      // Par agent
      const aMap = {}
      raw333Agent.forEach(r => {
        if (!aMap[r.agent_id]) {
          const wd = r.works_saturday ? wdSat : wdStd
          aMap[r.agent_id] = {
            agent_id: r.agent_id, agent_name: r.agent_name, dept_name: r.dept_name,
            works_saturday: r.works_saturday || 0, capacity_minutes: wd * 480, working_days: wd,
            Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        aMap[r.agent_id][norm333(r.type_333)] += Number(r.total_minutes)
      })
      const agentComparison = Object.values(aMap).map(a => {
        const tot = a.Production + a['Administration & Reporting'] + a['Contrôle']
        const pct = a.capacity_minutes > 0 ? Math.round(tot * 100 / a.capacity_minutes) : 0
        return { ...a, total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(a.capacity_minutes) }
      })

      return { ratio333, deptComparison, agentComparison }
    }

    const dgM1 = await getDgRatio333(month, dgWdStd, dgWdSat)
    const dgM2 = month2 && dgWdStd2 && dgWdSat2 ? await getDgRatio333(month2, dgWdStd2, dgWdSat2) : null

    const monthlyTrend = await query(
      `SELECT DATE_FORMAT(start_time,'%Y-%m') as month, COALESCE(SUM(duration_minutes),0) as total_minutes
       FROM work_sessions WHERE status IN ('Validé','Terminé')
       GROUP BY DATE_FORMAT(start_time,'%Y-%m') ORDER BY month DESC LIMIT 6`
    )

    const byDept = await query(
      `SELECT d.name as dept_name, COUNT(DISTINCT u.id) as agent_count, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM departments d
       LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif'
       LEFT JOIN work_sessions ws ON ws.department_id=d.id AND ${STATUSES} AND ${mf(month)}
       WHERE d.status='Actif' GROUP BY d.id, d.name ORDER BY total_minutes DESC`
    )
    const grandTotal = byDept.reduce((s, d) => s + Number(d.total_minutes), 0)

    // Cumul 6 mois
    const last6 = await query(
      `SELECT DISTINCT DATE_FORMAT(start_time,'%Y-%m') as m FROM work_sessions WHERE status IN ('Validé','Terminé') ORDER BY m DESC LIMIT 6`
    )
    const cumulMonths = last6.map(r => r.m)

    let cumulDeptComparison = [], cumulAgentComparison = []
    if (cumulMonths.length > 0) {
      const ph = cumulMonths.map(() => '?').join(',')
      const cumulRawDept = await query(
        `SELECT d.name as dept_name, DATE_FORMAT(ws.start_time,'%Y-%m') as month,
         COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN departments d ON ws.department_id=d.id
         WHERE ws.status IN ('Validé','Terminé') AND DATE_FORMAT(ws.start_time,'%Y-%m') IN (${ph})
         GROUP BY d.id, DATE_FORMAT(ws.start_time,'%Y-%m'), t.task_type`,
        [...cumulMonths]
      )
      const cumulRawAgent = await query(
        `SELECT ws.user_id as agent_id, CONCAT(u.first_name,' ',u.last_name) as agent_name,
         d.name as dept_name, u.works_saturday, DATE_FORMAT(ws.start_time,'%Y-%m') as month,
         COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN users u ON ws.user_id=u.id JOIN departments d ON ws.department_id=d.id
         WHERE ws.status IN ('Validé','Terminé') AND DATE_FORMAT(ws.start_time,'%Y-%m') IN (${ph})
         GROUP BY ws.user_id, DATE_FORMAT(ws.start_time,'%Y-%m'), t.task_type`,
        [...cumulMonths]
      )

      const cdMap = {}
      cumulRawDept.forEach(r => {
        if (!cdMap[r.dept_name]) {
          const cap = deptCap.find(ci => ci.dept_name === r.dept_name)
          cdMap[r.dept_name] = {
            dept_name: r.dept_name, agent_count: cap?.agent_count || 0,
            agents_with_saturday: Number(cap?.agents_with_saturday || 0),
            agents_without_saturday: Number(cap?.agents_without_saturday || 0),
            months_included: new Set(), Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        cdMap[r.dept_name][norm333(r.type_333)] += Number(r.total_minutes)
        cdMap[r.dept_name].months_included.add(r.month)
      })
      cumulDeptComparison = Object.values(cdMap).map(d => {
        const nbM = d.months_included.size || 1
        const cap = (d.agents_with_saturday * 22 + d.agents_without_saturday * 22) * 480 * nbM
        const tot = d.Production + d['Administration & Reporting'] + d['Contrôle']
        const pct = cap > 0 ? Math.round(tot * 100 / cap) : 0
        return { dept_name: d.dept_name, agent_count: d.agent_count,
          agents_with_saturday: d.agents_with_saturday, agents_without_saturday: d.agents_without_saturday,
          capacity_minutes: cap, Production: d.Production, 'Administration & Reporting': d['Administration & Reporting'],
          'Contrôle': d['Contrôle'], total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(cap), months_count: nbM
        }
      }).sort((a, b) => b.total_minutes - a.total_minutes)

      const caMap = {}
      cumulRawAgent.forEach(r => {
        if (!caMap[r.agent_id]) caMap[r.agent_id] = {
          agent_id: r.agent_id, agent_name: r.agent_name, dept_name: r.dept_name,
          works_saturday: r.works_saturday || 0, months_included: new Set(),
          Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
        }
        caMap[r.agent_id][norm333(r.type_333)] += Number(r.total_minutes)
        caMap[r.agent_id].months_included.add(r.month)
      })
      cumulAgentComparison = Object.values(caMap).map(a => {
        const nbM = a.months_included.size || 1
        const wd  = a.works_saturday ? 26 : 22
        const cap = wd * 480 * nbM
        const tot = a.Production + a['Administration & Reporting'] + a['Contrôle']
        const pct = cap > 0 ? Math.round(tot * 100 / cap) : 0
        return { agent_id: a.agent_id, agent_name: a.agent_name, dept_name: a.dept_name,
          works_saturday: a.works_saturday, capacity_minutes: cap,
          Production: a.Production, 'Administration & Reporting': a['Administration & Reporting'], 'Contrôle': a['Contrôle'],
          total_minutes: tot, productive_pct: pct, non_productive_pct: Math.max(0, 100 - pct),
          hours_display: minutesToHours(tot), capacity_hours_display: minutesToHours(cap), months_count: nbM
        }
      }).sort((a, b) => b.total_minutes - a.total_minutes)
    }

    res.json({
      month, month2: month2 || null,
      working_days: dgWdStd, working_days_month2: dgWdStd2,
      total_users: Number(totalUsers[0]?.c || 0),
      total_hours_month: minutesToHours(Number(totalHoursMonth[0]?.m || 0)),
      to_validate: Number(toValidate[0]?.c || 0),
      byDept: byDept.map(d => ({
        ...d, total_minutes: Number(d.total_minutes),
        percentage: grandTotal > 0 ? Math.round(Number(d.total_minutes) * 100 / grandTotal) : 0,
        hours_display: minutesToHours(Number(d.total_minutes))
      })),
      monthlyTrend,
      ratio333: dgM1.ratio333, ratio333Month2: dgM2?.ratio333 || null,
      deptComparison: dgM1.deptComparison, deptComparisonMonth2: dgM2?.deptComparison || null,
      agentComparison: dgM1.agentComparison, agentComparisonMonth2: dgM2?.agentComparison || null,
      byDept333: dgM1.deptComparison, byAgent333: dgM1.agentComparison,
      cumulMonths, cumulDeptComparison, cumulAgentComparison
    })
  } catch (e) { 
    console.error('[ERROR]', e.message)
    res.status(500).json({ error: 'Erreur interne du serveur' }) 
  }
})

// ============================================
// FICHIERS STATIQUES + SPA ROUTES
// ============================================

const staticDir = path.join(__dirname, 'public', 'static')
app.use('/static', express.static(staticDir))

// Pages HTML — redirige vers le bon fichier JS selon le rôle
function getLoginHTML () {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack - BGFIBank</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;}
#bg-video{position:fixed;inset:0;width:100%;height:100%;z-index:0;object-fit:cover;pointer-events:none;}
.scene{position:fixed;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:16px;}
.login-card{position:relative;width:100%;max-width:420px;background:rgba(255,255,255,0.20);border:1px solid rgba(255,255,255,0.45);border-radius:24px;padding:40px 36px 36px;backdrop-filter:blur(28px) saturate(1.6) brightness(1.05);-webkit-backdrop-filter:blur(28px) saturate(1.6) brightness(1.05);box-shadow:0 8px 48px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.5);animation:cardIn .7s cubic-bezier(.22,1,.36,1) both;}
@keyframes cardIn{from{opacity:0;transform:translateY(28px) scale(.97);}to{opacity:1;transform:none;}}
.logo-wrapper{background:rgba(255,255,255,0.95);border-radius:14px;padding:14px 22px;display:inline-block;box-shadow:0 4px 24px rgba(0,0,0,0.18);margin-bottom:18px;}
.logo-wrapper img{height:56px;width:auto;display:block;}
.app-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:5px 14px;font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;letter-spacing:.3px;}
.divider{height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.25),transparent);margin:18px 0;}
.field-label{display:block;font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);margin-bottom:6px;}
.input-wrap{position:relative;}
.input-field{width:100%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);border-radius:10px;padding:12px 16px;font-size:14px;color:#fff;outline:none;transition:all .2s;}
.input-field::placeholder{color:rgba(255,255,255,0.4);}
.input-field:focus{border-color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.18);box-shadow:0 0 0 3px rgba(255,255,255,0.10);}
.input-field.has-icon{padding-right:44px;}
.eye-btn{position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.5);font-size:15px;transition:color .2s;}
.eye-btn:hover{color:rgba(255,255,255,0.9);}
.btn-primary{width:100%;background:linear-gradient(135deg,#2563eb,#1e3a5f);border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:600;color:#fff;cursor:pointer;transition:all .25s;box-shadow:0 4px 20px rgba(30,58,95,0.5);}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(30,58,95,0.65);}
.btn-primary:disabled{opacity:.65;cursor:not-allowed;transform:none;}
.error-box{display:none;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:10px 14px;color:#fca5a5;font-size:13px;margin-bottom:16px;}
.error-box.show{display:flex;align-items:center;gap:8px;}
.card-footer{margin-top:18px;text-align:center;font-size:11px;color:rgba(255,255,255,0.35);}
.field-group{margin-bottom:16px;}
</style>
</head>
<body>
<video id="bg-video" autoplay muted loop playsinline><source src="/static/bg-video.mp4" type="video/mp4"></video>
<div class="scene">
<div class="login-card">
  <div style="text-align:center;margin-bottom:20px;">
    <div class="logo-wrapper"><img src="/static/bgfibank-logo.png" alt="BGFIBank"></div>
    <div class="divider"></div>
    <div class="app-badge"><i class="fas fa-clock"></i><span>TimeTrack &mdash; Suivi du temps</span></div>
  </div>
  <div id="error-msg" class="error-box"><i class="fas fa-exclamation-circle"></i><span id="error-text"></span></div>
  <form id="login-form">
    <div class="field-group">
      <label class="field-label" for="email">Adresse email</label>
      <input type="email" id="email" class="input-field" placeholder="email@bgfibank.com" required autocomplete="username">
    </div>
    <div class="field-group">
      <label class="field-label" for="password">Mot de passe</label>
      <div class="input-wrap">
        <input type="password" id="password" class="input-field has-icon" placeholder="••••••••" required autocomplete="current-password">
        <button type="button" class="eye-btn" onclick="togglePwd()" tabindex="-1"><i class="fas fa-eye" id="eye-icon"></i></button>
      </div>
    </div>
    <button type="submit" class="btn-primary" id="login-btn" style="margin-top:8px;">
      <i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter
    </button>
  </form>
  <div class="card-footer">&copy; ${year} BGFIBank &mdash; Accès réservé au personnel autorisé</div>
</div>
</div>
<script>
function togglePwd(){const p=document.getElementById('password'),i=document.getElementById('eye-icon');if(p.type==='password'){p.type='text';i.className='fas fa-eye-slash';}else{p.type='password';i.className='fas fa-eye';}}
function showError(msg){const b=document.getElementById('error-msg');document.getElementById('error-text').textContent=msg;b.classList.add('show');}
function hideError(){document.getElementById('error-msg').classList.remove('show');}
document.getElementById('login-form').addEventListener('submit',async(e)=>{
  e.preventDefault();const btn=document.getElementById('login-btn');hideError();
  btn.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Connexion en cours...';btn.disabled=true;
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});
    const d=await r.json();
    if(!r.ok){
      if(d.blocked){showError(d.error);btn.innerHTML='<i class="fas fa-lock" style="margin-right:8px;"></i>Compte bloqué';btn.disabled=true;
        setTimeout(()=>{btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';btn.disabled=false;},d.minutesLeft*60*1000);}
      else{showError(d.error||'Email ou mot de passe incorrect');btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';btn.disabled=false;}
      return;
    }
    localStorage.setItem('token',d.token);localStorage.setItem('user',JSON.stringify(d.user));
    btn.innerHTML='<i class="fas fa-check" style="margin-right:8px;"></i>Bienvenue !';
    setTimeout(()=>{
      const role=d.user.role;
      if(role==='Administrateur') window.location='/admin/dashboard';
      else if(role==='Directeur Général') window.location='/dg/dashboard';
      else if(role==='Directeur de Département') window.location='/dir-dept/dashboard';
      else if(role==='Chef de Département') window.location='/chef/dashboard';
      else if(role==='Chef de Service') window.location='/chef-service/dashboard';
      else window.location='/agent/dashboard';
    },400);
  }catch(err){showError(err.message||'Erreur réseau');btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';btn.disabled=false;}
});
(function(){
  const t=localStorage.getItem('token');
  if(t){
    const u=JSON.parse(localStorage.getItem('user')||'{}');
    const role=u.role||'';
    if(role==='Administrateur') window.location='/admin/dashboard';
    else if(role==='Directeur Général') window.location='/dg/dashboard';
    else if(role==='Directeur de Département') window.location='/dir-dept/dashboard';
    else if(role==='Chef de Département') window.location='/chef/dashboard';
    else if(role==='Chef de Service') window.location='/chef-service/dashboard';
    else if(role==='Agent') window.location='/agent/dashboard';
  }
})();
</script>
</body></html>`
}

const spa = (jsFile, title) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title} - BGFIBank</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/${jsFile.replace('.js', '.css')}">
</head><body><div id="app"></div><script src="/static/${jsFile}"></script></body></html>`

app.get('/login',              (req, res) => res.send(getLoginHTML()))
app.get('/admin*',             (req, res) => res.send(spa('admin.js',       'TimeTrack Admin')))
app.get('/agent*',             (req, res) => res.send(spa('agent.js',       'TimeTrack Agent')))
app.get('/chef*',              (req, res) => res.send(spa('chef.js',        'TimeTrack Chef')))
app.get('/chef-service*',      (req, res) => res.send(spa('chef-service.js', 'TimeTrack Chef de Service')))
app.get('/dir-dept*',          (req, res) => res.send(spa('dir-dept.js',     'TimeTrack Directeur de Département')))
app.get('/dg*',                (req, res) => res.send(spa('dg.js',          'TimeTrack Directeur Général')))
app.get('/',                   (req, res) => res.redirect('/login'))

// ============================================
// DÉMARRAGE SERVEUR
// ============================================

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TimeTrack BGFIBank (MySQL) démarré sur http://0.0.0.0:${PORT}`)
    console.log(`   Base de données: ${DB_CONFIG.database} @ ${DB_CONFIG.host}:${DB_CONFIG.port}`)
    console.log(`   Accès local:     http://localhost:${PORT}/login`)
    console.log(`   Accès réseau:    http://<IP_SERVEUR>:${PORT}/login`)
    console.log(`   JWT expire:      ${JWT_EXPIRY / 3600}h`)
    console.log(`   Hash mot passe:  PBKDF2-SHA256 (600 000 itérations)\n`)
  })
}).catch(err => {
  console.error('❌ Impossible de se connecter à MySQL:', err.message)
  console.error('   Vérifiez MySQL et les paramètres dans .env')
  console.error('   Host:', DB_CONFIG.host, '| Port:', DB_CONFIG.port, '| DB:', DB_CONFIG.database)
  process.exit(1)
})
