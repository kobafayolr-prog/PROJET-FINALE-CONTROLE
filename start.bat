@echo off
chcp 65001 > nul
echo.
echo ================================================
echo      TimeTrack BGFIBank - Demarrage
echo ================================================
echo.

:: Aller dans le dossier du script
cd /d "%~dp0"

:: Supprimer l'ancien dist
echo Nettoyage...
rmdir /S /Q dist 2>nul

:: Builder
echo Construction du projet...
call npm run build
if %errorlevel% neq 0 (
    echo ERREUR lors du build !
    pause
    exit /b 1
)

:: Copier les fichiers statiques
echo Copie des fichiers statiques...
robocopy public\static dist\static /E > nul

:: Mettre a jour le mot de passe admin
echo Mise a jour de la base de donnees...
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' WHERE email='admin@bgfibank.com'" > nul 2>&1

echo.
echo ================================================
echo  Acces depuis CE PC :
echo  http://localhost:3000
echo.
echo  Acces depuis les AUTRES PCs du reseau :
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo  http://%IP%:3000
echo ================================================
echo.
echo  Compte Admin    : admin@bgfibank.com
echo  Mot de passe    : admin123
echo.
echo  Gardez cette fenetre ouverte !
echo  Ctrl+C pour arreter
echo.

:: Demarrer le serveur
npx wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000
