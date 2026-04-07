/**
 * Script d'initialisation de la base de données MySQL
 * Crée la DB, les tables et insère les données de départ
 * Usage: node scripts/init-db.js
 */

const mysql = require('mysql2/promise')
const fs    = require('fs')
const path  = require('path')

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',        // root pour la création initiale
  password: process.env.DB_ROOT_PASSWORD || process.env.DB_PASSWORD || '',
  multipleStatements: true,
  timezone: '+00:00',
  charset: 'utf8mb4'
}

async function run () {
  console.log('\n📦 Initialisation de la base de données TimeTrack BGFIBank...')
  console.log(`   Serveur: ${DB_CONFIG.host}:${DB_CONFIG.port} (user: ${DB_CONFIG.user})`)

  const conn = await mysql.createConnection(DB_CONFIG)

  try {
    // Créer l'utilisateur applicatif (si pas déjà existant)
    console.log('\n👤 Création de l\'utilisateur MySQL applicatif...')
    try {
      await conn.execute(`CREATE USER IF NOT EXISTS 'timetrack_user'@'localhost' IDENTIFIED BY 'TimeTrack@BGFIBank2024!'`)
      await conn.execute(`GRANT ALL PRIVILEGES ON timetrack_db.* TO 'timetrack_user'@'localhost'`)
      await conn.execute(`FLUSH PRIVILEGES`)
      console.log('   ✅ Utilisateur timetrack_user créé / mis à jour')
    } catch (e) {
      console.warn('   ⚠️  Utilisateur déjà existant ou droits insuffisants:', e.message)
    }

    // Exécuter le schéma
    console.log('\n🗄️  Création des tables...')
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    await conn.query(schema)
    console.log('   ✅ Tables créées avec succès')

    // Insérer les données de départ
    console.log('\n🌱 Insertion des données initiales...')
    const seed = fs.readFileSync(path.join(__dirname, '..', 'seed.sql'), 'utf8')
    await conn.query(seed)
    console.log('   ✅ Données insérées avec succès')

    console.log('\n✅ Base de données initialisée avec succès !')
    console.log('\n📋 Comptes par défaut (tous les rôles) :')
    console.log('   admin@bgfibank.com             → admin123   (Administrateur)')
    console.log('   dg@bgfibank.com                → Bgfi@2024  (Directeur Général)')
    console.log('   dir.commercial@bgfibank.com    → Bgfi@2024  (Directeur de Département)')
    console.log('   dir.conformite@bgfibank.com    → Bgfi@2024  (Directeur de Département)')
    console.log('   chef.commercial@bgfibank.com   → Chef@2024  (Chef de Département)')
    console.log('   maidou@bgfi.com                → Chef@2024  (Chef de Département)')
    console.log('   chef.service@bgfibank.com      → Bgfi@2024  (Chef de Service)')
    console.log('   agent.commercial@bgfibank.com  → Agent@2024 (Agent)')
    console.log('   eliel@bgfi.com                 → Agent@2024 (Agent — travaille le samedi)')
    console.log('   agent2@bgfibank.com            → Bgfi@2024  (Agent)')
    console.log('\n💡 Les mots de passe SHA-256 sont migrés automatiquement vers')
    console.log('   PBKDF2 (600 000 itérations) à la première connexion.')

  } finally {
    await conn.end()
  }
}

run().catch(err => {
  console.error('\n❌ Erreur:', err.message)
  console.error('\n💡 Assurez-vous que MySQL est démarré et que l\'utilisateur root a les bons droits.')
  process.exit(1)
})
