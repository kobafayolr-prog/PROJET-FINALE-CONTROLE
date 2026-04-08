/**
 * TimeTrack BGFIBank - 2FA TOTP (Time-based One-Time Password)
 * Implémentation complète de l'authentification à deux facteurs
 * Compatible avec Google Authenticator, Microsoft Authenticator, Authy
 */

'use strict'

const crypto = require('crypto')

/**
 * Génère un secret TOTP aléatoire (base32)
 * @returns {string} Secret base32 de 16 caractères
 */
function generateSecret () {
  const buffer = crypto.randomBytes(10)
  return base32Encode(buffer)
}

/**
 * Génère 10 codes de secours à usage unique
 * @returns {string[]} Array de 10 codes alphanumériques de 8 caractères
 */
function generateBackupCodes () {
  const codes = []
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(code)
  }
  return codes
}

/**
 * Encode un buffer en base32 (RFC 4648)
 * @param {Buffer} buffer
 * @returns {string} Chaîne base32
 */
function base32Encode (buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Décode une chaîne base32 en buffer
 * @param {string} str Chaîne base32
 * @returns {Buffer}
 */
function base32Decode (str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let index = 0
  const output = Buffer.alloc(Math.ceil(str.length * 5 / 8))

  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i).toUpperCase()
    const val = alphabet.indexOf(char)
    if (val === -1) continue

    value = (value << 5) | val
    bits += 5

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
    }
  }

  return output.slice(0, index)
}

/**
 * Génère un code TOTP à 6 chiffres pour un secret donné
 * @param {string} secret Secret base32
 * @param {number} [time] Timestamp Unix (par défaut : now)
 * @returns {string} Code TOTP à 6 chiffres
 */
function generateTOTP (secret, time = null) {
  const epoch = time || Math.floor(Date.now() / 1000)
  const counter = Math.floor(epoch / 30) // Intervalle de 30 secondes

  const secretBuffer = base32Decode(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', secretBuffer)
  hmac.update(counterBuffer)
  const hash = hmac.digest()

  const offset = hash[hash.length - 1] & 0x0f
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = binary % 1000000
  return String(otp).padStart(6, '0')
}

/**
 * Vérifie un code TOTP avec tolérance de ±1 intervalle (90 secondes)
 * @param {string} token Code à vérifier (6 chiffres)
 * @param {string} secret Secret base32
 * @returns {boolean} true si le code est valide
 */
function verifyTOTP (token, secret) {
  if (!token || !secret) return false
  if (!/^\d{6}$/.test(token)) return false

  const now = Math.floor(Date.now() / 1000)

  // Vérifier l'intervalle actuel et ±1 (tolérance de décalage)
  for (let offset = -1; offset <= 1; offset++) {
    const timeWindow = now + offset * 30
    const expectedToken = generateTOTP(secret, timeWindow)
    if (token === expectedToken) return true
  }

  return false
}

/**
 * Génère une URL otpauth:// pour QR code
 * @param {string} secret Secret base32
 * @param {string} accountName Email de l'utilisateur
 * @param {string} [issuer] Nom de l'application
 * @returns {string} URL otpauth://
 */
function generateOtpauthUrl (secret, accountName, issuer = 'TimeTrack BGFIBank') {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedAccount = encodeURIComponent(accountName)
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

module.exports = {
  generateSecret,
  generateBackupCodes,
  generateTOTP,
  verifyTOTP,
  generateOtpauthUrl
}
