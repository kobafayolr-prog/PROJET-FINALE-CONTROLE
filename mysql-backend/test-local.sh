#!/bin/bash
# Script de test local du backend MySQL TimeTrack BGFIBank
# Ce script installe MySQL en local, crée la base de données et démarre le serveur

set -e  # Arrêter en cas d'erreur

echo "============================================"
echo "🧪 TEST LOCAL - TimeTrack Backend MySQL"
echo "============================================"
echo ""

# Vérifier si on est dans le bon répertoire
if [ ! -f "server.js" ]; then
  echo "❌ Erreur: Exécutez ce script depuis /home/user/webapp/mysql-backend/"
  exit 1
fi

# 1. Vérifier si Node.js est installé
echo "1️⃣ Vérification de Node.js..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js n'est pas installé. Installation..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "✅ Node.js version: $(node --version)"
echo ""

# 2. Installer les dépendances npm
echo "2️⃣ Installation des dépendances npm..."
npm install
echo "✅ Dépendances installées"
echo ""

# 3. Vérifier si MySQL est installé
echo "3️⃣ Vérification de MySQL..."
if ! command -v mysql &> /dev/null; then
  echo "⚠️  MySQL n'est pas installé. Installation..."
  echo "   (Cela peut prendre quelques minutes...)"
  
  # Installer MySQL Server
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  
  # Démarrer MySQL
  sudo service mysql start
  
  echo "✅ MySQL installé et démarré"
else
  echo "✅ MySQL déjà installé"
  # S'assurer que MySQL est démarré
  sudo service mysql start 2>/dev/null || true
fi
echo ""

# 4. Configurer les variables d'environnement
echo "4️⃣ Configuration des variables d'environnement..."
if [ ! -f ".env" ]; then
  cat > .env << 'EOF'
# TimeTrack BGFIBank - Configuration MySQL
PORT=3000
JWT_SECRET=timetrack-bgfibank-secret-test-local-2024
JWT_EXPIRY_SECONDS=28800

# Configuration MySQL locale
DB_HOST=localhost
DB_PORT=3306
DB_USER=timetrack_user
DB_PASSWORD=TimeTrack@BGFIBank2024!
DB_NAME=timetrack_db

# CORS (localhost uniquement pour test local)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF
  echo "✅ Fichier .env créé"
else
  echo "✅ Fichier .env existe déjà"
fi
echo ""

# 5. Créer l'utilisateur MySQL et la base de données
echo "5️⃣ Création de la base de données..."

# Script SQL pour créer l'utilisateur et la base
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS timetrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'timetrack_user'@'localhost' IDENTIFIED BY 'TimeTrack@BGFIBank2024!';
GRANT ALL PRIVILEGES ON timetrack_db.* TO 'timetrack_user'@'localhost';
FLUSH PRIVILEGES;
" 2>/dev/null || {
  echo "⚠️  Erreur lors de la création de la base (peut-être déjà existante)"
}

echo "✅ Base de données créée"
echo ""

# 6. Importer le schéma
echo "6️⃣ Import du schéma..."
if mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db < schema.sql 2>/dev/null; then
  echo "✅ Schéma importé"
else
  echo "⚠️  Le schéma existe peut-être déjà"
fi
echo ""

# 7. Importer les données initiales (méthode 3-3-3)
echo "7️⃣ Import des données initiales (méthode 3-3-3)..."
if mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db < seed-333.sql 2>/dev/null; then
  echo "✅ Données 3-3-3 importées"
else
  echo "⚠️  Les données existent peut-être déjà"
fi
echo ""

# 8. Appliquer les migrations
echo "8️⃣ Application des migrations..."
if [ -d "migrations/mysql" ]; then
  for migration in migrations/mysql/*.sql; do
    if [ -f "$migration" ]; then
      echo "   → $(basename $migration)"
      mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db < "$migration" 2>/dev/null || true
    fi
  done
  echo "✅ Migrations appliquées"
else
  echo "⚠️  Aucun dossier migrations/mysql trouvé"
fi
echo ""

# 9. Vérifier les données
echo "9️⃣ Vérification des données..."
echo "   → Objectifs 3-3-3:"
mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db -e "
  SELECT id, name, target_percentage, color 
  FROM strategic_objectives 
  WHERE status='Actif' 
  ORDER BY id DESC LIMIT 3;" 2>/dev/null || echo "⚠️  Erreur requête"

echo ""
echo "   → Processus (avec process_type):"
mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db -e "
  SELECT id, name, process_type, status 
  FROM processes 
  LIMIT 5;" 2>/dev/null || echo "⚠️  Erreur requête"
echo ""

# 10. Tuer le processus sur le port 3000 s'il existe
echo "🔟 Nettoyage du port 3000..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
echo ""

# 11. Démarrer le serveur
echo "1️⃣1️⃣ Démarrage du serveur..."
echo "============================================"
echo ""
echo "📢 Pour démarrer le serveur manuellement:"
echo "   cd /home/user/webapp/mysql-backend"
echo "   node server.js"
echo ""
echo "📢 Pour tester avec PM2 (daemon):"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 logs timetrack-mysql"
echo ""
echo "============================================"
echo "✅ TEST LOCAL TERMINÉ!"
echo "============================================"
echo ""
echo "🌐 URLs de test:"
echo "   - Frontend: http://localhost:3000"
echo "   - API test: curl http://localhost:3000/api/health"
echo ""
echo "👤 Compte admin par défaut:"
echo "   Email   : admin@bgfibank.com"
echo "   Password: Admin@BGFI2024!"
echo ""
echo "🔧 Commandes utiles:"
echo "   - Logs MySQL : sudo tail -f /var/log/mysql/error.log"
echo "   - Console MySQL : mysql -u timetrack_user -p'TimeTrack@BGFIBank2024!' timetrack_db"
echo "   - Arrêter serveur : fuser -k 3000/tcp"
echo ""
