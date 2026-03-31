@echo off
:: ============================================================
:: TimeTrack BGFIBank - Configuration du Planificateur Windows
:: Lance la sauvegarde MySQL automatiquement chaque jour à 23h
:: ============================================================
:: Doit être exécuté en tant qu'Administrateur
:: ============================================================

echo.
echo ============================================================
echo  Configuration de la sauvegarde automatique MySQL
echo  TimeTrack BGFIBank
echo ============================================================
echo.

:: Vérifier les droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Ce script doit etre execute en tant qu Administrateur.
    echo   Clic droit sur le fichier → "Executer en tant qu administrateur"
    pause
    exit /b 1
)

:: Chemin du script de backup (adapter si nécessaire)
set SCRIPT_DIR=%~dp0
set BACKUP_SCRIPT=%SCRIPT_DIR%backup-mysql.bat

if not exist "%BACKUP_SCRIPT%" (
    echo [ERREUR] backup-mysql.bat introuvable dans %SCRIPT_DIR%
    pause
    exit /b 1
)

echo [INFO] Script de backup : %BACKUP_SCRIPT%
echo [INFO] Heure planifiee : 23h00 chaque jour

:: Supprimer la tâche si elle existe déjà
schtasks /delete /tn "TimeTrack_MySQL_Backup" /f >nul 2>&1

:: Créer la tâche planifiée
schtasks /create ^
    /tn "TimeTrack_MySQL_Backup" ^
    /tr "cmd.exe /c \"%BACKUP_SCRIPT%\"" ^
    /sc daily ^
    /st 23:00 ^
    /ru SYSTEM ^
    /f

if %errorlevel% equ 0 (
    echo.
    echo [OK] Tache planifiee creee avec succes !
    echo      Nom : TimeTrack_MySQL_Backup
    echo      Heure : 23h00 tous les jours
    echo.
    echo Pour verifier : ouvrez "Planificateur de taches" (taskschd.msc)
    echo Pour test immédiat : schtasks /run /tn "TimeTrack_MySQL_Backup"
) else (
    echo [ERREUR] Echec de la creation de la tache planifiee.
)

echo.
pause
