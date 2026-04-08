@echo off
:: ============================================================
:: TimeTrack BGFIBank - Sauvegarde automatique MySQL
:: À programmer via Windows Task Scheduler (Planificateur)
:: ============================================================
:: UTILISATION :
::   1. Copier ce fichier sur votre serveur Windows
::   2. Ouvrir "Planificateur de tâches" (taskschd.msc)
::   3. Créer une tâche : tous les jours à 23h00
::   4. Action : exécuter ce script backup-mysql.bat
:: ============================================================

setlocal enabledelayedexpansion

:: --- CONFIGURATION ---
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=timetrack_user
set DB_PASSWORD=TimeTrack@BGFIBank2024!
set DB_NAME=timetrack_db

:: Dossier de sauvegarde (modifier selon votre serveur)
set BACKUP_DIR=C:\TimeTrack\backups
set MYSQLDUMP_PATH=mysqldump

:: Rétention : nombre de jours à conserver
set RETENTION_DAYS=30

:: --- NE PAS MODIFIER EN DESSOUS ---
set TIMESTAMP=%date:~6,4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\timetrack_%TIMESTAMP%.sql.gz

echo.
echo ============================================================
echo  TimeTrack BGFIBank - Sauvegarde MySQL
echo  Date : %date% %time%
echo ============================================================

:: Créer le dossier de backup si inexistant
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Vérifier que mysqldump est disponible
where %MYSQLDUMP_PATH% >nul 2>&1
if %errorlevel% neq 0 (
    :: Essayer le chemin par défaut MySQL
    set MYSQLDUMP_PATH="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
    if not exist !MYSQLDUMP_PATH! (
        echo [ERREUR] mysqldump introuvable. Ajoutez MySQL\bin au PATH système.
        exit /b 1
    )
)

:: Effectuer la sauvegarde avec compression
echo [INFO] Sauvegarde en cours : %DB_NAME% -> %BACKUP_FILE%

%MYSQLDUMP_PATH% ^
    --host=%DB_HOST% ^
    --port=%DB_PORT% ^
    --user=%DB_USER% ^
    --password=%DB_PASSWORD% ^
    --single-transaction ^
    --routines ^
    --triggers ^
    --add-drop-table ^
    --complete-insert ^
    %DB_NAME% > "%BACKUP_DIR%\timetrack_%TIMESTAMP%.sql"

if %errorlevel% equ 0 (
    echo [OK] Sauvegarde reussie : timetrack_%TIMESTAMP%.sql
    
    :: Vérifier si gzip est disponible (Git Bash, WSL, ou 7-Zip)
    where gzip >nul 2>&1
    if %errorlevel% equ 0 (
        gzip "%BACKUP_DIR%\timetrack_%TIMESTAMP%.sql"
        echo [OK] Fichier compresse : timetrack_%TIMESTAMP%.sql.gz
    ) else (
        echo [INFO] gzip non disponible - backup non compresse
    )
) else (
    echo [ERREUR] La sauvegarde a echoue !
    exit /b 1
)

:: Suppression des anciens backups (> RETENTION_DAYS jours)
echo [INFO] Nettoyage des backups de plus de %RETENTION_DAYS% jours...
forfiles /p "%BACKUP_DIR%" /s /m "timetrack_*.sql*" /d -%RETENTION_DAYS% /c "cmd /c del @path" 2>nul
echo [OK] Nettoyage termine

:: Afficher le contenu du dossier
echo.
echo === Backups disponibles ===
dir /b "%BACKUP_DIR%\timetrack_*.sql*" 2>nul

echo.
echo [OK] Sauvegarde terminee avec succes.
echo.
