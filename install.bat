# ============================================
# TimeTrack BGFIBank - Script d'installation Windows
# Double-cliquez sur ce fichier pour installer
# ============================================

@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════╗
echo ║     TimeTrack BGFIBank - Installation    ║
echo ╚══════════════════════════════════════════╝
echo.

:: Vérifier Node.js
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé !
    echo.
    echo Veuillez télécharger et installer Node.js depuis :
    echo https://nodejs.org/  (version 18 ou supérieure)
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js détecté : 
node --version
echo.

:: Installer les dépendances
echo 📦 Installation des dépendances...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'installation des dépendances
    pause
    exit /b 1
)
echo ✅ Dépendances installées
echo.

:: Créer la base de données locale
echo 🗄️  Création de la base de données...
call npx wrangler d1 migrations apply timetrack-production --local
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de la création de la base de données
    pause
    exit /b 1
)
echo ✅ Base de données créée
echo.

:: Insérer les données initiales
echo 📊 Insertion des données initiales...
call npx wrangler d1 execute timetrack-production --local --file=./seed.sql
echo ✅ Données initiales insérées
echo.

:: Builder le projet
echo 🔨 Construction du projet...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de la construction
    pause
    exit /b 1
)

:: Copier les fichiers statiques
xcopy /E /I /Y public\static dist\static > nul
echo ✅ Projet construit
echo.

echo ╔══════════════════════════════════════════╗
echo ║         Installation terminée ! ✅        ║
echo ╚══════════════════════════════════════════╝
echo.
echo Pour démarrer l'application, lancez : start.bat
echo.
pause
