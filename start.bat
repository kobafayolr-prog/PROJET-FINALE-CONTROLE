# ============================================
# TimeTrack BGFIBank - Démarrage du serveur
# Double-cliquez pour démarrer
# ============================================

@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════╗
echo ║      TimeTrack BGFIBank - Démarrage      ║
echo ╚══════════════════════════════════════════╝
echo.

:: Récupérer l'adresse IP locale
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo 🚀 Démarrage du serveur TimeTrack...
echo.
echo ════════════════════════════════════════
echo  Accès depuis CE PC :
echo  👉 http://localhost:3000
echo.
echo  Accès depuis les AUTRES PCs du réseau :
echo  👉 http://%IP%:3000
echo ════════════════════════════════════════
echo.
echo 📋 Comptes par défaut :
echo  Admin       : admin@bgfibank.com / Admin@2024
echo  Chef Comm.  : chef.commercial@bgfibank.com / Chef@2024
echo  Agent       : agent.commercial@bgfibank.com / Agent@2024
echo.
echo ⚠️  Gardez cette fenêtre ouverte pendant l'utilisation
echo    Appuyez sur Ctrl+C pour arrêter le serveur
echo.

:: Démarrer le serveur
npx wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000
