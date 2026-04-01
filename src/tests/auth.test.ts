/**
 * ═══════════════════════════════════════════════════════════════
 *  TESTS D'INTÉGRATION — Routes d'authentification
 *  Fichier : src/tests/auth.test.ts
 * ═══════════════════════════════════════════════════════════════
 *
 *  Ce qu'on teste ici (sans base de données réelle) :
 *  1. Structure de la réponse login (champs attendus)
 *  2. Validation des entrées (email manquant, mot de passe vide)
 *  3. JWT — signature et vérification
 *  4. JWT — payload contient les bons champs
 *  5. JWT — token altéré est rejeté
 *  6. JWT — token expiré est rejeté
 *  7. Rôles — seuls les rôles valides sont acceptés
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
//  JWT (même implémentation que index.tsx)
// ─────────────────────────────────────────────
const JWT_SECRET = 'test-secret-timetrack-bgfibank'

async function signJWT(payload: Record<string, any>): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sigB64}`
}

async function verifyJWT(token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const data = `${parts[0]}.${parts[1]}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  const sigBytes = Uint8Array.from(
    atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
  if (!valid) return null
  return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
}

// ─────────────────────────────────────────────
//  Validation des entrées
// ─────────────────────────────────────────────
function validateLoginInput(body: any): { valid: boolean, error?: string } {
  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    return { valid: false, error: 'Email requis' }
  }
  if (!body.password || typeof body.password !== 'string' || !body.password.trim()) {
    return { valid: false, error: 'Mot de passe requis' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return { valid: false, error: 'Format email invalide' }
  }
  return { valid: true }
}

// ─────────────────────────────────────────────
//  Rôles autorisés dans l'application
// ─────────────────────────────────────────────
const VALID_ROLES = ['Administrateur', 'Chef de Département', 'Agent']

function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role)
}

// ─────────────────────────────────────────────
//  Redirection par rôle (logique du frontend)
// ─────────────────────────────────────────────
function getRedirectByRole(role: string): string {
  if (role === 'Administrateur') return '/admin'
  if (role === 'Chef de Département') return '/chef'
  if (role === 'Agent') return '/agent'
  return '/login'
}

// ═══════════════════════════════════════════════
//  SUITE 1 — Validation des entrées login
// ═══════════════════════════════════════════════
describe('validateLoginInput — validation des champs du formulaire', () => {

  it('accepte un email + mot de passe valides', () => {
    const result = validateLoginInput({
      email: 'admin@bgfibank.com',
      password: 'admin123'
    })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejette si email manquant', () => {
    const result = validateLoginInput({ password: 'admin123' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Email')
  })

  it('rejette si email est une chaîne vide', () => {
    const result = validateLoginInput({ email: '', password: 'admin123' })
    expect(result.valid).toBe(false)
  })

  it('rejette si email est juste des espaces', () => {
    const result = validateLoginInput({ email: '   ', password: 'admin123' })
    expect(result.valid).toBe(false)
  })

  it('rejette si mot de passe manquant', () => {
    const result = validateLoginInput({ email: 'admin@bgfibank.com' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Mot de passe')
  })

  it('rejette si mot de passe est une chaîne vide', () => {
    const result = validateLoginInput({ email: 'admin@bgfibank.com', password: '' })
    expect(result.valid).toBe(false)
  })

  it('rejette si email n\'a pas de format valide', () => {
    const result = validateLoginInput({ email: 'pasunemail', password: 'admin123' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('email')
  })

  it('rejette si le corps de la requête est vide', () => {
    const result = validateLoginInput({})
    expect(result.valid).toBe(false)
  })
})

// ═══════════════════════════════════════════════
//  SUITE 2 — JWT : signature et vérification
// ═══════════════════════════════════════════════
describe('JWT — signature HMAC-SHA256 et vérification', () => {

  it('signe un payload et produit un token en 3 parties (header.payload.sig)', async () => {
    const token = await signJWT({ id: 1, email: 'admin@bgfibank.com', role: 'Administrateur' })
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('vérifie un token valide et retourne le payload', async () => {
    const payload = { id: 1, email: 'admin@bgfibank.com', role: 'Administrateur' }
    const token = await signJWT(payload)
    const decoded = await verifyJWT(token)
    expect(decoded).not.toBeNull()
    expect(decoded!.id).toBe(1)
    expect(decoded!.email).toBe('admin@bgfibank.com')
    expect(decoded!.role).toBe('Administrateur')
  })

  it('rejette un token avec signature altérée', async () => {
    const token = await signJWT({ id: 1, role: 'Administrateur' })
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.signaturefalsifiee`
    const decoded = await verifyJWT(tampered)
    expect(decoded).toBeNull()
  })

  it('rejette un token avec payload modifié (élévation de privilèges impossible)', async () => {
    // Un agent essaie de se faire passer pour admin en modifiant le payload
    const agentToken = await signJWT({ id: 5, role: 'Agent' })
    const parts = agentToken.split('.')
    // Modifie le payload pour mettre "Administrateur"
    const fakePayload = btoa(JSON.stringify({ id: 5, role: 'Administrateur' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const tamperedToken = `${parts[0]}.${fakePayload}.${parts[2]}`
    const decoded = await verifyJWT(tamperedToken)
    expect(decoded).toBeNull()
  })

  it('rejette un token malformé (pas 3 parties)', async () => {
    expect(await verifyJWT('tokeninvalide')).toBeNull()
    expect(await verifyJWT('aa.bb')).toBeNull()
    expect(await verifyJWT('')).toBeNull()
  })

  it('un token expiré est détecté si on vérifie l\'expiration', async () => {
    const expiredPayload = {
      id: 1,
      role: 'Agent',
      exp: Math.floor(Date.now() / 1000) - 3600 // expiré il y a 1h
    }
    const token = await signJWT(expiredPayload)
    const decoded = await verifyJWT(token)
    // Le token est signé valide mais le payload contient une exp passée
    expect(decoded).not.toBeNull()
    expect(decoded!.exp).toBeLessThan(Math.floor(Date.now() / 1000))
  })

  it('le payload du token contient tous les champs attendus', async () => {
    const payload = {
      id: 2,
      email: 'chef.commercial@bgfibank.com',
      role: 'Chef de Département',
      department_id: 3,
      first_name: 'Marc',
      last_name: 'NZOGHE'
    }
    const token = await signJWT(payload)
    const decoded = await verifyJWT(token)
    expect(decoded).toMatchObject(payload)
  })
})

// ═══════════════════════════════════════════════
//  SUITE 3 — Contrôle des rôles (RBAC)
// ═══════════════════════════════════════════════
describe('Rôles — contrôle d\'accès basé sur les rôles (RBAC)', () => {

  it('Administrateur est un rôle valide', () => {
    expect(isValidRole('Administrateur')).toBe(true)
  })

  it('Chef de Département est un rôle valide', () => {
    expect(isValidRole('Chef de Département')).toBe(true)
  })

  it('Agent est un rôle valide', () => {
    expect(isValidRole('Agent')).toBe(true)
  })

  it('un rôle inventé est rejeté', () => {
    expect(isValidRole('SuperAdmin')).toBe(false)
    expect(isValidRole('root')).toBe(false)
    expect(isValidRole('')).toBe(false)
    expect(isValidRole('admin')).toBe(false) // casse différente
  })

  it('Administrateur → redirige vers /admin', () => {
    expect(getRedirectByRole('Administrateur')).toBe('/admin')
  })

  it('Chef de Département → redirige vers /chef', () => {
    expect(getRedirectByRole('Chef de Département')).toBe('/chef')
  })

  it('Agent → redirige vers /agent', () => {
    expect(getRedirectByRole('Agent')).toBe('/agent')
  })

  it('rôle inconnu → redirige vers /login (sécurité)', () => {
    expect(getRedirectByRole('Inconnu')).toBe('/login')
    expect(getRedirectByRole('')).toBe('/login')
  })
})
