@echo off
chcp 65001 >nul
title TimeTrack BGFIBank - Démarrage (MySQL)
color 0A

echo.
echo  ============================================================
echo   TimeTrack BGFIBank - Démarrage du serveur (MySQL)
echo  ============================================================
echo.

cd /d "%~dp0"

:: Vérifier la présence des fichiers statiques
if not exist "public\static\admin.js" (
    echo   ATTENTION: Fichiers statiques manquants dans public\static\
    echo   Assurez-vous que le dossier public\static contient les fichiers .js et .css
    pause
    exit /b 1
)
echo   OK: Fichiers statiques présents

:: Récupérer l'IP locale
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4" ^| findstr /V "169.254"') do (
    for /f "tokens=1" %%b in ("%%a") do set LOCAL_IP=%%b
)
if "%LOCAL_IP%"=="" set LOCAL_IP=127.0.0.1

:: ============================================================
:: VÉRIFICATION PRÉREQUIS
:: ============================================================
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ERREUR: Node.js non trouvé. Lancez install-windows.bat d'abord.
    pause
    exit /b 1
)

:: Vérifier que les modules sont installés
if not exist "node_modules\express" (
    echo   Modules manquants. Installation en cours...
    call npm install --production
    if %ERRORLEVEL% neq 0 (
        echo   ERREUR: Installation des modules échouée !
        pause
        exit /b 1
    )
)

:: ============================================================
:: DÉMARRAGE AVEC PM2 (si disponible) sinon node direct
:: ============================================================
pm2 --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo   Démarrage avec PM2...
    pm2 delete timetrack >nul 2>&1
    pm2 start ecosystem.config.js
    if %ERRORLEVEL% neq 0 (
        echo   Erreur PM2, tentative avec node direct...
        goto :node_direct
    )
    timeout /t 3 /nobreak >nul
    
    echo.
    echo  ============================================================
    echo   SERVEUR DÉMARRÉ AVEC PM2
    echo  ============================================================
    echo.
    echo   Accès local      : http://localhost:3000/login
    echo   Accès réseau     : http://%LOCAL_IP%:3000/login
    echo.
    echo   Comptes par défaut :
    echo     admin@bgfibank.com             ^| admin123   (Administrateur)
    echo     dg@bgfibank.com                ^| Bgfi@2024  (Directeur General)
    echo     dir.commercial@bgfibank.com    ^| Bgfi@2024  (Directeur de Departement)
    echo     dir.conformite@bgfibank.com    ^| Bgfi@2024  (Directeur de Departement)
    echo     chef.commercial@bgfibank.com   ^| Chef@2024  (Chef de Departement)
    echo     maidou@bgfi.com                ^| Chef@2024  (Chef de Departement)
    echo     chef.service@bgfibank.com      ^| Bgfi@2024  (Chef de Service)
    echo     agent.commercial@bgfibank.com  ^| Agent@2024 (Agent)
    echo     eliel@bgfi.com                 ^| Agent@2024 (Agent)
    echo     agent2@bgfibank.com            ^| Bgfi@2024  (Agent)
    echo.
    echo   Commandes PM2 utiles :
    echo     pm2 status            - Voir l'etat du serveur
    echo     pm2 logs timetrack    - Voir les logs en direct
    echo     pm2 restart timetrack - Redemarrer
    echo     pm2 stop timetrack    - Arreter
    echo.
    echo   Sauvegarde pour redemarrage automatique au boot :
    pm2 save
    echo     OK: Configuration sauvegardee (pm2 save)
    echo  ============================================================
    echo.
    pause
    goto :eof
)

:node_direct
echo   Démarrage avec Node.js...
echo.
echo  ============================================================
echo   SERVEUR DÉMARRÉ (mode direct - gardez cette fenêtre ouverte)
echo  ============================================================
echo.
echo   Accès local      : http://localhost:3000/login
echo   Accès réseau     : http://%LOCAL_IP%:3000/login
echo.
echo   Comptes par défaut :
echo     admin@bgfibank.com             ^| admin123   (Administrateur)
echo     dg@bgfibank.com                ^| Bgfi@2024  (Directeur General)
echo     dir.commercial@bgfibank.com    ^| Bgfi@2024  (Directeur de Departement)
echo     chef.commercial@bgfibank.com   ^| Chef@2024  (Chef de Departement)
echo     chef.service@bgfibank.com      ^| Bgfi@2024  (Chef de Service)
echo     agent.commercial@bgfibank.com  ^| Agent@2024 (Agent)
echo.
echo   Appuyez sur Ctrl+C pour arreter le serveur.
echo  ============================================================
echo.

set PORT=3000
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=timetrack_user
set DB_PASSWORD=TimeTrack@BGFIBank2024!
set DB_NAME=timetrack_db
set JWT_SECRET=timetrack-bgfibank-secret-2024-x9k2p7m

node server.js
