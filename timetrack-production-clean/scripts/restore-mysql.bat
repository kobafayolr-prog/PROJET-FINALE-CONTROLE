@echo off
:: ============================================================
:: TimeTrack BGFIBank - Restauration MySQL depuis un backup
:: ============================================================
:: USAGE : restore-mysql.bat [fichier.sql]
:: Exemple : restore-mysql.bat C:\TimeTrack\backups\timetrack_2024-01-15.sql
:: ============================================================

setlocal

set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_NAME=timetrack_db
set MYSQL_PATH=mysql

:: Vérifier l'argument
if "%~1"=="" (
    echo Usage: restore-mysql.bat [fichier_backup.sql]
    echo.
    echo Backups disponibles dans C:\TimeTrack\backups\ :
    dir /b "C:\TimeTrack\backups\timetrack_*.sql*" 2>nul
    pause
    exit /b 1
)

set BACKUP_FILE=%~1

if not exist "%BACKUP_FILE%" (
    echo [ERREUR] Fichier introuvable : %BACKUP_FILE%
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  ATTENTION : Cette operation va remplacer toutes les donnees
echo  de la base %DB_NAME% par le contenu du backup.
echo.
echo  Fichier : %BACKUP_FILE%
echo ============================================================
echo.
set /p CONFIRM=Etes-vous sur ? (OUI/non) : 
if /i not "%CONFIRM%"=="OUI" (
    echo [INFO] Restauration annulee.
    pause
    exit /b 0
)

echo.
echo Entrez le mot de passe root MySQL :
set /p ROOT_PASS=Mot de passe root : 

:: Décompresser si .gz
set SQL_FILE=%BACKUP_FILE%
if "%BACKUP_FILE:~-3%"==".gz" (
    echo [INFO] Decompression du fichier...
    set SQL_FILE=%BACKUP_FILE:.gz=%
    gzip -d -k "%BACKUP_FILE%"
    if %errorlevel% neq 0 (
        echo [ERREUR] Echec de la decompression
        pause
        exit /b 1
    )
)

echo [INFO] Restauration en cours...
%MYSQL_PATH% --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% --password=%ROOT_PASS% %DB_NAME% < "%SQL_FILE%"

if %errorlevel% equ 0 (
    echo [OK] Restauration reussie !
    echo     Base : %DB_NAME%
    echo     Source : %SQL_FILE%
) else (
    echo [ERREUR] La restauration a echoue !
)

pause
