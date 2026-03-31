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

:: Copier les fichiers statiques depuis le projet parent (si pas déjà fait)
if not exist "public\static\admin.js" (
    echo   Copie des fichiers statiques...
    if not exist "public\static" mkdir public\static
    xcopy /E /Y /Q "..\public\static\*" "public\static\" >nul 2>&1
    echo   OK: Fichiers statiques copiés
)

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
    echo     admin@bgfibank.com            ^| admin123       (Admin)
    echo     chef.commercial@bgfibank.com  ^| Chef@2024      (Chef)
    echo     agent.commercial@bgfibank.com ^| Agent@2024     (Agent)
    echo.
    echo   Commandes PM2 utiles :
    echo     pm2 status            - Voir l'état du serveur
    echo     pm2 logs timetrack    - Voir les logs
    echo     pm2 restart timetrack - Redémarrer
    echo     pm2 stop timetrack    - Arrêter
    echo.
    echo   Pour démarrer automatiquement au boot Windows :
    echo     pm2 save
    echo     pm2 startup
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
echo     admin@bgfibank.com            ^| admin123       (Admin)
echo     chef.commercial@bgfibank.com  ^| Chef@2024      (Chef)
echo     agent.commercial@bgfibank.com ^| Agent@2024     (Agent)
echo.
echo   Appuyez sur Ctrl+C pour arrêter le serveur.
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
