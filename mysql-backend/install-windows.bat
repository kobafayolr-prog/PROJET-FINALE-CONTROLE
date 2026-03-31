@echo off
chcp 65001 >nul
title TimeTrack BGFIBank - Installation MySQL (Windows Server)
color 0A

echo.
echo  ============================================================
echo   TimeTrack BGFIBank - Installation (Windows Server + MySQL)
echo  ============================================================
echo.

:: ============================================================
:: VÉRIFICATION NODE.JS
:: ============================================================
echo [1/6] Vérification de Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo     ERREUR: Node.js non trouvé !
    echo     Téléchargez Node.js sur https://nodejs.org/ (version LTS)
    echo     Puis relancez ce script.
    pause
    exit /b 1
)
for /f %%i in ('node --version') do set NODE_VER=%%i
echo     OK: Node.js %NODE_VER% détecté

:: ============================================================
:: VÉRIFICATION NPM
:: ============================================================
echo.
echo [2/6] Vérification de npm...
npm --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo     ERREUR: npm non trouvé !
    pause
    exit /b 1
)
for /f %%i in ('npm --version') do set NPM_VER=%%i
echo     OK: npm %NPM_VER% détecté

:: ============================================================
:: VÉRIFICATION MYSQL
:: ============================================================
echo.
echo [3/6] Vérification de MySQL...
mysql --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo     MySQL n'est pas dans le PATH ou n'est pas installé.
    echo.
    echo     OPTIONS D'INSTALLATION MYSQL :
    echo     ─────────────────────────────────────────────────────
    echo     Option A (recommandée) - MySQL Community Server :
    echo       https://dev.mysql.com/downloads/mysql/
    echo       Choisissez "MySQL Installer for Windows"
    echo.
    echo     Option B - XAMPP (MySQL inclus) :
    echo       https://www.apachefriends.org/
    echo.
    echo     Option C - MariaDB (compatible) :
    echo       https://mariadb.org/download/
    echo     ─────────────────────────────────────────────────────
    echo.
    echo     Après installation, ajoutez MySQL au PATH système :
    echo       Panneau de configuration ^> Système ^> Variables d'env
    echo       PATH ^> Ajouter: C:\Program Files\MySQL\MySQL Server 8.0\bin
    echo.
    echo     Puis relancez ce script.
    pause
    exit /b 1
)
echo     OK: MySQL détecté

:: ============================================================
:: INSTALLATION DES DÉPENDANCES NPM
:: ============================================================
echo.
echo [4/6] Installation des dépendances Node.js...
cd /d "%~dp0"
call npm install --production
if %ERRORLEVEL% neq 0 (
    echo     ERREUR lors de npm install !
    pause
    exit /b 1
)
echo     OK: Dépendances installées (express, mysql2)

:: ============================================================
:: INSTALLATION PM2 (gestionnaire de processus)
:: ============================================================
echo.
echo [5/6] Installation de PM2...
pm2 --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    call npm install -g pm2
    if %ERRORLEVEL% neq 0 (
        echo     AVERTISSEMENT: PM2 non installé, utilisation de node direct
    ) else (
        echo     OK: PM2 installé
    )
) else (
    for /f %%i in ('pm2 --version') do set PM2_VER=%%i
    echo     OK: PM2 %PM2_VER% déjà présent
)

:: ============================================================
:: INITIALISATION DE LA BASE DE DONNÉES
:: ============================================================
echo.
echo [6/6] Initialisation de la base de données MySQL...
echo.
echo     IMPORTANT: Ce script va créer :
echo       - La base de données: timetrack_db
echo       - L'utilisateur MySQL: timetrack_user / TimeTrack@BGFIBank2024!
echo       - Toutes les tables et données de départ
echo.
set /p MYSQL_ROOT_PWD="     Entrez le mot de passe root MySQL (laisser vide si aucun): "

if "%MYSQL_ROOT_PWD%"=="" (
    set DB_ROOT_PASSWORD=
    node scripts/init-db.js
) else (
    set DB_ROOT_PASSWORD=%MYSQL_ROOT_PWD%
    node scripts/init-db.js
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo     ERREUR lors de l'initialisation de la base de données !
    echo     Vérifiez que MySQL est démarré (services Windows).
    echo     Services: Démarrer > services.msc > MySQL80 > Démarrer
    pause
    exit /b 1
)

:: ============================================================
:: SUCCÈS
:: ============================================================
echo.
echo  ============================================================
echo   INSTALLATION TERMINÉE AVEC SUCCÈS !
echo  ============================================================
echo.
echo   Démarrez l'application avec : start-windows.bat
echo.
echo   Comptes par défaut :
echo     admin@bgfibank.com            ^| admin123
echo     chef.commercial@bgfibank.com  ^| Chef@2024
echo     agent.commercial@bgfibank.com ^| Agent@2024
echo.
pause
