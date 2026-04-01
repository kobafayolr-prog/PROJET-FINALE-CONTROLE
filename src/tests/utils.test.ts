/**
 * ═══════════════════════════════════════════════════════════════
 *  TESTS UNITAIRES — Fonctions utilitaires de TimeTrack
 *  Fichier : src/tests/utils.test.ts
 * ═══════════════════════════════════════════════════════════════
 *
 *  Ce qu'on teste ici :
 *  1. sanitizeString   — nettoyage des entrées utilisateur
 *  2. validateEmail    — validation du format email
 *  3. minutesToHours   — conversion minutes → "Xh YYm"
 *  4. hashPassword     — hachage SHA-256
 *  5. encryptPassword  — chiffrement XOR+Base64
 *  6. decryptPassword  — déchiffrement XOR+Base64
 *  7. checkRateLimit   — vérification du blocage IP
 *  8. recordFailedAttempt — enregistrement d'une tentative échouée
 *  9. resetAttempts    — déblocage d'une IP
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ─────────────────────────────────────────────
//  Fonctions re-définies localement pour les tests
//  (même logique que dans src/index.tsx)
// ─────────────────────────────────────────────

function sanitizeString(str: string): string {
  if (typeof str !== 'string') return ''
  return str.trim().replace(/[<>"'%;()&+]/g, '')
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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

// ── Rate Limiting (même logique que index.tsx) ──
const MAX_ATTEMPTS = 3
const BLOCK_DURATION = 2 * 60 * 1000
let loginAttempts = new Map<string, { count: number, blockedUntil: number }>()

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

// ═══════════════════════════════════════════════
//  SUITE 1 — sanitizeString
// ═══════════════════════════════════════════════
describe('sanitizeString — nettoyage des entrées', () => {

  it('supprime les espaces en début et fin', () => {
    expect(sanitizeString('  admin  ')).toBe('admin')
  })

  it('supprime les caractères dangereux < > " \'', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalertxss/script')
  })

  it('supprime les caractères SQL dangereux % ; ( )', () => {
    // ' et ; sont supprimés — le = n'est pas dans la liste filtrée (seul le ; l'est)
    expect(sanitizeString("' OR 1=1; --")).toBe(' OR 1=1 --')
  })

  it('laisse passer un texte normal sans le modifier', () => {
    expect(sanitizeString('Fayolle KOBA')).toBe('Fayolle KOBA')
  })

  it('laisse passer un email valide sans le modifier', () => {
    expect(sanitizeString('admin@bgfibank.com')).toBe('admin@bgfibank.com')
  })

  it('retourne une chaîne vide si la valeur n\'est pas une string', () => {
    expect(sanitizeString(null as any)).toBe('')
    expect(sanitizeString(undefined as any)).toBe('')
    expect(sanitizeString(123 as any)).toBe('')
  })
})

// ═══════════════════════════════════════════════
//  SUITE 2 — validateEmail
// ═══════════════════════════════════════════════
describe('validateEmail — validation du format email', () => {

  it('accepte un email standard', () => {
    expect(validateEmail('admin@bgfibank.com')).toBe(true)
  })

  it('accepte un email avec sous-domaine', () => {
    expect(validateEmail('chef.commercial@rh.bgfibank.com')).toBe(true)
  })

  it('rejette un email sans @', () => {
    expect(validateEmail('adminbgfibank.com')).toBe(false)
  })

  it('rejette un email sans domaine', () => {
    expect(validateEmail('admin@')).toBe(false)
  })

  it('rejette un email sans extension', () => {
    expect(validateEmail('admin@bgfibank')).toBe(false)
  })

  it('rejette une chaîne vide', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('rejette un texte quelconque', () => {
    expect(validateEmail('pas un email du tout')).toBe(false)
  })
})

// ═══════════════════════════════════════════════
//  SUITE 3 — minutesToHours
// ═══════════════════════════════════════════════
describe('minutesToHours — conversion minutes vers format lisible', () => {

  it('0 minutes → "0h 00m"', () => {
    expect(minutesToHours(0)).toBe('0h 00m')
  })

  it('30 minutes → "0h 30m"', () => {
    expect(minutesToHours(30)).toBe('0h 30m')
  })

  it('60 minutes → "1h 00m" (objectif 1h)', () => {
    expect(minutesToHours(60)).toBe('1h 00m')
  })

  it('480 minutes → "8h 00m" (journée complète)', () => {
    expect(minutesToHours(480)).toBe('8h 00m')
  })

  it('495 minutes → "8h 15m"', () => {
    expect(minutesToHours(495)).toBe('8h 15m')
  })

  it('601 minutes → "10h 01m"', () => {
    expect(minutesToHours(601)).toBe('10h 01m')
  })

  it('les minutes < 10 sont toujours sur 2 chiffres', () => {
    expect(minutesToHours(65)).toBe('1h 05m')
    expect(minutesToHours(121)).toBe('2h 01m')
  })
})

// ═══════════════════════════════════════════════
//  SUITE 4 — hashPassword (SHA-256)
// ═══════════════════════════════════════════════
describe('hashPassword — hachage SHA-256', () => {

  it('retourne une chaîne hexadécimale de 64 caractères', async () => {
    const hash = await hashPassword('admin123')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('le même mot de passe produit toujours le même hash (déterministe)', async () => {
    const hash1 = await hashPassword('monMotDePasse')
    const hash2 = await hashPassword('monMotDePasse')
    expect(hash1).toBe(hash2)
  })

  it('deux mots de passe différents produisent des hashs différents', async () => {
    const hash1 = await hashPassword('admin123')
    const hash2 = await hashPassword('admin124')
    expect(hash1).not.toBe(hash2)
  })

  it('un mot de passe vide produit quand même un hash valide', async () => {
    const hash = await hashPassword('')
    expect(hash).toHaveLength(64)
  })

  it('le hash connu de "admin123" est correct (valeur de référence)', async () => {
    // Valeur calculée une fois, sert de référence pour détecter toute régression
    const hash = await hashPassword('admin123')
    expect(hash).toBe('240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
  })
})

// ═══════════════════════════════════════════════
//  SUITE 5 — encryptPassword / decryptPassword (XOR+Base64)
// ═══════════════════════════════════════════════
describe('encryptPassword / decryptPassword — chiffrement réversible XOR', () => {

  it('chiffre un mot de passe en Base64', () => {
    const encrypted = encryptPassword('admin123')
    // Base64 : uniquement lettres, chiffres, +, /, =
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(encrypted).not.toBe('admin123')
  })

  it('déchiffre correctement ce qui a été chiffré', () => {
    const original = 'monMotDePasse!'
    const encrypted = encryptPassword(original)
    const decrypted = decryptPassword(encrypted)
    expect(decrypted).toBe(original)
  })

  it('fonctionne avec des mots de passe courts', () => {
    const original = 'ab'
    expect(decryptPassword(encryptPassword(original))).toBe(original)
  })

  it('fonctionne avec des mots de passe longs', () => {
    const original = 'ceMotDePasseEstTresLongEtContientDesChiffres12345!'
    expect(decryptPassword(encryptPassword(original))).toBe(original)
  })

  it('retourne "••••••••" si la chaîne chiffrée est invalide', () => {
    expect(decryptPassword('!!!invalide!!!')).toBe('••••••••')
  })

  it('deux mots de passe différents produisent des chiffrements différents', () => {
    expect(encryptPassword('pass1')).not.toBe(encryptPassword('pass2'))
  })
})

// ═══════════════════════════════════════════════
//  SUITE 6 — Rate Limiting
// ═══════════════════════════════════════════════
describe('Rate Limiting — blocage après 3 tentatives échouées', () => {

  // Remettre à zéro la map avant chaque test
  beforeEach(() => {
    loginAttempts = new Map()
  })

  it('une IP inconnue n\'est pas bloquée, il reste 3 tentatives', () => {
    const result = checkRateLimit('192.168.1.1')
    expect(result.blocked).toBe(false)
    expect(result.remaining).toBe(3)
  })

  it('après 1 tentative échouée, il reste 2 essais', () => {
    recordFailedAttempt('192.168.1.1')
    const result = checkRateLimit('192.168.1.1')
    expect(result.blocked).toBe(false)
    expect(result.remaining).toBe(2)
  })

  it('après 2 tentatives échouées, il reste 1 essai', () => {
    recordFailedAttempt('192.168.1.1')
    recordFailedAttempt('192.168.1.1')
    const result = checkRateLimit('192.168.1.1')
    expect(result.blocked).toBe(false)
    expect(result.remaining).toBe(1)
  })

  it('après 3 tentatives échouées, l\'IP est bloquée', () => {
    recordFailedAttempt('192.168.1.1')
    recordFailedAttempt('192.168.1.1')
    const last = recordFailedAttempt('192.168.1.1')
    expect(last.blocked).toBe(true)
    expect(last.remaining).toBe(0)
  })

  it('une IP bloquée est détectée par checkRateLimit', () => {
    recordFailedAttempt('10.0.0.1')
    recordFailedAttempt('10.0.0.1')
    recordFailedAttempt('10.0.0.1')
    const result = checkRateLimit('10.0.0.1')
    expect(result.blocked).toBe(true)
    expect(result.remaining).toBe(0)
    expect(result.minutesLeft).toBeGreaterThan(0)
  })

  it('resetAttempts débloque une IP immédiatement', () => {
    recordFailedAttempt('10.0.0.2')
    recordFailedAttempt('10.0.0.2')
    recordFailedAttempt('10.0.0.2')
    expect(checkRateLimit('10.0.0.2').blocked).toBe(true)

    resetAttempts('10.0.0.2')
    const result = checkRateLimit('10.0.0.2')
    expect(result.blocked).toBe(false)
    expect(result.remaining).toBe(3)
  })

  it('deux IPs différentes sont traitées indépendamment', () => {
    recordFailedAttempt('1.1.1.1')
    recordFailedAttempt('1.1.1.1')
    recordFailedAttempt('1.1.1.1')

    // IP 1 bloquée
    expect(checkRateLimit('1.1.1.1').blocked).toBe(true)
    // IP 2 pas touchée
    expect(checkRateLimit('2.2.2.2').blocked).toBe(false)
    expect(checkRateLimit('2.2.2.2').remaining).toBe(3)
  })

  it('un login réussi (resetAttempts) remet le compteur à zéro', () => {
    recordFailedAttempt('5.5.5.5')
    recordFailedAttempt('5.5.5.5')
    // 2 échecs, puis succès
    resetAttempts('5.5.5.5')
    // Nouveau échec repart de 0
    recordFailedAttempt('5.5.5.5')
    expect(checkRateLimit('5.5.5.5').remaining).toBe(2)
  })
})
