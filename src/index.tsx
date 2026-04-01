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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
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

// Chiffrement simple (XOR + base64) pour stocker les mots de passe lisibles par l'admin
function encryptPassword(password: string): string {
  const key = 'bgfibank2024'
  let result = ''
  for (let i = 0; i < password.length; i++) {
    result += String.fromCharCode(password.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

function decryptPassword(encrypted: string): string {
  try {
    const key = 'bgfibank2024'
    const decoded = atob(encrypted)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result
  } catch {
    return '••••••••'
  }
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

    if (password.length < 4 || password.length > 100) {
      return c.json({ error: 'Mot de passe invalide' }, 400)
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

    const passwordHash = await hashPassword(password)
    if (passwordHash !== user.password_hash) {
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
    if (new_password.length < 4) return c.json({ error: 'Mot de passe trop court (minimum 4 caractères)' }, 400)

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
    const passwordEncrypted = encryptPassword(new_password)
    await c.env.DB.prepare(
      'UPDATE users SET password_hash=?, password_encrypted=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(passwordHash, passwordEncrypted, user.id).run()

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

    if (!validateEmail(email)) return c.json({ error: 'Email invalide' }, 400)
    if (password.length < 4) return c.json({ error: 'Mot de passe trop court (min 4 caractères)' }, 400)

    const passwordHash = await hashPassword(password)
    const passwordEncrypted = encryptPassword(password)

    const result = await c.env.DB.prepare(
      'INSERT INTO users (first_name, last_name, email, password_hash, password_encrypted, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(first_name, last_name, email, passwordHash, passwordEncrypted, role, department_id || null, status).run()

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
    const { first_name, last_name, email, password, role, department_id, status } = await c.req.json()

    if (password) {
      const passwordHash = await hashPassword(password)
      const passwordEncrypted = encryptPassword(password)
      await c.env.DB.prepare(
        'UPDATE users SET first_name=?, last_name=?, email=?, password_hash=?, password_encrypted=?, role=?, department_id=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(first_name, last_name, email, passwordHash, passwordEncrypted, role, department_id || null, status, id).run()
    } else {
      await c.env.DB.prepare(
        'UPDATE users SET first_name=?, last_name=?, email=?, role=?, department_id=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).bind(first_name, last_name, email, role, department_id || null, status, id).run()
    }

    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
    ).bind(currentUser.id, 'UPDATE_USER', `Modification de l'utilisateur ID ${id}`).run()

    return c.json({ message: 'Utilisateur mis à jour' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Route pour voir le mot de passe d'un utilisateur (admin seulement)
app.get('/api/admin/users/:id/password', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT password_encrypted FROM users WHERE id = ?').bind(id).first() as any

  if (!user) return c.json({ error: 'Utilisateur non trouvé' }, 404)

  const password = user.password_encrypted ? decryptPassword(user.password_encrypted) : '(mot de passe non disponible)'

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(currentUser.id, 'VIEW_PASSWORD', `Consultation du mot de passe de l\'utilisateur ID ${id}`).run()

  return c.json({ password })
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

app.post('/api/admin/tasks', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const { name, description, department_id, process_id, objective_id, task_type, status } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO tasks (name, description, department_id, process_id, objective_id, task_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, description || '', department_id, process_id, objective_id, task_type || 'Productive', status || 'Actif').run()

  return c.json({ id: result.meta.last_row_id, message: 'Tâche créée' })
})

app.put('/api/admin/tasks/:id', async (c) => {
  const currentUser = await getUser(c)
  if (!currentUser || currentUser.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  const id = c.req.param('id')
  const { name, description, department_id, process_id, objective_id, task_type, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE tasks SET name=?, description=?, department_id=?, process_id=?, objective_id=?, task_type=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(name, description || '', department_id, process_id, objective_id, task_type || 'Productive', status, id).run()

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
  const user = await getUser(c)
  if (!user || user.role !== 'Administrateur') return c.json({ error: 'Non autorisé' }, 401)

  // ── Correction 1 : sessions Validé + En attente + En cours comptent toutes
  // ── Correction 3 : on exclut les weekends (strftime('%w') : 0=dim, 6=sam)

  // Heures par objectif stratégique (toutes sessions actives)
  const hoursByObjective = await c.env.DB.prepare(
    `SELECT o.name, o.color, o.target_percentage,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id
       AND ws.status IN ('Validé', 'En attente', 'En cours')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color, o.target_percentage
     ORDER BY total_minutes DESC`
  ).all()

  // Heures par département (toutes sessions actives)
  const hoursByDept = await c.env.DB.prepare(
    `SELECT d.name, COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM departments d
     LEFT JOIN work_sessions ws ON ws.department_id = d.id
       AND ws.status IN ('Validé', 'En attente', 'En cours')
     GROUP BY d.id, d.name
     HAVING total_minutes > 0
     ORDER BY total_minutes DESC`
  ).all()

  // Tendance mensuelle (6 derniers mois — toutes sessions actives)
  const monthlyTrend = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', start_time) as month,
     COALESCE(SUM(duration_minutes), 0) as total_minutes
     FROM work_sessions
     WHERE status IN ('Validé', 'En attente', 'En cours')
     GROUP BY strftime('%Y-%m', start_time)
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

  return c.json({
    hoursByObjective: objectivesWithPct,
    hoursByDept: hoursByDept.results,
    monthlyTrend: monthlyTrend.results,
    is_weekend: isWeekend,
    productivity: {
      total_agents:                  totalAgents?.count || 0,
      total_capacity_today:          totalCapacityToday,
      is_weekend:                    isWeekend,
      // Catégorie 1 : sessions validées par le chef
      validated_minutes_today:       totalValidatedToday,
      validated_hours_today:         minutesToHours(totalValidatedToday),
      validated_pct:                 totalCapacityToday > 0 ? Math.round((totalValidatedToday / totalCapacityToday) * 100) : 0,
      // Catégorie 2 : sessions pointées mais en attente de validation
      pending_minutes_today:         totalPendingToday,
      pending_hours_today:           minutesToHours(totalPendingToday),
      pending_pct:                   totalCapacityToday > 0 ? Math.round((totalPendingToday / totalCapacityToday) * 100) : 0,
      // Catégorie 3 : total pointé (validé + en attente)
      productive_minutes_today:      totalPointedToday,
      non_productive_minutes_today:  totalNonPointedToday,
      productive_hours_today:        minutesToHours(totalPointedToday),
      non_productive_hours_today:    minutesToHours(totalNonPointedToday),
      productive_pct:                totalCapacityToday > 0 ? Math.round((totalPointedToday    / totalCapacityToday) * 100) : 0,
      non_productive_pct:            totalCapacityToday > 0 ? Math.round((totalNonPointedToday / totalCapacityToday) * 100) : 0,
      agents_detail: agentsTodayMapped
    }
  })
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

  // Export CSV
  if (exportFmt === 'csv') {
    const rows = reports.results as any[]
    const header = 'Agent,Département,Tâche,Processus,Objectif,Date début,Date fin,Durée (min),Type,Statut,Motif rejet\n'
    const csv = header + rows.map((r: any) =>
      [r.agent_name, r.department_name, r.task_name, r.process_name, r.objective_name,
       r.start_time, r.end_time, r.duration_minutes, r.session_type, r.status,
       (r.rejected_reason || '').replace(/,/g, ';')].join(',')
    ).join('\n')
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

  return c.json({
    today_minutes: todayStats?.today_minutes || 0,
    today_hours: minutesToHours(todayStats?.today_minutes || 0),
    total_minutes: totalStats?.total_minutes || 0,
    total_hours: minutesToHours(totalStats?.total_minutes || 0),
    total_sessions: sessionStats?.total || 0,
    rejected_sessions: sessionStats?.rejected || 0,
    byObjective: objectivesWithPct
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

    await c.env.DB.prepare(
      'UPDATE work_sessions SET end_time=CURRENT_TIMESTAMP, duration_minutes=?, status="Terminé", updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(durationMinutes, active.id).run()

    return c.json({ message: 'Session arrêtée', duration_minutes: durationMinutes })
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

  // Agents actifs dans le département
  const activeAgents = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) as count FROM work_sessions 
     WHERE department_id = ? AND date(start_time) = date('now')`
  ).bind(deptId).first() as any

  // Total heures équipe ce mois
  const totalTeamHours = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(duration_minutes), 0) as m FROM work_sessions 
     WHERE department_id = ? AND strftime('%Y-%m', start_time) = strftime('%Y-%m', 'now') AND status IN ('Validé','Terminé')`
  ).bind(deptId).first() as any

  // Sessions à valider
  const toValidate = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM work_sessions WHERE department_id = ? AND status = 'Terminé'`
  ).bind(deptId).first() as any

  // Heures par agent
  const hoursByAgent = await c.env.DB.prepare(
    `SELECT u.first_name || ' ' || u.last_name as agent_name,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id AND ws.status IN ('Validé','Terminé')
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(deptId).all()

  // Répartition par objectif (département)
  const byObjective = await c.env.DB.prepare(
    `SELECT o.name, o.color, o.target_percentage,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes
     FROM strategic_objectives o
     LEFT JOIN work_sessions ws ON ws.objective_id = o.id AND ws.department_id = ? AND ws.status IN ('Validé','Terminé')
     WHERE o.status = 'Actif'
     GROUP BY o.id, o.name, o.color, o.target_percentage
     HAVING total_minutes > 0`
  ).bind(deptId).all()

  // Détail par agent avec heures productives/non productives aujourd'hui
  const agentDetail = await c.env.DB.prepare(
    `SELECT u.id, u.first_name || ' ' || u.last_name as agent_name,
     COUNT(ws.id) as total_sessions,
     COALESCE(SUM(ws.duration_minutes), 0) as total_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes,
     COALESCE(SUM(CASE WHEN ws.status='Validé' THEN ws.duration_minutes ELSE 0 END) * 100.0 / NULLIF(SUM(ws.duration_minutes), 0), 0) as pct_validated
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(deptId).all()

  // ── Correction 3 : weekend = capacité 0
  const todayDowChef = new Date().getDay()
  const isWeekendChef = todayDowChef === 0 || todayDowChef === 6
  const capPerAgentChef = isWeekendChef ? 0 : 480

  // ── Corrections 1+2 : 3 catégories par agent aujourd'hui (chef)
  const agentProductivityToday = await c.env.DB.prepare(
    `SELECT
       u.id,
       u.first_name || ' ' || u.last_name as agent_name,
       COALESCE(SUM(CASE WHEN ws.status = 'Validé'     THEN ws.duration_minutes ELSE 0 END), 0) as validated_minutes_today,
       COALESCE(SUM(CASE WHEN ws.status = 'En attente' THEN ws.duration_minutes ELSE 0 END), 0) as pending_minutes_today,
       COALESCE(SUM(CASE WHEN ws.status = 'En cours'   THEN ws.duration_minutes ELSE 0 END), 0) as inprogress_minutes_today
     FROM users u
     LEFT JOIN work_sessions ws ON ws.user_id = u.id
       AND date(ws.start_time) = date('now')
       AND ws.status IN ('Validé', 'En attente', 'En cours')
     WHERE u.department_id = ? AND u.role = 'Agent' AND u.status = 'Actif'
     GROUP BY u.id, u.first_name, u.last_name`
  ).bind(deptId).all()

  const objData = byObjective.results as any[]
  const totalMin = objData.reduce((sum: number, o: any) => sum + o.total_minutes, 0)

  // Fusionner agentDetail avec productivité du jour
  const productivityMap: any = {}
  for (const p of (agentProductivityToday.results as any[])) {
    productivityMap[p.id] = p
  }

  const nbAgents = (agentDetail.results as any[]).length

  // Totaux équipe avec les 3 catégories
  const totalValidatedTeam   = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.validated_minutes_today,   capPerAgentChef || 480), 0)
  const totalPendingTeam     = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.pending_minutes_today,     capPerAgentChef || 480), 0)
  const totalInprogressTeam  = (agentProductivityToday.results as any[]).reduce((s: number, a: any) => s + Math.min(a.inprogress_minutes_today,  capPerAgentChef || 480), 0)
  const totalPointedTeam     = Math.min(totalValidatedTeam + totalPendingTeam + totalInprogressTeam, nbAgents * (capPerAgentChef || 480))
  const totalNonPointedTeam  = capPerAgentChef > 0 ? Math.max(nbAgents * capPerAgentChef - totalPointedTeam, 0) : 0

  return c.json({
    active_agents: activeAgents?.count || 0,
    total_team_hours: minutesToHours(totalTeamHours?.m || 0),
    to_validate: toValidate?.c || 0,
    is_weekend: isWeekendChef,
    hoursByAgent: hoursByAgent.results,
    byObjective: objData.map((o: any) => ({
      ...o,
      percentage: totalMin > 0 ? Math.round((o.total_minutes / totalMin) * 100) : 0,
      hours_display: minutesToHours(o.total_minutes)
    })),
    agentDetail: (agentDetail.results as any[]).map((a: any) => {
      const p = productivityMap[a.id] || { validated_minutes_today: 0, pending_minutes_today: 0, inprogress_minutes_today: 0 }
      const cap = capPerAgentChef || 480
      const total_pointed = Math.min(p.validated_minutes_today + p.pending_minutes_today + p.inprogress_minutes_today, cap)
      const non_pointed   = capPerAgentChef > 0 ? Math.max(cap - total_pointed, 0) : 0
      return {
        ...a,
        total_hours:               minutesToHours(a.total_minutes),
        validated_hours:           minutesToHours(a.validated_minutes),
        // Aujourd'hui — 3 catégories
        validated_minutes_today:   Math.min(p.validated_minutes_today, cap),
        pending_minutes_today:     Math.min(p.pending_minutes_today,   cap),
        inprogress_minutes_today:  Math.min(p.inprogress_minutes_today,cap),
        non_pointed_today:         non_pointed,
        validated_hours_today:     minutesToHours(Math.min(p.validated_minutes_today, cap)),
        pending_hours_today:       minutesToHours(Math.min(p.pending_minutes_today,   cap)),
        inprogress_hours_today:    minutesToHours(Math.min(p.inprogress_minutes_today,cap)),
        non_pointed_hours_today:   minutesToHours(non_pointed),
        // Rétrocompatibilité
        productive_minutes_today:     total_pointed,
        non_productive_minutes_today: non_pointed,
        productive_hours_today:       minutesToHours(total_pointed),
        non_productive_hours_today:   minutesToHours(non_pointed),
        productive_pct_today:         cap > 0 ? Math.round((total_pointed / cap) * 100) : 0,
        non_productive_pct_today:     cap > 0 ? Math.round((non_pointed   / cap) * 100) : 0,
        validated_pct_today:          cap > 0 ? Math.round((Math.min(p.validated_minutes_today, cap) / cap) * 100) : 0,
        pending_pct_today:            cap > 0 ? Math.round((Math.min(p.pending_minutes_today,   cap) / cap) * 100) : 0,
        is_weekend:                   isWeekendChef
      }
    }),
    team_productivity: {
      total_agents:              nbAgents,
      is_weekend:                isWeekendChef,
      validated_hours_today:     minutesToHours(totalValidatedTeam),
      pending_hours_today:       minutesToHours(totalPendingTeam),
      productive_hours_today:    minutesToHours(totalPointedTeam),
      non_productive_hours_today:minutesToHours(totalNonPointedTeam),
      productive_pct:            nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalPointedTeam   / (nbAgents * capPerAgentChef)) * 100) : 0,
      non_productive_pct:        nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalNonPointedTeam/ (nbAgents * capPerAgentChef)) * 100) : 0,
      validated_pct:             nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalValidatedTeam  / (nbAgents * capPerAgentChef)) * 100) : 0,
      pending_pct:               nbAgents > 0 && capPerAgentChef > 0 ? Math.round((totalPendingTeam    / (nbAgents * capPerAgentChef)) * 100) : 0
    }
  })
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

/* ── Fond image plein écran ── */
#bg-image{position:fixed;inset:0;width:100%;height:100%;z-index:0;object-fit:cover;object-position:left center;pointer-events:none;}

/* ── Overlay verre dépoli global ── */
.scene{position:fixed;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;padding:16px;}

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

<!-- Image fond plein écran -->
<img id="bg-image" src="/static/login-bg.png" alt="">

<!-- Carte login -->
<div class="scene">
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
      <input type="password" id="rp_pwd" class="input-field" placeholder="Minimum 4 caractères">
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
  if(pwd.length<4){
    errTxt.textContent='Mot de passe trop court (minimum 4 caractères)';
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

export default app
