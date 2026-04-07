import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// Headers de sécurité
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
})

// ============================================
// UTILITIES
// ============================================
// JWT Secret - utiliser variable d'environnement si disponible
const JWT_SECRET = (globalThis as any).JWT_SECRET || 'timetrack-bgfibank-secret-2024-x9k2p7m'

// Rate limiting - stockage en mémoire des tentatives
const loginAttempts = new Map<string, { count: number, blockedUntil: number }>()
const MAX_ATTEMPTS = 3
const BLOCK_DURATION = 2 * 60 * 1000 // 2 minutes

function checkRateLimit(ip: string): { blocked: boolean, remaining: number, minutesLeft: number } {
  const now = Date.now()
  const attempts = loginAttempts.get(ip)
  if (!attempts) return { blocked: false, remaining: MAX_ATTEMPTS, minutesLeft: 0 }
  if (attempts.blockedUntil > now) {
    const minutesLeft = Math.ceil((attempts.blockedUntil - now) / 60000)
    return { blocked: true, remaining: 0, minutesLeft }
  }
  if (attempts.blockedUntil > 0 && attempts.blockedUntil <= now) {
    loginAttempts.delete(ip)
    return { blocked: false, remaining: MAX_ATTEMPTS, minutesLeft: 0 }
  }
  return { blocked: false, remaining: MAX_ATTEMPTS - attempts.count, minutesLeft: 0 }
}

function recordFailedAttempt(ip: string): { blocked: boolean, remaining: number } {
  const now = Date.now()
  const attempts = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 }
  attempts.count += 1
  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.blockedUntil = now + BLOCK_DURATION
  }
  loginAttempts.set(ip, attempts)
  return { blocked: attempts.count >= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - attempts.count) }
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip)
}

// Validation des entrées
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[<>"'%;()&+]/g, '')
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// PBKDF2 avec Web Crypto API — compatible Cloudflare Workers, sécurisé (600 000 itérations NIST 2024)
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  // Sel aléatoire de 16 octets
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    keyMaterial, 256
  )
  const hashArr = new Uint8Array(bits)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(hashArr).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:sha256:600000:${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const enc = new TextEncoder()
  // Format PBKDF2 moderne
  if (stored.startsWith('pbkdf2:')) {
    const parts = stored.split(':')
    if (parts.length !== 5) return false
    const [, , iterStr, saltHex, expectedHex] = parts
    const iterations = parseInt(iterStr, 10)
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)))
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      keyMaterial, 256
    )
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex === expectedHex
  }
  // Ancien hash SHA-256 (compatibilité migration)
  const data = enc.encode(password)
  const sha = await crypto.subtle.digest('SHA-256', data)
  const shaHex = Array.from(new Uint8Array(sha)).map(b => b.toString(16).padStart(2, '0')).join('')
  return shaHex === stored
}

// JWT manuel (HMAC-SHA256)
async function signJWT(payload: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sigB64}`
}

async function verifyJWT(token: string): Promise<any> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const data = `${parts[0]}.${parts[1]}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
  if (!valid) return null
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  return payload
}

async function getUser(c: any): Promise<any> {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    return await verifyJWT(token)
  } catch {
    return null
  }
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}


// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (c) => {
  try {
    // Récupérer l'IP du client
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown'

    // Vérifier le rate limiting
    const rateCheck = checkRateLimit(ip)
    if (rateCheck.blocked) {
      return c.json({ 
        error: `Compte temporairement bloqué suite à ${MAX_ATTEMPTS} tentatives échouées. Réessayez dans ${rateCheck.minutesLeft} minute(s).`,
        blocked: true,
        minutesLeft: rateCheck.minutesLeft
      }, 429)
    }

    const body = await c.req.json()
    const email = sanitizeString(body.email || '')
    const password = body.password || ''

    if (!email || !password) {
      return c.json({ error: 'Email et mot de passe requis' }, 400)
    }

    if (!validateEmail(email)) {
      return c.json({ error: 'Format email invalide' }, 400)
    }

    if (password.length < 8 || password.length > 100) {
      return c.json({ error: 'Mot de passe invalide (minimum 8 caractères)' }, 400)
    }

    const user = await c.env.DB.prepare(
      'SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email = ? AND u.status = "Actif"'
    ).bind(email).first() as any

    if (!user) {
      recordFailedAttempt(ip)
      const remaining = MAX_ATTEMPTS - (loginAttempts.get(ip)?.count || 0)
      return c.json({ 
        error: `Email ou mot de passe incorrect. ${Math.max(0, remaining)} tentative(s) restante(s).`,
        remaining: Math.max(0, remaining)
      }, 401)
    }

    const passwordMatch = await verifyPassword(password, user.password_hash)
    if (!passwordMatch) {
      const result = recordFailedAttempt(ip)
      await c.env.DB.prepare(
        'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
      ).bind(user.id, 'LOGIN_FAILED', `Tentative de connexion échouée pour ${user.first_name} ${user.last_name} depuis IP ${ip}`).run()
      
      if (result.blocked) {
        return c.json({ 
          error: `Trop de tentatives échouées. Accès bloqué pendant 2 minutes. Vous pouvez utiliser un code de réinitialisation si vous en avez un.`,
          blocked: true,
          minutesLeft: 2
        }, 429)
      }
      return c.json({ 
        error: `Email ou mot de passe incorrect. ${result.remaining} tentative(s) restante(s).`,
        remaining: result.remaining
      }, 401)
    }

    // Connexion réussie - réinitialiser les tentatives
    resetAttempts(ip)

    // Migration automatique SHA-256 → PBKDF2 si l'ancien format est détecté
    if (!user.password_hash.startsWith('pbkdf2:')) {
      const newHash = await hashPassword(password)
      await c.env.DB.prepare(
        'UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(newHash, user.id).run()
    }

    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run()

    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
    ).bind(user.id, 'LOGIN', `Connexion réussie de ${user.first_name} ${user.last_name}`).run()

    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      first_name: user.first_name,
      last_name: user.last_name,
      department_name: user.department_name
    })

    return c.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name
      }
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/auth/me', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)
  return c.json({ user })
})

// ============================================
// AUTH - RESET CODE (mot de passe oublié)
// ============================================

// Stockage en mémoire des codes reset : userId → { code, expiresAt }
const resetCodes = new Map<number, { code: string, expiresAt: number }>()

app.post('/api/auth/reset-request', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { user_id } = await c.req.json()
  const target = await c.env.DB.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ? AND status = \'Actif\'').bind(user_id).first() as any
  if (!target) return c.json({ error: 'Utilisateur non trouvé' }, 404)

  // Générer code à 6 chiffres
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 30 * 60 * 1000 // 30 minutes
  resetCodes.set(target.id, { code, expiresAt })

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(currentUser.id, 'RESET_PASSWORD_REQUEST', `Code reset généré pour ${target.first_name} ${target.last_name}`).run()

  return c.json({ code, user_name: `${target.first_name} ${target.last_name}`, email: target.email })
})

app.post('/api/auth/reset-confirm', async (c) => {
  try {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const { email, code, new_password } = await c.req.json()

    if (!email || !code || !new_password) return c.json({ error: 'Tous les champs sont requis' }, 400)
    if (new_password.length < 8) return c.json({ error: 'Mot de passe trop court (minimum 8 caractères)' }, 400)

    const user = await c.env.DB.prepare('SELECT id, first_name, last_name FROM users WHERE email = ? AND status = \'Actif\'').bind(email).first() as any
    if (!user) return c.json({ error: 'Email introuvable' }, 404)

    const entry = resetCodes.get(user.id)
    if (!entry) return c.json({ error: 'Aucun code actif pour cet utilisateur. Demandez un nouveau code à l\'administrateur.' }, 400)
    if (Date.now() > entry.expiresAt) {
      resetCodes.delete(user.id)
      return c.json({ error: 'Code expiré. Demandez un nouveau code à l\'administrateur.' }, 400)
    }
    if (entry.code !== String(code).trim()) return c.json({ error: 'Code incorrect' }, 400)

    // Code valide — mettre à jour le mot de passe
    const passwordHash = await hashPassword(new_password)
    await c.env.DB.prepare(
      'UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(passwordHash, user.id).run()

    // Supprimer le code utilisé
    resetCodes.delete(user.id)

    // LEVER LE BLOCAGE IP — le code reset prouve l'identité
    resetAttempts(ip)

    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
    ).bind(user.id, 'RESET_PASSWORD_CONFIRM', `Mot de passe réinitialisé pour ${user.first_name} ${user.last_name}`).run()

    return c.json({ message: 'Mot de passe modifié avec succès' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============================================
// ADMIN - USERS
// ============================================

app.get('/api/admin/users', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const users = await c.env.DB.prepare(
    "SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.status = 'Actif' ORDER BY u.created_at DESC"
  ).all()
  return c.json(users.results)
})

app.post('/api/admin/users', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  try {
    const body = await c.req.json()
    const first_name = sanitizeString(body.first_name || '')
    const last_name = sanitizeString(body.last_name || '')
    const email = sanitizeString(body.email || '')
    const password = body.password || ''
    const role = sanitizeString(body.role || '')
    const department_id = body.department_id
    const status = body.status || 'Actif'
    const works_saturday = body.works_saturday ? 1 : 0

    const VALID_ROLES = ['Agent', 'Chef de Service', 'Chef de Département', 'Directeur de Département', 'Directeur Général', 'Administrateur']
    if (!validateEmail(email)) return c.json({ error: 'Email invalide' }, 400)
    if (password.length < 8) return c.json({ error: 'Mot de passe trop court (minimum 8 caractères)' }, 400)
    if (!VALID_ROLES.includes(role)) return c.json({ error: 'Rôle invalide' }, 400)

    const passwordHash = await hashPassword(password)

    const result = await c.env.DB.prepare(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, department_id, status, works_saturday) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(first_name, last_name, email, passwordHash, role, department_id || null, status, works_saturday).run()

    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
    ).bind(currentUser.id, 'CREATE_USER', `Création de l\'utilisateur ${first_name} ${last_name}`).run()

    return c.json({ id: result.meta.last_row_id, message: 'Utilisateur créé avec succès' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.put('/api/admin/users/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  try {
    const id = c.req.param('id')
    const { first_name, last_name, email, password, role, department_id, status, works_saturday } = await c.req.json()

    const VALID_ROLES = ['Agent', 'Chef de Service', 'Chef de Département', 'Directeur de Département', 'Directeur Général', 'Administrateur']
    if (role && !VALID_ROLES.includes(role)) return c.json({ error: 'Rôle invalide' }, 400)
    if (password && password.length < 8) return c.json({ error: 'Mot de passe trop court (minimum 8 caractères)' }, 400)

    const worksSat = works_saturday ? 1 : 0
    if (password) {
      const passwordHash = await hashPassword(password)
      await c.env.DB.prepare(
        'UPDATE users SET first_name=?, last_name=?, email=?, password_hash=?, role=?, department_id=?, status=?, works_saturday=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(first_name, last_name, email, passwordHash, role, department_id || null, status, worksSat, id).run()
    } else {
      await c.env.DB.prepare(
        'UPDATE users SET first_name=?, last_name=?, email=?, role=?, department_id=?, status=?, works_saturday=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(first_name, last_name, email, role, department_id || null, status, worksSat, id).run()
    }

    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
    ).bind(currentUser.id, 'UPDATE_USER', `Modification de l'utilisateur ID ${id}`).run()

    return c.json({ message: 'Utilisateur mis à jour' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/api/admin/users/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  // Protection : ne pas supprimer son propre compte
  if (String(currentUser.id) === String(id)) return c.json({ error: 'Impossible de supprimer votre propre compte' }, 400)

  await c.env.DB.prepare("UPDATE users SET status='Inactif', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run()
  return c.json({ message: 'Utilisateur désactivé' })
})

// ============================================
// ADMIN - DEPARTMENTS
// ============================================

app.get('/api/admin/departments', async (c) => {
  const depts = await c.env.DB.prepare("SELECT * FROM departments WHERE status = 'Actif' ORDER BY name").all()
  return c.json(depts.results)
})

app.post('/api/admin/departments', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  try {
    const { name, code, description, status } = await c.req.json()
    const result = await c.env.DB.prepare(
      'INSERT INTO departments (name, code, description, status) VALUES (?, ?, ?, ?)'
    ).bind(name, code, description || '', status || 'Actif').run()

    return c.json({ id: result.meta.last_row_id, message: 'Département créé' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.put('/api/admin/departments/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const { name, code, description, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE departments SET name=?, code=?, description=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, code, description || '', status, id).run()

  return c.json({ message: 'Département mis à jour' })
})

app.delete('/api/admin/departments/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE departments SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind('Inactif', id).run()
  return c.json({ message: 'Département désactivé' })
})

// ============================================
// ADMIN - OBJECTIVES
// ============================================

app.get('/api/admin/objectives', async (c) => {
  const objs = await c.env.DB.prepare("SELECT * FROM strategic_objectives WHERE status = 'Actif' ORDER BY name").all()
  return c.json(objs.results)
})

app.post('/api/admin/objectives', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { name, description, color, target_percentage, status } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO strategic_objectives (name, description, color, target_percentage, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, description || '', color || '#1e3a5f', target_percentage || 0, status || 'Actif').run()

  return c.json({ id: result.meta.last_row_id, message: 'Objectif créé' })
})

app.put('/api/admin/objectives/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const { name, description, color, target_percentage, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE strategic_objectives SET name=?, description=?, color=?, target_percentage=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, description || '', color || '#1e3a5f', target_percentage || 0, status, id).run()

  return c.json({ message: 'Objectif mis à jour' })
})

app.delete('/api/admin/objectives/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE strategic_objectives SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind('Inactif', id).run()
  return c.json({ message: 'Objectif désactivé' })
})

// ============================================
// ADMIN - PROCESSES
// ============================================

app.get('/api/admin/processes', async (c) => {
  const procs = await c.env.DB.prepare(
    `SELECT p.*, d.name as department_name, o.name as objective_name, o.color as objective_color
     FROM processes p
     JOIN departments d ON p.department_id = d.id
     JOIN strategic_objectives o ON p.objective_id = o.id
     WHERE p.status = 'Actif'
     ORDER BY p.name`
  ).all()
  return c.json(procs.results)
})

app.post('/api/admin/processes', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { name, description, department_id, objective_id, status } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO processes (name, description, department_id, objective_id, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, description || '', department_id, objective_id, status || 'Actif').run()

  return c.json({ id: result.meta.last_row_id, message: 'Processus créé' })
})

app.put('/api/admin/processes/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const { name, description, department_id, objective_id, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE processes SET name=?, description=?, department_id=?, objective_id=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, description || '', department_id, objective_id, status, id).run()

  return c.json({ message: 'Processus mis à jour' })
})

app.delete('/api/admin/processes/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE processes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind('Inactif', id).run()
  return c.json({ message: 'Processus désactivé' })
})

// ============================================
// ADMIN - TASKS
// ============================================

app.get('/api/admin/tasks', async (c) => {
  const tasks = await c.env.DB.prepare(
    `SELECT t.*, d.name as department_name, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t
     JOIN departments d ON t.department_id = d.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON t.objective_id = o.id
     WHERE t.status = 'Actif'
     ORDER BY t.name`
  ).all()
  return c.json(tasks.results)
})

// Helper : déduire objective_id depuis task_type (catégories 3-3-3 fixes)
function objIdFrom333(task_type: string, provided_obj_id: any): number {
  const map: Record<string,number> = {
    'Production': 10, 'Productive': 10,
    'Administration & Reporting': 11, 'Non productive': 11,
    'Contrôle': 12
  }
  // Priorité : déduire depuis task_type, sinon utiliser l'id fourni
  return map[task_type] || Number(provided_obj_id) || 10
}

app.post('/api/admin/tasks', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { name, description, department_id, process_id, objective_id, task_type, status } = await c.req.json()
  const normalizedType = task_type || 'Production'
  const resolvedObjId = objIdFrom333(normalizedType, objective_id)
  const result = await c.env.DB.prepare(
    'INSERT INTO tasks (name, description, department_id, process_id, objective_id, task_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, description || '', department_id, process_id, resolvedObjId, normalizedType, status || 'Actif').run()

  return c.json({ id: result.meta.last_row_id, message: 'Tâche créée' })
})

app.put('/api/admin/tasks/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const { name, description, department_id, process_id, objective_id, task_type, status } = await c.req.json()
  const normalizedType = task_type || 'Production'
  const resolvedObjId = objIdFrom333(normalizedType, objective_id)
  await c.env.DB.prepare(
    'UPDATE tasks SET name=?, description=?, department_id=?, process_id=?, objective_id=?, task_type=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, description || '', department_id, process_id, resolvedObjId, normalizedType, status, id).run()

  return c.json({ message: 'Tâche mise à jour' })
})

app.delete('/api/admin/tasks/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind('Inactif', id).run()
  return c.json({ message: 'Tâche désactivée' })
})

// ============================================
// ADMIN - SESSIONS (toutes)
// ============================================

app.get('/api/admin/sessions', async (c) => {
  const sessions = await c.env.DB.prepare(
    `SELECT ws.*,
     u.first_name || ' ' || u.last_name as agent_name,
     d.name as department_name,
     t.name as task_name,
     o.name as objective_name,
     o.color as objective_color,
     ws.rejected_reason
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN departments d ON ws.department_id = d.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     ORDER BY ws.created_at DESC
     LIMIT 200`
  ).all()
  return c.json(sessions.results)
})

// ============================================
// ADMIN - STATS (tableau de bord)
// ============================================

app.get('/api/admin/stats', async (c) => {
  try {
  const user = await getUser(c)
  if (!user || user.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  // Paramètres de filtre mensuel
  const month = (c.req.query('month') || new Date().toISOString().slice(0,7)) as string
  const month2 = c.req.query('month2') as string | undefined

  const STATUSES = `ws.status IN ('Validé', 'En attente', 'En cours')`

  // Helper pour construire les requêtes avec filtre mois
  const monthFilter = (m: string) => `strftime('%Y-%m', ws.start_time) = '${m}'`

  // ── Calcul des jours travaillés réels d'un mois selon le profil de l'agent
  // includeSaturday=false → lundi-vendredi | includeSaturday=true → lundi-samedi
  // Mois en cours → compte jusqu'à aujourd'hui | Mois passé → mois complet
  const calcWorkingDays = (m: string, includeSaturday = false): number => {
    const [y, mo] = m.split('-').map(Number)
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === mo
    const lastDay = isCurrentMonth
      ? today.getDate()
      : new Date(y, mo, 0).getDate()
    let count = 0
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(y, mo - 1, d).getDay() // 0=dim, 6=sam
      if (dow === 0) continue  // dimanche toujours exclu
      if (dow === 6 && !includeSaturday) continue  // samedi exclu si non concerné
      count++
    }
    return count || 1
  }

  // Jours ouvrés standard (lun-ven) et avec samedi pour ce mois
  const workingDaysMonth     = calcWorkingDays(month, false)
  const workingDaysSatMonth  = calcWorkingDays(month, true)
  const workingDaysMonth2    = month2 ? calcWorkingDays(month2, false) : null
  const workingDaysSatMonth2 = month2 ? calcWorkingDays(month2, true)  : null

  // ── Requête ratio 3-3-3 par mois avec décomposition par département et agent ──
  async function getRatio333ForMonth(m: string) {
    // Ratio global 3-3-3 pour ce mois
    const ratio333 = await c.env.DB.prepare(
      `SELECT COALESCE(t.task_type,'Production') as type_333,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws LEFT JOIN tasks t ON ws.task_id=t.id
       WHERE ${STATUSES} AND ${monthFilter(m)}
       GROUP BY COALESCE(t.task_type,'Production')`
    ).all()

    // Ratio 3-3-3 par département
    const ratio333ByDept = await c.env.DB.prepare(
      `SELECT d.name as dept_name, d.id as dept_id,
       COUNT(DISTINCT u.id) as agent_count,
       COALESCE(t.task_type,'Production') as type_333,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws
       LEFT JOIN tasks t ON ws.task_id=t.id
       LEFT JOIN departments d ON ws.department_id=d.id
       LEFT JOIN users u ON ws.user_id=u.id
       WHERE ${STATUSES} AND ${monthFilter(m)}
       GROUP BY d.id, d.name, COALESCE(t.task_type,'Production')
       ORDER BY d.name`
    ).all()

    // Ratio 3-3-3 par agent (+ works_saturday pour le calcul de capacité individuel)
    const ratio333ByAgent = await c.env.DB.prepare(
      `SELECT u.first_name||' '||u.last_name as agent_name, u.id as agent_id,
       d.name as dept_name,
       u.works_saturday,
       COALESCE(t.task_type,'Production') as type_333,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws
       LEFT JOIN tasks t ON ws.task_id=t.id
       LEFT JOIN users u ON ws.user_id=u.id
       LEFT JOIN departments d ON u.department_id=d.id
       WHERE ${STATUSES} AND ${monthFilter(m)}
       GROUP BY u.id, u.first_name, u.last_name, d.name, u.works_saturday, COALESCE(t.task_type,'Production')
       ORDER BY d.name, u.last_name`
    ).all()

    // Capacité théorique par département
    // On compte séparément agents avec/sans samedi pour calculer la capacité exacte
    const deptCapacity = await c.env.DB.prepare(
      `SELECT d.id as dept_id, d.name as dept_name,
       COUNT(u.id) as agent_count,
       SUM(CASE WHEN u.works_saturday=1 THEN 1 ELSE 0 END) as agents_with_saturday,
       SUM(CASE WHEN u.works_saturday=0 THEN 1 ELSE 0 END) as agents_without_saturday
       FROM departments d
       LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif' AND u.role IN ('Agent','Chef de Service')
       WHERE d.status='Actif'
       GROUP BY d.id, d.name`
    ).all()

    return { ratio333: ratio333.results, ratio333ByDept: ratio333ByDept.results, ratio333ByAgent: ratio333ByAgent.results, deptCapacity: deptCapacity.results }
  }

  // Heures par objectif stratégique
  const hoursByObjective = await c.env.DB.prepare(
    `SELECT o.name, o.color, o.target_percentage,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id
       AND ${STATUSES} AND ${monthFilter(month)}
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color, o.target_percentage
     ORDER BY total_minutes DESC`
  ).all()

  // Heures par département
  const hoursByDept = await c.env.DB.prepare(
    `SELECT d.name, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM departments d
     LEFT JOIN work_sessions ws ON ws.department_id = d.id
       AND ${STATUSES} AND ${monthFilter(month)}
     GROUP BY d.id, d.name
     HAVING total_minutes > 0
     ORDER BY total_minutes DESC`
  ).all()

  // Tendance mensuelle (6 derniers mois)
  const monthlyTrend = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', ws.start_time) as month,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM work_sessions ws
     WHERE ${STATUSES}
     GROUP BY strftime('%Y-%m', ws.start_time)
     ORDER BY month DESC LIMIT 6`
  ).all()

  // Nombre total d'agents actifs
  const totalAgents = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM users WHERE role = 'Agent' AND status = 'Actif'`
  ).first() as any

  // ── Correction 3 : on vérifie si aujourd'hui est un jour ouvrable (lun-ven)
  // strftime('%w', 'now') : 0=dimanche, 6=samedi
  const todayDow = new Date().getDay() // 0=dim, 6=sam
  const isWeekend = todayDow === 0 || todayDow === 6

  // ── Correction 2 : on distingue 3 catégories par agent aujourd'hui
  //    validated_minutes  = sessions Validé
  //    pending_minutes    = sessions En attente (travail réel non encore validé)
  //    inprogress_minutes = sessions En cours (agent actuellement en train de travailler)
  //    non_pointed        = 480 - tout ce qui est pointé (absent sans justificatif)
  const productivityToday = await c.env.DB.prepare(
    `SELECT
       u.id,
       u.first_name || ' ' || u.last_name as agent_name,
       d.name as department_name,
       COALESCE(SUM(CASE WHEN ws.status = 'Validé'     THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes,
       COALESCE(SUM(CASE WHEN ws.status = 'En attente' THEN ws.duration_minutes ELSE 0 END), 0) as pending_minutes,
       COALESCE(SUM(CASE WHEN ws.status = 'En cours'   THEN ws.duration_minutes ELSE 0 END), 0) as inprogress_minutes
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
       AND date(ws.start_time) = date('now')
       AND ws.status IN ('Validé', 'En attente', 'En cours')
     WHERE u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name, d.name`
  ).all() as any

  const agentsToday = productivityToday.results as any[]

  // ── Si on est un weekend : capacité = 0 (pas de journée de travail attendue)
  const capacityPerAgent = isWeekend ? 0 : 480
  const totalCapacityToday = (totalAgents?.count || 0) * capacityPerAgent

  // ── Calculs agrégés avec les 3 catégories
  const agentsTodayMapped = agentsToday.map((a: any) => {
    const total_pointed = Math.min(a.validated_minutes + a.pending_minutes + a.inprogress_minutes, capacityPerAgent || 480)
    const non_pointed   = capacityPerAgent > 0 ? Math.max(capacityPerAgent - (a.validated_minutes + a.pending_minutes + a.inprogress_minutes), 0) : 0
    return {
      ...a,
      total_pointed,
      non_pointed,
      // Pour l'affichage
      validated_hours:   minutesToHours(a.validated_minutes),
      pending_hours:     minutesToHours(a.pending_minutes),
      inprogress_hours:  minutesToHours(a.inprogress_minutes),
      non_pointed_hours: minutesToHours(non_pointed),
      // Rétrocompatibilité avec l'ancien champ productive_minutes / non_productive_minutes
      productive_minutes:     total_pointed,
      non_productive_minutes: non_pointed,
      productive_hours:       minutesToHours(total_pointed),
      non_productive_hours:   minutesToHours(non_pointed),
      productive_pct:         capacityPerAgent > 0 ? Math.round((total_pointed / capacityPerAgent) * 100) : 0,
      non_productive_pct:     capacityPerAgent > 0 ? Math.round((non_pointed   / capacityPerAgent) * 100) : 0,
      validated_pct:          capacityPerAgent > 0 ? Math.round((Math.min(a.validated_minutes, capacityPerAgent) / capacityPerAgent) * 100) : 0,
      pending_pct:            capacityPerAgent > 0 ? Math.round((Math.min(a.pending_minutes,   capacityPerAgent) / capacityPerAgent) * 100) : 0,
      is_weekend:             isWeekend
    }
  })

  const totalPointedToday    = agentsTodayMapped.reduce((s: number, a: any) => s + a.total_pointed, 0)
  const totalNonPointedToday = agentsTodayMapped.reduce((s: number, a: any) => s + a.non_pointed, 0)
  const totalValidatedToday  = agentsTodayMapped.reduce((s: number, a: any) => s + Math.min(a.validated_minutes, capacityPerAgent || 480), 0)
  const totalPendingToday    = agentsTodayMapped.reduce((s: number, a: any) => s + Math.min(a.pending_minutes, capacityPerAgent || 480), 0)

  // Calcul distribution % par objectif
  const objData = hoursByObjective.results as any[]
  const totalMinutes = objData.reduce((sum: number, o: any) => sum + o.total_minutes, 0)
  const objectivesWithPct = objData.map((o: any) => ({
    ...o,
    percentage: totalMinutes > 0 ? Math.round((o.total_minutes / totalMinutes) * 100) : 0,
    hours_display: minutesToHours(o.total_minutes)
  }))

  // Normaliser les types 3-3-3
  const normalize333 = (type: string) => {
    if (!type || type === 'Productive' || type === 'Production') return 'Production'
    if (type === 'Non productive' || type === 'Administration & Reporting') return 'Administration & Reporting'
    if (type === 'Contrôle') return 'Contrôle'
    return 'Production'
  }

  // Helper : agréger les données brutes en structure 3-3-3
  const build333Result = (raw: any[], totalField = 'total_minutes') => {
    const map: Record<string, number> = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
    raw.forEach((r: any) => { const k = normalize333(r.type_333); map[k] = (map[k] || 0) + r[totalField] })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map).map(([label, minutes]) => ({
      label, minutes,
      hours_display: minutesToHours(minutes),
      percentage: total > 0 ? Math.round(minutes * 100 / total) : 0
    }))
  }

  // Données 3-3-3 pour mois principal
  const r333Main = await getRatio333ForMonth(month)
  const ratio333Result = build333Result(r333Main.ratio333 as any[])

  // Construire comparaison par département avec capacité mensuelle réelle
  // Capacité = (agents_sans_samedi × wd_std + agents_avec_samedi × wd_sat) × 480 min
  const buildDeptComparison = (raw: any[], capacities: any[], wdStd: number, wdSat: number) => {
    const depts: Record<string, any> = {}
    ;(raw as any[]).forEach((r: any) => {
      if (!depts[r.dept_name]) {
        const cap = (capacities as any[]).find((ci: any) => ci.dept_name === r.dept_name)
        const agentsSat = cap?.agents_with_saturday || 0
        const agentsNoSat = cap?.agents_without_saturday || 0
        // Capacité mixte : agents avec samedi × wd_sat + agents sans samedi × wd_std
        const capacity = (agentsSat * wdSat + agentsNoSat * wdStd) * 480
        depts[r.dept_name] = {
          dept_name: r.dept_name,
          agent_count: cap?.agent_count || 0,
          agents_with_saturday: agentsSat,
          agents_without_saturday: agentsNoSat,
          capacity_minutes: capacity,
          Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
        }
      }
      depts[r.dept_name][normalize333(r.type_333)] += r.total_minutes
    })
    return Object.values(depts).map((d: any) => {
      const total = d.Production + d['Administration & Reporting'] + d['Contrôle']
      const pct = d.capacity_minutes > 0 ? Math.round(total * 100 / d.capacity_minutes) : 0
      return {
        ...d,
        total_minutes: total,
        productive_pct: pct,
        non_productive_pct: Math.max(0, 100 - pct),
        hours_display: minutesToHours(total),
        capacity_hours_display: minutesToHours(d.capacity_minutes)
      }
    })
  }

  // Construire comparaison par agent avec capacité individuelle
  // Chaque agent a sa propre capacité selon works_saturday
  const buildAgentComparison = (raw: any[], wdStd: number, wdSat: number) => {
    const agents: Record<string, any> = {}
    ;(raw as any[]).forEach((r: any) => {
      if (!agents[r.agent_id]) {
        const wd = r.works_saturday ? wdSat : wdStd
        const capacity = wd * 480
        agents[r.agent_id] = {
          agent_name: r.agent_name,
          dept_name: r.dept_name,
          works_saturday: r.works_saturday || 0,
          capacity_minutes: capacity,
          working_days: wd,
          Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0
        }
      }
      agents[r.agent_id][normalize333(r.type_333)] += r.total_minutes
    })
    return Object.values(agents).map((a: any) => {
      const total = a.Production + a['Administration & Reporting'] + a['Contrôle']
      const pct = a.capacity_minutes > 0 ? Math.round(total * 100 / a.capacity_minutes) : 0
      return {
        ...a,
        total_minutes: total,
        productive_pct: pct,
        non_productive_pct: Math.max(0, 100 - pct),
        hours_display: minutesToHours(total),
        capacity_hours_display: minutesToHours(a.capacity_minutes)
      }
    })
  }

  const deptComparison  = buildDeptComparison(r333Main.ratio333ByDept as any[], r333Main.deptCapacity as any[], workingDaysMonth, workingDaysSatMonth)
  const agentComparison = buildAgentComparison(r333Main.ratio333ByAgent as any[], workingDaysMonth, workingDaysSatMonth)

  // Mois 2 pour comparaison (optionnel)
  let ratio333Month2 = null
  let deptComparisonMonth2 = null
  let agentComparisonMonth2 = null
  if (month2 && workingDaysMonth2 && workingDaysSatMonth2) {
    const r333M2 = await getRatio333ForMonth(month2)
    ratio333Month2 = build333Result(r333M2.ratio333 as any[])
    deptComparisonMonth2 = buildDeptComparison(r333M2.ratio333ByDept as any[], r333M2.deptCapacity as any[], workingDaysMonth2, workingDaysSatMonth2)
    agentComparisonMonth2 = buildAgentComparison(r333M2.ratio333ByAgent as any[], workingDaysMonth2, workingDaysSatMonth2)
  }

  return c.json({
    month,
    month2: month2 || null,
    working_days: workingDaysMonth,
    working_days_month2: workingDaysMonth2,
    hoursByObjective: objectivesWithPct,
    hoursByDept: hoursByDept.results,
    monthlyTrend: monthlyTrend.results,
    ratio333: ratio333Result,
    ratio333Month2,
    deptComparison,
    deptComparisonMonth2,
    agentComparison,
    agentComparisonMonth2,
    is_weekend: isWeekend,
    productivity: {
      total_agents:                  totalAgents?.count || 0,
      total_capacity_today:          totalCapacityToday,
      is_weekend:                    isWeekend,
      validated_minutes_today:       totalValidatedToday,
      validated_hours_today:         minutesToHours(totalValidatedToday),
      validated_pct:                 totalCapacityToday > 0 ? Math.round((totalValidatedToday / totalCapacityToday) * 100) : 0,
      pending_minutes_today:         totalPendingToday,
      pending_hours_today:           minutesToHours(totalPendingToday),
      pending_pct:                   totalCapacityToday > 0 ? Math.round((totalPendingToday / totalCapacityToday) * 100) : 0,
      productive_minutes_today:      totalPointedToday,
      non_productive_minutes_today:  totalNonPointedToday,
      productive_hours_today:        minutesToHours(totalPointedToday),
      non_productive_hours_today:    minutesToHours(totalNonPointedToday),
      productive_pct:                totalCapacityToday > 0 ? Math.round((totalPointedToday    / totalCapacityToday) * 100) : 0,
      non_productive_pct:            totalCapacityToday > 0 ? Math.round((totalNonPointedToday / totalCapacityToday) * 100) : 0,
      agents_detail: agentsTodayMapped
    }
  })
  } catch(err: any) {
    console.error('[admin/stats ERROR]', err?.message || err)
    return c.json({ error: 'Erreur serveur', detail: err?.message || String(err) }, 500)
  }
})

// ============================================
// ADMIN - RAPPORTS & EXPORT
// ============================================

app.get('/api/admin/reports', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { date_from, date_to, dept_id, status, export: exportFmt } = c.req.query() as any

  let query = `SELECT ws.*,
     u.first_name || ' ' || u.last_name as agent_name,
     d.name as department_name,
     t.name as task_name,
     p.name as process_name,
     o.name as objective_name,
     o.color as objective_color,
     ws.rejected_reason
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN departments d ON ws.department_id = d.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE 1=1`
  const params: any[] = []
  if (date_from) { query += ' AND date(ws.start_time) >= ?'; params.push(date_from) }
  if (date_to)   { query += ' AND date(ws.start_time) <= ?'; params.push(date_to) }
  if (dept_id)   { query += ' AND ws.department_id = ?';     params.push(dept_id) }
  if (status)    { query += ' AND ws.status = ?';            params.push(status) }
  query += ' ORDER BY ws.start_time DESC'

  let stmt = c.env.DB.prepare(query)
  if (params.length) stmt = stmt.bind(...params)
  const reports = await stmt.all()

  // Export CSV enrichi avec colonnes calculées (productivité, 3-3-3, temps de reporting)
  if (exportFmt === 'csv') {
    const rows = reports.results as any[]

    // Normalisation catégorie 3-3-3
    const normalize333 = (t: string) => {
      if (!t) return 'Production'
      if (t === 'Production' || t === 'Productive') return 'Production'
      if (t === 'Administration & Reporting' || t === 'Non productive') return 'Administration & Reporting'
      if (t === 'Contrôle') return 'Contrôle'
      return 'Production'
    }

    // Agréger par agent pour calculer les % par mois
    // Map : "agent_name|YYYY-MM" → { prod, admin, ctrl, total }
    const agentMonthMap: Record<string, { prod: number, admin: number, ctrl: number, total: number }> = {}
    for (const r of rows as any[]) {
      if (r.status !== 'Validé') continue
      const key = `${r.agent_name}|${(r.start_time || '').slice(0, 7)}`
      if (!agentMonthMap[key]) agentMonthMap[key] = { prod: 0, admin: 0, ctrl: 0, total: 0 }
      const cat = normalize333(r.session_type)
      const dur = r.duration_minutes || 0
      agentMonthMap[key].total += dur
      if (cat === 'Production') agentMonthMap[key].prod += dur
      else if (cat === 'Administration & Reporting') agentMonthMap[key].admin += dur
      else if (cat === 'Contrôle') agentMonthMap[key].ctrl += dur
    }

    const pct = (num: number, den: number) => den > 0 ? (num / den * 100).toFixed(1) + '%' : '0%'
    const hhmm = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return `${h}h ${String(m).padStart(2,'0')}m` }

    const BOM = '\uFEFF'
    const header = 'Agent,Département,Tâche,Processus,Objectif,Date début,Date fin,Durée (min),Heures (hh:mm),Heures (décimal),Catégorie 3-3-3,Mois,Journée,Type,Statut,Motif rejet,% Productif (mois),% Admin-Reporting (mois),% Contrôle (mois),% Non productif (mois),Temps reporting (mois hh:mm)\n'
    const csv = BOM + header + (rows as any[]).map((r: any) => {
      const dur = r.duration_minutes || 0
      const cat = normalize333(r.session_type)
      const mois = (r.start_time || '').slice(0, 7)
      const journee = (r.start_time || '').slice(0, 10)
      const key = `${r.agent_name}|${mois}`
      const am = agentMonthMap[key] || { prod: 0, admin: 0, ctrl: 0, total: 0 }
      const np = Math.max(0, am.total - am.prod - am.admin - am.ctrl)
      return [
        `"${r.agent_name || ''}"`,
        `"${r.department_name || ''}"`,
        `"${r.task_name || ''}"`,
        `"${r.process_name || ''}"`,
        `"${r.objective_name || ''}"`,
        r.start_time || '',
        r.end_time || '',
        dur,
        hhmm(dur),
        (dur / 60).toFixed(2),
        cat,
        mois,
        journee,
        r.session_type || '',
        r.status || '',
        `"${(r.rejected_reason || '').replace(/"/g, '""')}"`,
        pct(am.prod, am.total),
        pct(am.admin, am.total),
        pct(am.ctrl, am.total),
        pct(np, am.total),
        hhmm(am.admin + am.ctrl)
      ].join(',')
    }).join('\n')
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rapports_admin.csv"' } })
  }

  return c.json(reports.results)
})

// ============================================
// ADMIN - JOURNAL D'AUDIT
// ============================================

app.get('/api/admin/audit', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const logs = await c.env.DB.prepare(
    `SELECT al.*, u.first_name || ' ' || u.last_name as user_name, u.last_name || ' ' || u.first_name as user_name_rev
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC LIMIT 100`
  ).all()
  return c.json(logs.results)
})

// ============================================
// AGENT - DASHBOARD
// ============================================

app.get('/api/agent/dashboard', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  const today = new Date().toISOString().split('T')[0]

  // Heures aujourd'hui
  const todayStats = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as today_minutes
     FROM work_sessions WHERE user_id = ? AND date(start_time) = ? AND status IN ('Validé', 'Terminé')`
  ).bind(user.id, today).first() as any

  // Total cumulé
  const totalStats = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
     FROM work_sessions WHERE user_id = ? AND status IN ('Validé', 'Terminé')`
  ).bind(user.id).first() as any

  // Sessions totales et rejetées
  const sessionStats = await c.env.DB.prepare(
    `SELECT COUNT(*) as total, 
     SUM(CASE WHEN status = 'Rejeté' THEN 1 ELSE 0 END) as rejected
     FROM work_sessions WHERE user_id = ?`
  ).bind(user.id).first() as any

  // Répartition par objectif
  const byObjective = await c.env.DB.prepare(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.user_id = ? AND ws.status IN ('Validé', 'Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color
     HAVING total_minutes > 0
     ORDER BY total_minutes DESC`
  ).bind(user.id).all()

  const objData = byObjective.results as any[]
  const totalMin = objData.reduce((sum: number, o: any) => sum + o.total_minutes, 0)
  const objectivesWithPct = objData.map((o: any) => ({
    ...o,
    percentage: totalMin > 0 ? Math.round((o.total_minutes / totalMin) * 100) : 0,
    hours_display: minutesToHours(o.total_minutes)
  }))

  // ── Méthode 3-3-3 pour l'agent ──
  const ratio333Agent = await c.env.DB.prepare(
    `SELECT COALESCE(t.task_type, 'Production') as type_333,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM work_sessions ws
     LEFT JOIN tasks t ON ws.task_id = t.id
     WHERE ws.user_id = ? AND ws.status IN ('Validé', 'Terminé')
     GROUP BY COALESCE(t.task_type, 'Production')`
  ).bind(user.id).all()
  const ratio333AgentData = ratio333Agent.results as any[]
  const total333Agent = ratio333AgentData.reduce((s: number, r: any) => s + r.total_minutes, 0)
  const norm333 = (t: string) => {
    if (!t || t === 'Productive' || t === 'Production') return 'Production'
    if (t === 'Non productive' || t === 'Administration & Reporting') return 'Administration & Reporting'
    return 'Contrôle'
  }
  const map333Agent: Record<string, number> = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
  ratio333AgentData.forEach((r: any) => { const k = norm333(r.type_333); map333Agent[k] = (map333Agent[k]||0) + r.total_minutes })
  const ratio333AgentResult = Object.entries(map333Agent).map(([type, minutes]) => ({
    type, minutes,
    hours_display: minutesToHours(minutes),
    percentage: total333Agent > 0 ? Math.round((minutes / total333Agent) * 100) : 0
  }))

  return c.json({
    today_minutes: todayStats?.today_minutes || 0,
    today_hours: minutesToHours(todayStats?.today_minutes || 0),
    total_minutes: totalStats?.total_minutes || 0,
    total_hours: minutesToHours(totalStats?.total_minutes || 0),
    total_sessions: sessionStats?.total || 0,
    rejected_sessions: sessionStats?.rejected || 0,
    byObjective: objectivesWithPct,
    ratio333: ratio333AgentResult
  })
})

// ============================================
// AGENT - TÂCHES DISPONIBLES
// ============================================

app.get('/api/agent/tasks', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  const tasks = await c.env.DB.prepare(
    `SELECT t.*, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON t.objective_id = o.id
     WHERE t.department_id = ? AND t.status = 'Actif'
     ORDER BY o.name, t.name`
  ).bind(user.department_id).all()

  return c.json(tasks.results)
})

// ============================================
// AGENT - SESSIONS
// ============================================

app.get('/api/agent/sessions', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  const sessions = await c.env.DB.prepare(
    `SELECT ws.*, t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.user_id = ?
     ORDER BY ws.start_time DESC`
  ).bind(user.id).all()

  return c.json(sessions.results)
})

// Session en cours
app.get('/api/agent/sessions/active', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  const session = await c.env.DB.prepare(
    `SELECT ws.*, t.name as task_name, o.name as objective_name
     FROM work_sessions ws
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.user_id = ? AND ws.status = 'En cours'
     LIMIT 1`
  ).bind(user.id).first()

  return c.json(session || null)
})

// Démarrer une session (chronomètre)
app.post('/api/agent/sessions/start', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  try {
    const { task_id } = await c.req.json()

    // Vérifier qu'il n'y a pas de session en cours
    const active = await c.env.DB.prepare(
      'SELECT id FROM work_sessions WHERE user_id = ? AND status = "En cours"'
    ).bind(user.id).first()
    if (active) return c.json({ error: 'Une session est déjà en cours' }, 400)

    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(task_id).first() as any
    if (!task) return c.json({ error: 'Tâche non trouvée' }, 404)

    const result = await c.env.DB.prepare(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, session_type, status) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, "Auto", "En cours")'
    ).bind(user.id, task_id, task.objective_id, user.department_id).run()

    return c.json({ id: result.meta.last_row_id, message: 'Session démarrée' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Arrêter une session
app.post('/api/agent/sessions/stop', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  try {
    const active = await c.env.DB.prepare(
      'SELECT * FROM work_sessions WHERE user_id = ? AND status = "En cours"'
    ).bind(user.id).first() as any

    if (!active) return c.json({ error: 'Aucune session en cours' }, 400)

    const startTime = new Date(active.start_time)
    const endTime = new Date()
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    // — Limite : session > 8h (480 min) = probablement un oubli, on plafonne à 8h
    const MAX_SESSION_MINUTES = 480
    const finalDuration = Math.min(durationMinutes, MAX_SESSION_MINUTES)
    const wasAutoStopped = durationMinutes > MAX_SESSION_MINUTES

    await c.env.DB.prepare(
      'UPDATE work_sessions SET end_time=CURRENT_TIMESTAMP, duration_minutes=?, status="Terminé", updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(finalDuration, active.id).run()

    // Log d’audit si session anom ale (> 8h)
    if (wasAutoStopped) {
      await c.env.DB.prepare(
        'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
      ).bind(user.id, 'SESSION_ANOMALIE', `Session ID ${active.id} plafonnée à 8h (durée réelle: ${durationMinutes} min)`).run()
    }

    return c.json({
      message: wasAutoStopped
        ? `Session arrêtée. Durée plafonnée à 8h (durée réelle : ${Math.floor(durationMinutes/60)}h${durationMinutes%60}m)`
        : 'Session arrêtée',
      duration_minutes: finalDuration,
      was_auto_stopped: wasAutoStopped
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Saisie manuelle d'une session
app.post('/api/agent/sessions/manual', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  try {
    const { task_id, start_time, end_time, comment } = await c.req.json()
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(task_id).first() as any
    if (!task) return c.json({ error: 'Tâche non trouvée' }, 404)

    const start = new Date(start_time)
    const end = new Date(end_time)
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)

    if (durationMinutes < 0) return c.json({ error: 'La date de fin doit être après la date de début' }, 400)
    // Limite saisie manuelle : max 8h par session
    if (durationMinutes > 480) return c.json({ error: 'Une session ne peut pas dépasser 8h (480 min). Divisez en plusieurs sessions.' }, 400)

    const result = await c.env.DB.prepare(
      'INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, end_time, duration_minutes, session_type, status, comment) VALUES (?, ?, ?, ?, ?, ?, ?, "Manuelle", "Terminé", ?)'
    ).bind(user.id, task_id, task.objective_id, user.department_id, start_time, end_time, durationMinutes, comment || '').run()

    return c.json({ id: result.meta.last_row_id, message: 'Session enregistrée' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============================================
// AGENT - STATISTIQUES
// ============================================

app.get('/api/agent/stats', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  const today = new Date().toISOString().split('T')[0]

  // KPIs
  const todayMin = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND date(start_time)=? AND status IN ('Validé','Terminé')`
  ).bind(user.id, today).first() as any

  const totalMin = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`
  ).bind(user.id).first() as any

  const validatedMin = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions WHERE user_id=? AND status='Validé'`
  ).bind(user.id).first() as any

  const totalSessions = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM work_sessions WHERE user_id=?`
  ).bind(user.id).first() as any

  // Par objectif
  const byObjective = await c.env.DB.prepare(
    `SELECT o.name, o.color, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes,
     COUNT(ws.id) as session_count
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.user_id = ? AND ws.status IN ('Validé','Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color
     ORDER BY total_minutes DESC`
  ).bind(user.id).all()

  const objData = byObjective.results as any[]
  const totalM = objData.reduce((sum: number, o: any) => sum + o.total_minutes, 0)

  return c.json({
    today_hours: minutesToHours(todayMin?.m || 0),
    total_hours: minutesToHours(totalMin?.m || 0),
    validated_hours: minutesToHours(validatedMin?.m || 0),
    total_sessions: totalSessions?.c || 0,
    byObjective: objData.map((o: any) => ({
      ...o,
      percentage: totalM > 0 ? Math.round((o.total_minutes / totalM) * 100) : 0,
      hours_display: minutesToHours(o.total_minutes)
    }))
  })
})

// ============================================
// CHEF - DASHBOARD
// ============================================

app.get('/api/chef/dashboard', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const deptId = user.department_id
  const month = (c.req.query('month') || new Date().toISOString().slice(0,7)) as string
  const month2 = c.req.query('month2') as string | undefined
  const CIBLES = { 'Production': 70, 'Administration & Reporting': 20, 'Contrôle': 10 }

  const normalize333 = (t: string) => {
    if (!t || t === 'Productive' || t === 'Production') return 'Production'
    if (t === 'Non productive' || t === 'Administration & Reporting') return 'Administration & Reporting'
    return 'Contrôle'
  }

  // Agents actifs dans le département aujourd'hui
  const activeAgents = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as count FROM work_sessions 
     WHERE department_id = ? AND date(start_time) = date('now')`
  ).bind(deptId).first() as any

  // Total heures équipe pour le mois sélectionné
  const totalTeamHours = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions 
     WHERE department_id = ? AND strftime('%Y-%m', start_time) = ? AND status IN ('Validé','Terminé')`
  ).bind(deptId, month).first() as any

  // Sessions à valider
  const toValidate = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM work_sessions WHERE department_id = ? AND status = 'Terminé'`
  ).bind(deptId).first() as any

  // Heures par agent pour le mois sélectionné
  const hoursByAgent = await c.env.DB.prepare(
    `SELECT u.first_name || ' ' || u.last_name as agent_name,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND ws.status IN ('Validé','Terminé')
       AND strftime('%Y-%m', ws.start_time) = ?
     WHERE u.department_id = ? AND u.role IN ('Agent','Chef de Service') AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(month, deptId).all()

  // Détail par agent
  const agentDetail = await c.env.DB.prepare(
    `SELECT u.id, u.first_name || ' ' || u.last_name as agent_name,
     COUNT(ws.id) as total_sessions,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END) * 100.0 / NULLIF(SUM(ws.duration_minutes), 0), 0) as pct_validated
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND strftime('%Y-%m', ws.start_time) = ?
     WHERE u.department_id = ? AND u.role IN ('Agent','Chef de Service') AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(month, deptId).all()

  // Weekend check
  const todayDowChef = new Date().getDay()
  const isWeekendChef = todayDowChef === 0 || todayDowChef === 6
  const capPerAgentChef = isWeekendChef ? 0 : 480

  // Productivité aujourd'hui par agent
  const agentProductivityToday = await c.env.DB.prepare(
    `SELECT u.id,
       u.first_name || ' ' || u.last_name as agent_name,
       COALESCE(SUM(CASE WHEN ws.status = 'Validé'     THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes_today,
       COALESCE(SUM(CASE WHEN ws.status = 'En attente' THEN ws.duration_minutes ELSE 0 END), 0) as pending_minutes_today,
       COALESCE(SUM(CASE WHEN ws.status = 'En cours'   THEN ws.duration_minutes ELSE 0 END), 0) as inprogress_minutes_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
       AND date(ws.start_time) = date('now')
       AND ws.status IN ('Validé', 'En attente', 'En cours')
     WHERE u.department_id = ? AND u.role IN ('Agent','Chef de Service') AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(deptId).all()

  // 3-3-3 par mois pour le département
  async function get333ForMonth(m: string) {
    const raw = await c.env.DB.prepare(
      `SELECT u.first_name||' '||u.last_name as agent_name, u.id as agent_id,
       COALESCE(t.task_type,'Production') as type_333,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM work_sessions ws
       LEFT JOIN tasks t ON ws.task_id=t.id
       LEFT JOIN users u ON ws.user_id=u.id
       WHERE ws.department_id=? AND ws.status IN ('Validé','En attente','En cours')
         AND strftime('%Y-%m',ws.start_time)=?
       GROUP BY u.id, u.first_name, u.last_name, COALESCE(t.task_type,'Production')`
    ).bind(deptId, m).all()

    // Agréger par agent
    const agentMap: Record<string, any> = {}
    ;(raw.results as any[]).forEach((r: any) => {
      if (!agentMap[r.agent_id]) agentMap[r.agent_id] = { agent_name: r.agent_name, Production: 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
      agentMap[r.agent_id][normalize333(r.type_333)] += r.total_minutes
    })
    const agentRows = Object.values(agentMap).map((a: any) => {
      const total = a.Production + a['Administration & Reporting'] + a['Contrôle']
      return { ...a, total_minutes: total, capacity_minutes: 480, hours_display: minutesToHours(total) }
    })

    // Global dept
    const globalMap: Record<string, number> = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
    ;(raw.results as any[]).forEach((r: any) => { const k = normalize333(r.type_333); globalMap[k] += r.total_minutes })
    const globalTotal = Object.values(globalMap).reduce((s, v) => s + v, 0)
    const global333 = Object.entries(globalMap).map(([label, minutes]) => ({
      label, minutes, hours_display: minutesToHours(minutes),
      percentage: globalTotal > 0 ? Math.round(minutes * 100 / globalTotal) : 0,
      cible: (CIBLES as any)[label] || 0,
      ecart: (globalTotal > 0 ? Math.round(minutes * 100 / globalTotal) : 0) - ((CIBLES as any)[label] || 0)
    }))
    return { global333, agentRows }
  }

  const r333Main = await get333ForMonth(month)
  let r333Month2 = null
  if (month2) r333Month2 = await get333ForMonth(month2)

  const objData: any[] = []
  const totalMin = 0

  // Fusionner agentDetail avec productivité du jour
  const productivityMap: any = {}
  for (const p of (agentProductivityToday.results as any[])) { productivityMap[p.id] = p }
  const nbAgents = (agentDetail.results as any[]).length
  const totalValidatedTeam  = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.validated_minutes_today, capPerAgentChef || 480), 0)
  const totalPendingTeam    = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.pending_minutes_today, capPerAgentChef || 480), 0)
  const totalInprogressTeam = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.inprogress_minutes_today, capPerAgentChef || 480), 0)
  const totalPointedTeam    = Math.min(totalValidatedTeam + totalPendingTeam + totalInprogressTeam, nbAgents * (capPerAgentChef || 480))
  const totalNonPointedTeam = capPerAgentChef > 0 ? Math.max(nbAgents * capPerAgentChef - totalPointedTeam, 0) : 0

  return c.json({
    month, month2: month2 || null,
    active_agents: activeAgents?.count || 0,
    total_team_hours: minutesToHours(totalTeamHours?.m || 0),
    to_validate: toValidate?.c || 0,
    is_weekend: isWeekendChef,
    hoursByAgent: hoursByAgent.results,
    byObjective: objData,
    ratio333: r333Main.global333,
    ratio333Month2: r333Month2 ? r333Month2.global333 : null,
    agentComparison: r333Main.agentRows,
    agentComparisonMonth2: r333Month2 ? r333Month2.agentRows : null,
    agentDetail: (agentDetail.results as any[]).map((a: any) => {
      const p = productivityMap[a.id] || { validated_minutes_today: 0, pending_minutes_today: 0, inprogress_minutes_today: 0 }
      const cap = capPerAgentChef || 480
      const total_pointed = Math.min(p.validated_minutes_today + p.pending_minutes_today + p.inprogress_minutes_today, cap)
      const non_pointed = capPerAgentChef > 0 ? Math.max(cap - total_pointed, 0) : 0
      return {
        ...a,
        total_hours: minutesToHours(a.total_minutes),
        validated_hours: minutesToHours(a.validated_minutes),
        validated_minutes_today: Math.min(p.validated_minutes_today, cap),
        pending_minutes_today: Math.min(p.pending_minutes_today, cap),
        inprogress_minutes_today: Math.min(p.inprogress_minutes_today, cap),
        non_pointed_today: non_pointed,
        productive_minutes_today: total_pointed,
        non_productive_minutes_today: non_pointed,
        productive_pct_today: cap > 0 ? Math.round((total_pointed / cap) * 100) : 0,
        is_weekend: isWeekendChef
      }
    }),
    team_productivity: {
      total_agents: nbAgents, is_weekend: isWeekendChef,
      validated_hours_today: minutesToHours(totalValidatedTeam),
      productive_hours_today: minutesToHours(totalPointedTeam),
      non_productive_hours_today: minutesToHours(totalNonPointedTeam),
      productive_pct: nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalPointedTeam / (nbAgents * capPerAgentChef)) * 100) : 0,
      non_productive_pct: nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalNonPointedTeam / (nbAgents * capPerAgentChef)) * 100) : 0
    }
  })
})

// ============================================
// CHEF - LIVE (statut temps réel des agents)
// ============================================

app.get('/api/chef/live', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }
  const deptId = user.department_id
  const todayDow = new Date().getDay()
  const isWeekend = todayDow === 0 || todayDow === 6

  // Statut détaillé de chaque agent pour AUJOURD'HUI
  const liveData = await c.env.DB.prepare(
    `SELECT
       u.id, u.first_name || ' ' || u.last_name as agent_name,
       u.works_saturday,
       -- Session EN COURS maintenant
       MAX(CASE WHEN ws.status = 'En cours' THEN 1 ELSE 0 END) as is_active_now,
       -- Tâche en cours
       MAX(CASE WHEN ws.status = 'En cours' THEN t.name ELSE NULL END) as current_task,
       MAX(CASE WHEN ws.status = 'En cours' THEN t.task_type ELSE NULL END) as current_task_type,
       MAX(CASE WHEN ws.status = 'En cours' THEN ws.start_time ELSE NULL END) as session_start,
       -- Totaux du jour
       COALESCE(SUM(CASE WHEN ws.status = 'Validé'     THEN ws.duration_minutes ELSE 0 END), 0) as validated_min,
       COALESCE(SUM(CASE WHEN ws.status = 'En attente' THEN ws.duration_minutes ELSE 0 END), 0) as pending_min,
       COALESCE(SUM(CASE WHEN ws.status = 'En cours'   THEN ws.duration_minutes ELSE 0 END), 0) as inprogress_min,
       COUNT(CASE WHEN ws.status IN ('Validé','En attente','Terminé') THEN 1 END) as sessions_done_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
       AND date(ws.start_time) = date('now')
       AND ws.status IN ('Validé', 'En attente', 'En cours', 'Terminé')
     LEFT JOIN tasks t ON ws.task_id = t.id
     WHERE u.department_id = ? AND u.role IN ('Agent','Chef de Service') AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name, u.works_saturday
     ORDER BY u.last_name`
  ).bind(deptId).all()

  const agents = (liveData.results as any[]).map((a: any) => {
    const totalPointed = a.validated_min + a.pending_min + a.inprogress_min
    const cap = isWeekend ? 0 : 480
    const nonPointed = cap > 0 ? Math.max(cap - totalPointed, 0) : 0
    const pct = cap > 0 ? Math.round(totalPointed * 100 / cap) : 0

    // Statut live
    let liveStatus = 'not_started'
    if (isWeekend) liveStatus = 'weekend'
    else if (a.is_active_now) liveStatus = 'working'
    else if (totalPointed > 0) liveStatus = 'paused'

    return {
      ...a,
      live_status: liveStatus,
      total_pointed_min: totalPointed,
      total_pointed_hours: minutesToHours(totalPointed),
      non_pointed_min: nonPointed,
      non_pointed_hours: minutesToHours(nonPointed),
      productive_pct: pct,
      capacity_min: cap
    }
  })

  const summary = {
    total: agents.length,
    working_now: agents.filter((a: any) => a.live_status === 'working').length,
    paused: agents.filter((a: any) => a.live_status === 'paused').length,
    not_started: agents.filter((a: any) => a.live_status === 'not_started').length,
    is_weekend: isWeekend
  }

  return c.json({ agents, summary, is_weekend: isWeekend })
})

// ============================================
// CHEF - ÉQUIPE
// ============================================

app.get('/api/chef/team', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const today = new Date().toISOString().split('T')[0]
  const members = await c.env.DB.prepare(
    `SELECT u.*,
     COALESCE(SUM(CASE WHEN date(ws.start_time) = ? THEN 1 ELSE 0 END), 0) as today_sessions,
     COALESCE(SUM(CASE WHEN date(ws.start_time) = ? THEN ws.duration_minutes ELSE 0 END), 0) as today_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND ws.status IN ('Validé','Terminé')
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id`
  ).bind(today, today, user.department_id).all()

  return c.json((members.results as any[]).map((m: any) => ({
    ...m,
    today_hours: minutesToHours(m.today_minutes),
    password_hash: undefined
  })))
})

// ============================================
// CHEF - VALIDATION
// ============================================

app.get('/api/chef/validation', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const sessions = await c.env.DB.prepare(
    `SELECT ws.*, u.first_name || ' ' || u.last_name as agent_name,
     t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.department_id = ? AND ws.status = 'Terminé'
     ORDER BY ws.start_time DESC`
  ).bind(user.department_id).all()

  return c.json(sessions.results)
})

app.post('/api/chef/validate/:id', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const id = c.req.param('id')
  await c.env.DB.prepare(
    'UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(user.id, id).run()

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'VALIDATION', `Session #${id} validée`).run()

  return c.json({ message: 'Session validée' })
})

app.post('/api/chef/reject/:id', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as any
  await c.env.DB.prepare(
    'UPDATE work_sessions SET status="Rejeté", rejected_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(body.reason || '', id).run()

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'REJET', `Session #${id} rejetée`).run()

  return c.json({ message: 'Session rejetée' })
})

app.post('/api/chef/validate-all', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  await c.env.DB.prepare(
    'UPDATE work_sessions SET status="Validé", validated_by=?, validated_at=CURRENT_TIMESTAMP WHERE department_id=? AND status="Terminé"'
  ).bind(user.id, user.department_id).run()

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'VALIDATION', `Validation groupée de toutes les sessions du département`).run()

  return c.json({ message: 'Toutes les sessions validées' })
})

// ============================================
// CHEF - RAPPORTS
// ============================================

app.get('/api/chef/reports', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }

  const reports = await c.env.DB.prepare(
    `SELECT ws.*, u.first_name || ' ' || u.last_name as agent_name,
     t.name as task_name, p.name as process_name,
     o.name as objective_name, o.color as objective_color
     FROM work_sessions ws
     JOIN users u ON ws.user_id = u.id
     JOIN tasks t ON ws.task_id = t.id
     JOIN processes p ON t.process_id = p.id
     JOIN strategic_objectives o ON ws.objective_id = o.id
     WHERE ws.department_id = ?
     ORDER BY ws.start_time DESC`
  ).bind(user.department_id).all()

  return c.json(reports.results)
})

// ============================================
// NOTIFICATIONS (polling agent + chef)
// ============================================

app.get('/api/notifications', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Non autorisé' }, 401)

  // Convertir la date ISO du frontend (2026-04-01T16:00:00.000Z)
  // en format comparable avec les dates SQLite (2026-04-01 16:34:33)
  // On remplace T par espace et on coupe les millisecondes/Z
  const rawSince = c.req.query('since') || '1970-01-01T00:00:00.000Z'
  const since = rawSince.replace('T', ' ').replace('Z', '').split('.')[0]

  try {
    if (user.role === 'Agent') {
      // L'agent reçoit les changements de statut de ses sessions (Validé / Rejeté)
      const rows = await c.env.DB.prepare(
        `SELECT ws.id, ws.status, ws.rejected_reason, t.name as task_name
         FROM work_sessions ws
         JOIN tasks t ON ws.task_id = t.id
         WHERE ws.user_id = ?
           AND ws.status IN ('Validé', 'Rejeté')
           AND ws.updated_at > ?
         ORDER BY ws.updated_at DESC
         LIMIT 20`
      ).bind(user.id, since).all()
      return c.json(rows.results)
    }

    if (user.role === 'Chef de Département') {
      // Le chef reçoit les nouvelles sessions terminées en attente de validation
      const rows = await c.env.DB.prepare(
        `SELECT ws.id, ws.status, t.name as task_name,
                u.first_name || ' ' || u.last_name as agent_name
         FROM work_sessions ws
         JOIN tasks t ON ws.task_id = t.id
         JOIN users u ON ws.user_id = u.id
         WHERE ws.department_id = ?
           AND ws.status = 'Terminé'
           AND ws.updated_at > ?
         ORDER BY ws.updated_at DESC
         LIMIT 20`
      ).bind(user.department_id, since).all()
      return c.json(rows.results)
    }

    // Administrateur : aucune notification polling nécessaire
    return c.json([])
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ============================================
// API CHEF DE SERVICE
// ============================================

app.get('/api/chef-service/dashboard', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Service' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }
  const deptId = user.department_id
  try {
    const todayMin = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND date(start_time)=date('now')`
    ).bind(user.id).first() as any
    const totalMin = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions WHERE user_id=? AND status IN ('Validé','Terminé')`
    ).bind(user.id).first() as any
    const sessionStats = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status='Rejeté' THEN 1 ELSE 0 END) as rejected FROM work_sessions WHERE user_id=?`
    ).bind(user.id).first() as any
    // Team members: agents in same dept
    const team = await c.env.DB.prepare(
      `SELECT u.id, u.first_name || ' ' || u.last_name as name, u.role,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes,
       COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes,
       COUNT(ws.id) as total_sessions
       FROM users u
       LEFT JOIN work_sessions ws ON ws.user_id=u.id
       WHERE u.department_id=? AND u.role='Agent' AND u.status='Actif'
       GROUP BY u.id, u.first_name, u.last_name`
    ).bind(deptId).all()
    const byObjective = await c.env.DB.prepare(
      `SELECT o.name, o.color,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM strategic_objectives o
       LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.user_id=?
       WHERE o.status='Actif'
       GROUP BY o.id, o.name, o.color HAVING total_minutes>0`
    ).bind(user.id).all()
    return c.json({
      today_hours: minutesToHours(todayMin?.m || 0),
      total_hours: minutesToHours(totalMin?.m || 0),
      total_sessions: sessionStats?.total || 0,
      rejected_sessions: sessionStats?.rejected || 0,
      team: team.results,
      byObjective: byObjective.results
    })
  } catch(e: any) { return c.json({ error: e.message }, 500) }
})

app.get('/api/chef-service/tasks', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Chef de Service' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }
  const tasks = await c.env.DB.prepare(
    `SELECT t.*, p.name as process_name, o.name as objective_name, o.color as objective_color
     FROM tasks t JOIN processes p ON t.process_id=p.id JOIN strategic_objectives o ON t.objective_id=o.id
     WHERE t.department_id=? AND t.status='Actif' ORDER BY t.name`
  ).bind(user.department_id).all()
  return c.json(tasks.results)
})

app.get('/api/chef-service/sessions', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Chef de Service') return c.json({ error: 'Non autorisé' }, 401)
  const sessions = await c.env.DB.prepare(
    `SELECT ws.*, t.name as task_name, o.name as objective_name, o.color as objective_color
     FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN strategic_objectives o ON ws.objective_id=o.id
     WHERE ws.user_id=? ORDER BY ws.start_time DESC LIMIT 50`
  ).bind(user.id).all()
  return c.json(sessions.results)
})

app.get('/api/chef-service/sessions/active', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Chef de Service') return c.json({ error: 'Non autorisé' }, 401)
  const session = await c.env.DB.prepare(
    `SELECT ws.*, t.name as task_name FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id
     WHERE ws.user_id=? AND ws.status='En cours' ORDER BY ws.start_time DESC LIMIT 1`
  ).bind(user.id).first()
  return c.json(session || null)
})

app.post('/api/chef-service/sessions/start', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Chef de Service') return c.json({ error: 'Non autorisé' }, 401)
  try {
    const { task_id } = await c.req.json()
    const existing = await c.env.DB.prepare(
      `SELECT id FROM work_sessions WHERE user_id=? AND status='En cours'`
    ).bind(user.id).first()
    if (existing) return c.json({ error: 'Une session est déjà en cours. Terminez-la d\'abord.' }, 400)
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(task_id).first() as any
    if (!task) return c.json({ error: 'Tâche introuvable' }, 404)
    const result = await c.env.DB.prepare(
      `INSERT INTO work_sessions (user_id, task_id, objective_id, department_id, start_time, status, session_type)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'En cours', 'Auto')`
    ).bind(user.id, task_id, task.objective_id, user.department_id).run()
    return c.json({ id: result.meta.last_row_id, message: 'Session démarrée' })
  } catch(e: any) { return c.json({ error: e.message }, 500) }
})

app.post('/api/chef-service/sessions/stop', async (c) => {
  const user = await getUser(c)
  if (!user || user.role !== 'Chef de Service') return c.json({ error: 'Non autorisé' }, 401)
  try {
    const { comment } = await c.req.json().catch(() => ({ comment: '' }))
    const session = await c.env.DB.prepare(
      `SELECT * FROM work_sessions WHERE user_id=? AND status='En cours' ORDER BY start_time DESC LIMIT 1`
    ).bind(user.id).first() as any
    if (!session) return c.json({ error: 'Aucune session en cours' }, 404)
    const startTime = new Date(session.start_time).getTime()
    const durationMinutes = Math.round((Date.now() - startTime) / 60000)
    await c.env.DB.prepare(
      `UPDATE work_sessions SET end_time=CURRENT_TIMESTAMP, duration_minutes=?, status='Terminé', comment=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).bind(durationMinutes, comment || null, session.id).run()
    return c.json({ message: 'Session terminée', duration_minutes: durationMinutes })
  } catch(e: any) { return c.json({ error: e.message }, 500) }
})

// ============================================
// API DIRECTEUR DE DÉPARTEMENT
// ============================================

app.get('/api/dir-dept/dashboard', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Directeur de Département' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }
  const deptId = user.department_id
  try {
    const dept = await c.env.DB.prepare('SELECT name FROM departments WHERE id=?').bind(deptId).first() as any
    const activeAgents = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM work_sessions WHERE department_id=? AND date(start_time)=date('now')`
    ).bind(deptId).first() as any
    const totalHours = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions
       WHERE department_id=? AND strftime('%Y-%m',start_time)=strftime('%Y-%m','now') AND status IN ('Validé','Terminé')`
    ).bind(deptId).first() as any
    const toValidate = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM work_sessions WHERE department_id=? AND status='Terminé'`
    ).bind(deptId).first() as any
    const byObjective = await c.env.DB.prepare(
      `SELECT o.name, o.color, o.target_percentage,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM strategic_objectives o
       LEFT JOIN work_sessions ws ON ws.objective_id=o.id AND ws.department_id=? AND ws.status IN ('Validé','Terminé')
       WHERE o.status='Actif'
       GROUP BY o.id, o.name, o.color, o.target_percentage HAVING total_minutes>0`
    ).bind(deptId).all()
    const agentPerf = await c.env.DB.prepare(
      `SELECT u.first_name || ' ' || u.last_name as name, u.role,
       COUNT(ws.id) as sessions,
       COALESCE(SUM(ws.duration_minutes),0) as total_minutes,
       COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END),0) as validated_minutes
       FROM users u
       LEFT JOIN work_sessions ws ON ws.user_id=u.id AND ws.status IN ('Validé','Terminé')
       WHERE u.department_id=? AND u.role IN ('Agent','Chef de Service') AND u.status='Actif'
       GROUP BY u.id ORDER BY total_minutes DESC`
    ).bind(deptId).all()
    const recentSessions = await c.env.DB.prepare(
      `SELECT ws.*, u.first_name || ' ' || u.last_name as agent_name, t.name as task_name, o.name as objective_name
       FROM work_sessions ws JOIN users u ON ws.user_id=u.id JOIN tasks t ON ws.task_id=t.id JOIN strategic_objectives o ON ws.objective_id=o.id
       WHERE ws.department_id=? ORDER BY ws.start_time DESC LIMIT 20`
    ).bind(deptId).all()
    const totalMin = totalHours?.m || 0
    const objData = byObjective.results as any[]
    const grandTotal = objData.reduce((s: number, o: any) => s + o.total_minutes, 0)
    return c.json({
      department_name: dept?.name || '',
      active_agents: activeAgents?.c || 0,
      total_hours: minutesToHours(totalMin),
      to_validate: toValidate?.c || 0,
      byObjective: objData.map((o: any) => ({
        ...o,
        percentage: grandTotal > 0 ? Math.round(o.total_minutes * 100 / grandTotal) : 0,
        hours_display: minutesToHours(o.total_minutes)
      })),
      agentPerf: agentPerf.results,
      recentSessions: recentSessions.results
    })
  } catch(e: any) { return c.json({ error: e.message }, 500) }
})

// ============================================
// API DIRECTEUR GÉNÉRAL
// ============================================

app.get('/api/dg/dashboard', async (c) => {
  const user = await getUser(c)
  if (!user || (user.role !== 'Directeur Général' && user.role !== 'Administrateur')) {
    return c.json({ error: 'Non autorisé' }, 401)
  }
  try {
    const month  = (c.req.query('month')  || new Date().toISOString().slice(0,7)) as string
    const month2 = c.req.query('month2') as string | undefined
    const STATUSES = `ws.status IN ('Validé','Terminé')`
    const mf = (m: string) => `strftime('%Y-%m',ws.start_time)='${m}'`

    // Calculer les jours ouvrés pour les mois DG (identique à la fonction admin)
    const calcDgWorkingDays = (monthStr: string, includeSaturday: boolean): number => {
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
    const dgWdStd  = calcDgWorkingDays(month, false)
    const dgWdSat  = calcDgWorkingDays(month, true)
    const dgWdStd2 = month2 ? calcDgWorkingDays(month2, false) : null
    const dgWdSat2 = month2 ? calcDgWorkingDays(month2, true) : null

    const totalUsers = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM users WHERE status='Actif' AND role NOT IN ('Administrateur','Directeur Général')`
    ).first() as any
    const totalHoursMonth = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(duration_minutes),0) as m FROM work_sessions ws
       WHERE ${STATUSES} AND ${mf(month)}`
    ).first() as any
    const toValidate = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM work_sessions WHERE status='Terminé'`
    ).first() as any

    // ── Capacité par département (nombre d'agents actifs + distinction samedi)
    const deptCap = await c.env.DB.prepare(
      `SELECT d.name as dept_name, COUNT(u.id) as agent_count,
       SUM(CASE WHEN u.works_saturday=1 THEN 1 ELSE 0 END) as agents_with_saturday,
       SUM(CASE WHEN u.works_saturday=0 THEN 1 ELSE 0 END) as agents_without_saturday
       FROM departments d
       LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif' AND u.role IN ('Agent','Chef de Service')
       WHERE d.status='Actif' GROUP BY d.id, d.name`
    ).all()

    // ── Ratio 3-3-3 par mois pour DG (avec capacité mensuelle réelle)
    async function getDgRatio333(m: string, wdStd: number, wdSat: number) {
      const raw333 = await c.env.DB.prepare(
        `SELECT COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id
         WHERE ${STATUSES} AND ${mf(m)} GROUP BY t.task_type`
      ).all()
      const raw333Dept = await c.env.DB.prepare(
        `SELECT d.name as dept_name, COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN departments d ON ws.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)} GROUP BY d.id, t.task_type`
      ).all()
      const raw333Agent = await c.env.DB.prepare(
        `SELECT ws.user_id as agent_id, u.first_name||' '||u.last_name as agent_name, d.name as dept_name,
         u.works_saturday,
         COALESCE(t.task_type,'Production') as type_333, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
         FROM work_sessions ws JOIN tasks t ON ws.task_id=t.id JOIN users u ON ws.user_id=u.id JOIN departments d ON ws.department_id=d.id
         WHERE ${STATUSES} AND ${mf(m)} GROUP BY ws.user_id, t.task_type`
      ).all()

      // Normaliser
      const norm = (t: string) => {
        if (!t || t==='Productive' || t==='Production') return 'Production'
        if (t.includes('Admin') || t.includes('Reporting')) return 'Administration & Reporting'
        if (t.includes('Contr')) return 'Contrôle'
        return t
      }

      // Ratio global
      const gMap: Record<string,number> = { 'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0 }
      ;(raw333.results as any[]).forEach((r: any) => { const k=norm(r.type_333); gMap[k]=(gMap[k]||0)+r.total_minutes })
      const gTotal = Object.values(gMap).reduce((s,v)=>s+v,0)
      const ratio333 = Object.entries(gMap).map(([label,minutes])=>({ label, minutes, percentage: gTotal>0?Math.round(minutes*100/gTotal):0, hours_display: minutesToHours(minutes) }))

      // Par département (capacité mensuelle réelle : agents_sat × wdSat + agents_no_sat × wdStd) × 480
      const dMap: Record<string,any> = {}
      const caps = deptCap.results as any[]
      ;(raw333Dept.results as any[]).forEach((r: any) => {
        if (!dMap[r.dept_name]) {
          const cap = caps.find((ci:any)=>ci.dept_name===r.dept_name)
          const agSat = cap?.agents_with_saturday || 0
          const agNoSat = cap?.agents_without_saturday || 0
          const capacity = (agSat * wdSat + agNoSat * wdStd) * 480
          dMap[r.dept_name] = {
            dept_name: r.dept_name,
            agent_count: cap?.agent_count || 0,
            agents_with_saturday: agSat,
            agents_without_saturday: agNoSat,
            capacity_minutes: capacity,
            working_days: wdStd,
            'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        dMap[r.dept_name][norm(r.type_333)] += r.total_minutes
      })
      const deptComparison = Object.values(dMap).map((d:any) => {
        const tot = d.Production + d['Administration & Reporting'] + d['Contrôle']
        const pct = d.capacity_minutes > 0 ? Math.round(tot*100/d.capacity_minutes) : 0
        return {
          ...d, total_minutes: tot,
          productive_pct: pct,
          non_productive_pct: Math.max(0, 100-pct),
          hours_display: minutesToHours(tot),
          capacity_hours_display: minutesToHours(d.capacity_minutes)
        }
      })

      // Par agent (capacité individuelle selon works_saturday)
      const aMap: Record<string,any> = {}
      ;(raw333Agent.results as any[]).forEach((r: any) => {
        if (!aMap[r.agent_id]) {
          const wd = r.works_saturday ? wdSat : wdStd
          const cap = wd * 480
          aMap[r.agent_id] = {
            agent_id: r.agent_id, agent_name: r.agent_name, dept_name: r.dept_name,
            works_saturday: r.works_saturday || 0,
            capacity_minutes: cap, working_days: wd,
            'Production': 0, 'Administration & Reporting': 0, 'Contrôle': 0
          }
        }
        aMap[r.agent_id][norm(r.type_333)] += r.total_minutes
      })
      const agentComparison = Object.values(aMap).map((a:any) => {
        const tot = a.Production + a['Administration & Reporting'] + a['Contrôle']
        const pct = a.capacity_minutes > 0 ? Math.round(tot*100/a.capacity_minutes) : 0
        return {
          ...a, total_minutes: tot,
          productive_pct: pct,
          non_productive_pct: Math.max(0,100-pct),
          hours_display: minutesToHours(tot),
          capacity_hours_display: minutesToHours(a.capacity_minutes)
        }
      })

      return { ratio333, deptComparison, agentComparison }
    }

    const dgM1 = await getDgRatio333(month, dgWdStd, dgWdSat)
    let dgM2 = null
    if (month2 && dgWdStd2 !== null && dgWdSat2 !== null) dgM2 = await getDgRatio333(month2, dgWdStd2, dgWdSat2)

    const monthlyTrend = await c.env.DB.prepare(
      `SELECT strftime('%Y-%m',start_time) as month, COALESCE(SUM(duration_minutes),0) as total_minutes
       FROM work_sessions WHERE status IN ('Validé','Terminé')
       GROUP BY month ORDER BY month DESC LIMIT 6`
    ).all()

    const byDept = await c.env.DB.prepare(
      `SELECT d.name as dept_name, COUNT(DISTINCT u.id) as agent_count, COALESCE(SUM(ws.duration_minutes),0) as total_minutes
       FROM departments d
       LEFT JOIN users u ON u.department_id=d.id AND u.status='Actif'
       LEFT JOIN work_sessions ws ON ws.department_id=d.id AND ${STATUSES} AND ${mf(month)}
       WHERE d.status='Actif' GROUP BY d.id, d.name ORDER BY total_minutes DESC`
    ).all()

    const deptData = byDept.results as any[]
    const grandTotal = deptData.reduce((s:number,d:any)=>s+d.total_minutes,0)

    return c.json({
      month, month2: month2||null,
      working_days: dgWdStd,
      working_days_month2: dgWdStd2,
      total_users: totalUsers?.c || 0,
      total_hours_month: minutesToHours(totalHoursMonth?.m || 0),
      to_validate: toValidate?.c || 0,
      byDept: deptData.map((d:any) => ({ ...d, percentage: grandTotal>0?Math.round(d.total_minutes*100/grandTotal):0, hours_display: minutesToHours(d.total_minutes) })),
      monthlyTrend: monthlyTrend.results,
      ratio333: dgM1.ratio333,
      ratio333Month2: dgM2?.ratio333||null,
      deptComparison: dgM1.deptComparison,
      deptComparisonMonth2: dgM2?.deptComparison||null,
      agentComparison: dgM1.agentComparison,
      agentComparisonMonth2: dgM2?.agentComparison||null,
      byDept333: dgM1.deptComparison,
      byAgent333: dgM1.agentComparison
    })
  } catch(e: any) { return c.json({ error: e.message }, 500) }
})

// ============================================
// STATIC FILES
// ============================================

app.use('/static/*', serveStatic({ root: './' }))

// ============================================
// FRONTEND ROUTES (SPA)
// ============================================

// Login page
app.get('/login', (c) => {
  return c.html(getLoginHTML())
})

// Admin routes
app.get('/admin/*', (c) => {
  return c.html(getAdminHTML())
})

// Agent routes
app.get('/agent/*', (c) => {
  return c.html(getAgentHTML())
})

// Chef routes
app.get('/chef/*', (c) => {
  return c.html(getChefHTML())
})

// Chef de Service routes
app.get('/chef-service/*', (c) => {
  return c.html(getChefServiceHTML())
})

// Directeur de Département routes
app.get('/dir-dept/*', (c) => {
  return c.html(getDirDeptHTML())
})

// Directeur Général routes
app.get('/dg/*', (c) => {
  return c.html(getDGHTML())
})

// Root redirect
app.get('/', (c) => {
  return c.redirect('/login')
})

// ============================================
// HTML TEMPLATES
// ============================================

function getLoginHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;}

/* ── Diaporama classique (fondu enchaîné) ── */
.bg-slide{
  position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;
  overflow:hidden;opacity:0;transition:opacity 1.4s ease-in-out;
}
.bg-slide.active{opacity:1;}
.bg-slide-inner{
  position:absolute;inset:0;
  background-size:cover;background-position:center;background-repeat:no-repeat;
  /* Pas d'animation Ken Burns - image fixe */
}

/* ── Points de navigation du diaporama ── */
#slide-dots{
  position:fixed;bottom:22px;left:50%;transform:translateX(-50%);
  z-index:10;display:flex;gap:8px;align-items:center;pointer-events:auto;
}
.slide-dot{
  width:8px;height:8px;border-radius:50%;
  background:rgba(255,255,255,0.35);
  border:1px solid rgba(255,255,255,0.5);
  cursor:pointer;transition:all .3s ease;
  flex-shrink:0;
}
.slide-dot.active{
  background:#d4af37;border-color:#d4af37;
  width:24px;border-radius:4px;
}
.slide-dot:hover:not(.active){background:rgba(255,255,255,0.65);}

/* ── Badge rôle sur le panneau gauche ── */
#role-badge{
  display:inline-flex;align-items:center;gap:8px;
  background:rgba(212,175,55,0.15);
  border:1px solid rgba(212,175,55,0.4);
  border-radius:20px;padding:5px 14px;
  font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;
  color:rgba(212,175,55,0.9);margin-bottom:14px;
  transition:opacity .4s ease;
}
#role-badge i{font-size:10px;}

/* overlay dégradé directionnel pour laisser respirer le panneau gauche */
.bg-overlay{
  position:fixed;inset:0;z-index:0;pointer-events:none;
  background:linear-gradient(
    105deg,
    rgba(4,8,28,0.72) 0%,
    rgba(4,8,28,0.55) 45%,
    rgba(4,8,28,0.38) 100%
  );
}

/* ── Panneau texte gauche ── */
.left-panel{
  display:none; /* caché sur mobile */
  flex-direction:column;justify-content:center;
  max-width:480px;padding:0 48px 0 56px;
  color:#fff;user-select:none;
}
@media(min-width:900px){.left-panel{display:flex;flex:1;}}

.left-panel .tagline{
  font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;
  color:rgba(212,175,55,0.9);margin-bottom:20px;
  display:flex;align-items:center;gap:10px;
}
.left-panel .tagline::before{
  content:'';display:block;width:32px;height:2px;
  background:linear-gradient(90deg,transparent,rgba(212,175,55,0.9));
}
.left-panel .tagline::after{
  content:'';display:block;width:32px;height:2px;
  background:linear-gradient(90deg,rgba(212,175,55,0.9),transparent);
}
.left-panel h1{
  font-size:clamp(26px,2.8vw,44px);font-weight:800;line-height:1.22;
  margin-bottom:18px;
  background:linear-gradient(135deg,#ffffff 0%,rgba(212,175,55,0.85) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  transition:opacity .45s ease, transform .45s ease;
  min-height:120px; /* évite le saut de layout lors de la transition */
}
.left-panel p{
  font-size:15px;line-height:1.75;color:rgba(255,255,255,0.72);
  margin-bottom:36px;max-width:380px;
  transition:opacity .4s ease, transform .4s ease;
}

.left-panel .divider-gold{
  width:56px;height:3px;border-radius:2px;
  background:linear-gradient(90deg,rgba(212,175,55,0.2),rgba(212,175,55,0.9),rgba(212,175,55,0.2));
  margin-bottom:28px;
  align-self:flex-start;
}

/* ── Overlay verre dépoli global ── */
.scene{position:fixed;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:16px 24px;}

/* ── Carte de connexion glassmorphism ── */
.login-card{
  position:relative;
  width:100%;max-width:420px;
  background:rgba(255,255,255,0.20);
  border:1px solid rgba(255,255,255,0.45);
  border-radius:24px;
  padding:40px 36px 36px;
  backdrop-filter:blur(28px) saturate(1.6) brightness(1.05);
  -webkit-backdrop-filter:blur(28px) saturate(1.6) brightness(1.05);
  box-shadow:0 8px 48px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5);
  animation:cardIn .7s cubic-bezier(.22,1,.36,1) both;
}
@keyframes cardIn{from{opacity:0;transform:translateY(28px) scale(.97);}to{opacity:1;transform:none;}}

/* ── Logo ── */
.logo-wrapper{
  background:rgba(255,255,255,0.95);
  border-radius:14px;
  padding:14px 22px;
  display:inline-block;
  box-shadow:0 4px 24px rgba(0,0,0,0.18);
  margin-bottom:18px;
}
.logo-wrapper img{height:56px;width:auto;display:block;}

/* ── Badge app ── */
.app-badge{
  display:inline-flex;align-items:center;gap:7px;
  background:rgba(255,255,255,0.15);
  border:1px solid rgba(255,255,255,0.25);
  border-radius:20px;padding:5px 14px;
  font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;
  letter-spacing:.3px;
}

/* ── Séparateur ── */
.divider{height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,0.25),transparent);margin:18px 0;}

/* ── Labels & inputs ── */
.field-label{display:block;font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);margin-bottom:6px;}
.input-wrap{position:relative;}
.input-field{
  width:100%;
  background:rgba(255,255,255,0.12);
  border:1px solid rgba(255,255,255,0.22);
  border-radius:10px;
  padding:12px 16px;
  font-size:14px;
  color:#fff;
  outline:none;
  transition:all .2s;
}
.input-field::placeholder{color:rgba(255,255,255,0.4);}
.input-field:focus{
  border-color:rgba(255,255,255,0.55);
  background:rgba(255,255,255,0.18);
  box-shadow:0 0 0 3px rgba(255,255,255,0.10);
}
.input-field.has-icon{padding-right:44px;}
.eye-btn{
  position:absolute;right:13px;top:50%;transform:translateY(-50%);
  background:none;border:none;cursor:pointer;
  color:rgba(255,255,255,0.5);font-size:15px;
  transition:color .2s;
}
.eye-btn:hover{color:rgba(255,255,255,0.9);}

/* ── Bouton connexion ── */
.btn-primary{
  width:100%;
  background:linear-gradient(135deg,#2563eb,#1e3a5f);
  border:none;border-radius:12px;
  padding:13px;
  font-size:15px;font-weight:600;color:#fff;
  cursor:pointer;
  transition:all .25s;
  box-shadow:0 4px 20px rgba(30,58,95,0.5);
  position:relative;overflow:hidden;
}
.btn-primary::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent);
  opacity:0;transition:opacity .25s;
}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(30,58,95,0.65);}
.btn-primary:hover::before{opacity:1;}
.btn-primary:active{transform:translateY(0);}
.btn-primary:disabled{opacity:.65;cursor:not-allowed;transform:none;}

/* ── Message d'erreur ── */
.error-box{
  display:none;
  background:rgba(239,68,68,0.18);
  border:1px solid rgba(239,68,68,0.4);
  border-radius:10px;padding:10px 14px;
  color:#fca5a5;font-size:13px;margin-bottom:16px;
}
.error-box.show{display:flex;align-items:center;gap:8px;}

/* ── Pied de carte ── */
.card-footer{margin-top:18px;text-align:center;font-size:11px;color:rgba(255,255,255,0.35);}

/* ── Lien reset ── */
.reset-link{display:block;text-align:center;margin-top:14px;font-size:13px;color:rgba(255,255,255,0.6);cursor:pointer;transition:color .2s;}
.reset-link:hover{color:rgba(255,255,255,0.95);}

/* ── Panel reset ── */
#reset-panel{display:none;margin-top:16px;border-top:1px solid rgba(255,255,255,0.2);padding-top:16px;}
.success-box{display:none;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);border-radius:10px;padding:10px 14px;color:#86efac;font-size:13px;margin-bottom:12px;}

/* ── Champs espacés ── */
.field-group{margin-bottom:16px;}
</style>
</head>
<body>

<!-- Diaporama ordonné selon la hiérarchie de l'application -->
<div id="slideshow"></div>
<div class="bg-overlay"></div>
<!-- Points de navigation -->
<div id="slide-dots"></div>

<script>
(function(){
  /* ══════════════════════════════════════════════════════════════════
     15 SLIDES — ordonnés selon la hiérarchie de l'application :
     Agent (1-3) → Chef de Service (4-5) → Chef de Département (6-7)
     → Directeur de Département (8-9) → Directeur Général (10-12)
     → Administrateur (13-14) → BGFIBank CA (15)
  ══════════════════════════════════════════════════════════════════ */
  const SLIDES = [
    /* ── Agent ── */
    {
      img: '/static/login-bg-01.jpg',
      role: 'Agent',
      icon: 'fa-user-clock',
      phrase: 'Suivez votre temps.<br>Posez vos actions.<br>Progressez chaque jour.'
    },
    {
      img: '/static/login-bg-02.jpg',
      role: 'Agent',
      icon: 'fa-user-clock',
      phrase: 'Chaque minute pointée<br>est une preuve<br>de votre engagement.'
    },
    {
      img: '/static/login-bg-03.jpg',
      role: 'Agent',
      icon: 'fa-user-clock',
      phrase: 'Votre temps,<br>votre performance,<br>votre valeur.'
    },
    /* ── Chef de Service ── */
    {
      img: '/static/login-bg-04.jpg',
      role: 'Chef de Service',
      icon: 'fa-users',
      phrase: 'Encadrez votre équipe.<br>Suivez la production.<br>Atteignez les objectifs.'
    },
    {
      img: '/static/login-bg-05.jpg',
      role: 'Chef de Service',
      icon: 'fa-users',
      phrase: 'Chaque tâche accomplie<br>rapproche la banque<br>de ses objectifs.'
    },
    /* ── Chef de Département ── */
    {
      img: '/static/login-bg-06.jpg',
      role: 'Chef de Département',
      icon: 'fa-user-tie',
      phrase: 'Validez, analysez,<br>décidez.<br>Pilotez la performance.'
    },
    {
      img: '/static/login-bg-07.jpg',
      role: 'Chef de Département',
      icon: 'fa-user-tie',
      phrase: 'La transparence<br>est la base de<br>toute confiance.'
    },
    /* ── Directeur de Département ── */
    {
      img: '/static/login-bg-08.jpg',
      role: 'Directeur de Département',
      icon: 'fa-chart-bar',
      phrase: 'Vision globale<br>de votre département.<br>Données en temps réel.'
    },
    {
      img: '/static/login-bg-09.jpg',
      role: 'Directeur de Département',
      icon: 'fa-chart-bar',
      phrase: 'Diriger, c&#39;est aussi<br>suivre, écouter<br>et valoriser.'
    },
    /* ── Directeur Général ── */
    {
      img: '/static/login-bg-10.jpg',
      role: 'Directeur Général',
      icon: 'fa-building-columns',
      phrase: 'Vue stratégique<br>de toute la banque.<br>Décisions éclairées.'
    },
    {
      img: '/static/login-bg-11.jpg',
      role: 'Directeur Général',
      icon: 'fa-building-columns',
      phrase: 'Les chiffres parlent.<br>Les résultats guident.<br>La performance décide.'
    },
    {
      img: '/static/login-bg-12.jpg',
      role: 'Directeur Général',
      icon: 'fa-building-columns',
      phrase: 'Bien gérer les hommes,<br>c&#39;est bien gérer<br>la banque.'
    },
    /* ── Administrateur ── */
    {
      img: '/static/login-bg-13.jpg',
      role: 'Administrateur',
      icon: 'fa-shield-halved',
      phrase: 'Maîtrisez le système.<br>Sécurisez les accès.<br>Contrôlez tout.'
    },
    {
      img: '/static/login-bg-14.jpg',
      role: 'Administrateur',
      icon: 'fa-shield-halved',
      phrase: 'La sécurité n&#39;est pas<br>une option.<br>C&#39;est une exigence.'
    },
    /* ── BGFIBank CA ── */
    {
      img: '/static/login-bg-15.jpg',
      role: 'BGFIBank CA',
      icon: 'fa-star',
      phrase: 'BGFIBank CA.<br>L&#39;excellence au service<br>de votre avenir.'
    }
  ];

  const INTERVAL = 6000; // 6 secondes par slide
  let currentIdx = 0;
  let autoTimer = null;

  /* ── Créer les éléments DOM du diaporama ── */
  const container = document.getElementById('slideshow');
  const dotsContainer = document.getElementById('slide-dots');

  /* Alternance A/B pour le fondu enchaîné */
  const slideEls = [0,1].map(()=>{
    const d = document.createElement('div');
    d.className = 'bg-slide';
    const inner = document.createElement('div');
    inner.className = 'bg-slide-inner';
    d.appendChild(inner);
    container.appendChild(d);
    return d;
  });
  let activeBuf = 0; // index dans slideEls (0 ou 1)

  /* ── Créer les 15 points de navigation ── */
  const dots = SLIDES.map((_, i)=>{
    const dot = document.createElement('button');
    dot.className = 'slide-dot';
    dot.setAttribute('aria-label', 'Slide '+(i+1));
    dot.addEventListener('click', ()=>{ goTo(i); resetTimer(); });
    dotsContainer.appendChild(dot);
    return dot;
  });

  /* ── Précharger toutes les images ── */
  SLIDES.forEach(s=>{ const img=new Image(); img.src=s.img; });

  /* ── Mettre à jour le panneau gauche ── */
  function updatePanel(data){
    const headline = document.getElementById('left-headline');
    const roleLabel = document.getElementById('role-label');
    const roleBadge = document.getElementById('role-badge');
    const badgeIcon = roleBadge ? roleBadge.querySelector('i') : null;

    const isDG = data.role === 'Directeur Général';

    if(headline){
      headline.style.opacity='0';
      headline.style.transform='translateY(12px)';
    }
    if(roleBadge){ roleBadge.style.opacity='0'; }

    setTimeout(function(){
      if(headline){
        headline.innerHTML = data.phrase;
        headline.style.opacity='1';
        headline.style.transform='translateY(0)';
      }
      if(roleLabel){ roleLabel.textContent = data.role; }
      if(badgeIcon){ badgeIcon.className = 'fas '+data.icon; }
      // Le badge-libellé est masqué pour les slides Directeur Général
      if(roleBadge){
        roleBadge.style.opacity = isDG ? '0' : '1';
        roleBadge.style.pointerEvents = isDG ? 'none' : '';
      }
    }, 450);
  }

  /* ── Mettre à jour les points ── */
  function updateDots(idx){
    dots.forEach((d,i)=>{
      d.classList.toggle('active', i===idx);
    });
  }

  /* ── Afficher le slide à l'index idx ── */
  function goTo(idx){
    const next = 1 - activeBuf;
    const data = SLIDES[idx];
    const inner = slideEls[next].querySelector('.bg-slide-inner');
    inner.style.backgroundImage = 'url("'+data.img+'")';

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        slideEls[next].classList.add('active');
        slideEls[activeBuf].classList.remove('active');
        activeBuf = next;
        currentIdx = idx;
        updatePanel(data);
        updateDots(idx);
      });
    });
  }

  /* ── Auto-avancement ── */
  function nextSlide(){
    goTo((currentIdx + 1) % SLIDES.length);
  }

  function resetTimer(){
    if(autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(nextSlide, INTERVAL);
  }

  /* ── Initialisation — afficher la première slide immédiatement ── */
  (function init(){
    const first = SLIDES[0];
    const inner = slideEls[0].querySelector('.bg-slide-inner');
    inner.style.backgroundImage = 'url("'+first.img+'")';
    slideEls[0].classList.add('active');
    updatePanel(first);
    updateDots(0);
    resetTimer();
  })();

})();
</script>

<!-- Mise en page principale -->
<div class="scene">

<!-- Panneau gauche (visible uniquement sur grand écran) -->
<div class="left-panel">
  <div class="tagline">BGFIBank CA</div>
  <div id="role-badge"><i class="fas fa-user"></i><span id="role-label">TimeTrack</span></div>
  <h1 id="left-headline"></h1>
  <div class="divider-gold"></div>
</div>

<!-- Carte login -->
<div class="login-card">
  <div style="text-align:center;margin-bottom:20px;">
    <div class="logo-wrapper">
      <img src="/static/bgfibank-logo.png" alt="BGFIBank">
    </div>
    <div class="divider"></div>
    <div class="app-badge">
      <i class="fas fa-clock"></i>
      <span>TimeTrack &mdash; Suivi du temps</span>
    </div>
  </div>

  <div id="error-msg" class="error-box">
    <i class="fas fa-exclamation-circle"></i>
    <span id="error-text"></span>
  </div>

  <form id="login-form">
    <div class="field-group">
      <label class="field-label" for="email">Adresse email</label>
      <input type="email" id="email" class="input-field" placeholder="email@bgfibank.com" required autocomplete="username">
    </div>
    <div class="field-group">
      <label class="field-label" for="password">Mot de passe</label>
      <div class="input-wrap">
        <input type="password" id="password" class="input-field has-icon" placeholder="••••••••" required autocomplete="current-password">
        <button type="button" class="eye-btn" onclick="togglePwd()" tabindex="-1">
          <i class="fas fa-eye" id="eye-icon"></i>
        </button>
      </div>
    </div>
    <button type="submit" class="btn-primary" id="login-btn" style="margin-top:8px;">
      <i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter
    </button>
  </form>

  <!-- Lien mot de passe oublié -->
  <span class="reset-link" onclick="toggleResetPanel()">
    <i class="fas fa-key" style="margin-right:5px;"></i>J'ai un code de réinitialisation
  </span>

  <!-- Formulaire reset (caché par défaut) -->
  <div id="reset-panel">
    <p style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:12px;">
      Saisissez votre email, le code fourni par l'administrateur et votre nouveau mot de passe.
    </p>
    <div class="field-group">
      <label class="field-label">Email</label>
      <input type="email" id="rp_email" class="input-field" placeholder="email@bgfibank.com">
    </div>
    <div class="field-group">
      <label class="field-label">Code temporaire (6 chiffres)</label>
      <input type="text" id="rp_code" class="input-field" placeholder="ex: 482917" maxlength="6" style="letter-spacing:6px;font-weight:700;font-size:18px;text-align:center;">
    </div>
    <div class="field-group">
      <label class="field-label">Nouveau mot de passe</label>
      <input type="password" id="rp_pwd" class="input-field" placeholder="Minimum 8 caractères">
    </div>
    <div id="rp_error" class="error-box"><i class="fas fa-exclamation-circle"></i><span id="rp_error_text"></span></div>
    <div id="rp_ok" class="success-box"><i class="fas fa-check-circle" style="margin-right:6px;"></i><span id="rp_ok_text"></span></div>
    <button class="btn-primary" onclick="submitReset()" id="reset-btn">
      <i class="fas fa-check" style="margin-right:8px;"></i>Confirmer le nouveau mot de passe
    </button>
  </div>

  <div class="card-footer">
    &copy; ${new Date().getFullYear()} BGFIBank CA &mdash; Accès réservé au personnel autorisé
  </div>
</div>
</div>

<script>
/* ═══════════════════════════════════════════════
   FORMULAIRE LOGIN
═══════════════════════════════════════════════ */
function togglePwd(){
  const p=document.getElementById('password');
  const i=document.getElementById('eye-icon');
  if(p.type==='password'){p.type='text';i.className='fas fa-eye-slash';}
  else{p.type='password';i.className='fas fa-eye';}
}

function toggleResetPanel(){
  const panel=document.getElementById('reset-panel');
  const isVisible=panel.style.display==='block';
  panel.style.display=isVisible?'none':'block';
}

async function submitReset(){
  const email=document.getElementById('rp_email').value.trim();
  const code=document.getElementById('rp_code').value.trim();
  const pwd=document.getElementById('rp_pwd').value;
  const errBox=document.getElementById('rp_error');
  const errTxt=document.getElementById('rp_error_text');
  const okBox=document.getElementById('rp_ok');
  const okTxt=document.getElementById('rp_ok_text');
  const btn=document.getElementById('reset-btn');

  errBox.style.display='none'; okBox.style.display='none';

  if(!email||!code||!pwd){
    errTxt.textContent='Tous les champs sont requis';
    errBox.style.display='flex'; return;
  }
  if(pwd.length<8){
    errTxt.textContent='Mot de passe trop court (minimum 8 caractères)';
    errBox.style.display='flex'; return;
  }

  btn.disabled=true;
  btn.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Vérification...';

  try{
    const r=await fetch('/api/auth/reset-confirm',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,code,new_password:pwd})
    });
    const d=await r.json();
    if(!r.ok){
      errTxt.textContent=d.error||'Erreur';
      errBox.style.display='flex';
      btn.disabled=false;
      btn.innerHTML='<i class="fas fa-check" style="margin-right:8px;"></i>Confirmer le nouveau mot de passe';
    } else {
      okTxt.textContent='Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter.';
      okBox.style.display='block';
      // Remplir automatiquement l'email dans le formulaire de login
      document.getElementById('email').value=email;
      document.getElementById('rp_email').value='';
      document.getElementById('rp_code').value='';
      document.getElementById('rp_pwd').value='';
      // Débloquer le bouton de login
      const loginBtn=document.getElementById('login-btn');
      loginBtn.disabled=false;
      loginBtn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';
      setTimeout(()=>{ document.getElementById('reset-panel').style.display='none'; okBox.style.display='none'; },3000);
    }
  }catch(err){
    errTxt.textContent='Erreur réseau';
    errBox.style.display='flex';
    btn.disabled=false;
    btn.innerHTML='<i class="fas fa-check" style="margin-right:8px;"></i>Confirmer le nouveau mot de passe';
  }
}

function showError(msg){
  const box=document.getElementById('error-msg');
  document.getElementById('error-text').textContent=msg;
  box.classList.add('show');
}
function hideError(){document.getElementById('error-msg').classList.remove('show');}

document.getElementById('login-form').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const btn=document.getElementById('login-btn');
  hideError();
  btn.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Connexion en cours...';
  btn.disabled=true;
  try{
    const r=await fetch('/api/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        email:document.getElementById('email').value,
        password:document.getElementById('password').value
      })
    });
    const d=await r.json();
    if(!r.ok){
      if(d.blocked){
        showError(d.error);
        btn.innerHTML='<i class="fas fa-lock" style="margin-right:8px;"></i>Accès bloqué (2 min)';
        btn.disabled=true;
        // Ouvrir automatiquement le panel reset pour guider l'utilisateur
        document.getElementById('reset-panel').style.display='block';
        setTimeout(()=>{btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';btn.disabled=false;hideError();},2*60*1000);
      } else {
        showError(d.error||'Email ou mot de passe incorrect');
        btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';
        btn.disabled=false;
      }
      return;
    }
    localStorage.setItem('token',d.token);
    localStorage.setItem('user',JSON.stringify(d.user));
    btn.innerHTML='<i class="fas fa-check" style="margin-right:8px;"></i>Bienvenue !';
    setTimeout(()=>{
      if(d.user.role==='Administrateur')window.location='/admin/dashboard';
      else if(d.user.role==='Chef de Département')window.location='/chef/dashboard';
      else if(d.user.role==='Chef de Service')window.location='/chef-service/dashboard';
      else if(d.user.role==='Directeur de Département')window.location='/dir-dept/dashboard';
      else if(d.user.role==='Directeur Général')window.location='/dg/dashboard';
      else window.location='/agent/dashboard';
    },400);
  }catch(err){
    showError(err.message||'Erreur réseau');
    btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:8px;"></i>Se connecter';
    btn.disabled=false;
  }
});

/* Redirection si déjà connecté */
(function(){
  const t=localStorage.getItem('token');
  if(t){
    const u=JSON.parse(localStorage.getItem('user')||'{}');
    if(u.role==='Administrateur')window.location='/admin/dashboard';
    else if(u.role==='Chef de Département')window.location='/chef/dashboard';
    else if(u.role==='Chef de Service')window.location='/chef-service/dashboard';
    else if(u.role==='Directeur de Département')window.location='/dir-dept/dashboard';
    else if(u.role==='Directeur Général')window.location='/dg/dashboard';
    else if(u.role==='Agent')window.location='/agent/dashboard';
  }
})();
</script>
</body>
</html>`
}

function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Admin - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div id="app"></div>
<script src="/static/admin.js"></script>
</body>
</html>`
}

function getAgentHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Agent - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/agent.css">
</head>
<body>
<div id="app"></div>
<script src="/static/agent.js"></script>
</body>
</html>`
}

function getChefHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Chef - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/chef.css">
</head>
<body>
<div id="app"></div>
<script src="/static/chef.js"></script>
</body>
</html>`
}

function getChefServiceHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Chef de Service - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/chef-service.css">
</head>
<body>
<div id="app"></div>
<script src="/static/chef-service.js"></script>
</body>
</html>`
}

function getDirDeptHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Directeur - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/dir-dept.css">
</head>
<body>
<div id="app"></div>
<script src="/static/dir-dept.js"></script>
</body>
</html>`
}

function getDGHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TimeTrack Direction Générale - BGFIBank CA</title>
<link rel="icon" type="image/png" href="/static/bgfibank-logo.png">
<script>tailwind={config:{corePlugins:{preflight:false}}}</script>
<script src="/static/libs/tailwind.min.js"></script>
<link href="/static/libs/fontawesome/css/all.min.css" rel="stylesheet">
<script src="/static/libs/chart.min.js"></script>
<link rel="stylesheet" href="/static/dg.css">
</head>
<body>
<div id="app"></div>
<script src="/static/dg.js"></script>
</body>
</html>`
}

export default app
