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

:: Mettre a jour les mots de passe (hash hex compatible Windows)
echo Mise a jour de la base de donnees...
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', password_encrypted='AwMLAAxQXFg=' WHERE email='admin@bgfibank.com'" > nul 2>&1
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', password_encrypted='IQ8DDyJTXlkG' WHERE email='chef.commercial@bgfibank.com'" > nul 2>&1
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='d8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', password_encrypted='IwADBxYhXFsABA==' WHERE email='agent.commercial@bgfibank.com'" > nul 2>&1
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='918f02a543a249b93ea3a00571a8ef19c036dd27e06d499c92845f9209c8a6a8', password_encrypted='IQ8DDyJTXlkG' WHERE email='maidou@bgfi.com'" > nul 2>&1
call npx wrangler d1 execute timetrack-production --local --command="UPDATE users SET password_hash='d8755e51a259f6ac6c2301c54f502589b326b98051982d90aa747f8c35f83236', password_encrypted='IwADBxYhXFsABA==' WHERE email='eliel@bgfi.com'" > nul 2>&1

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
echo  Comptes disponibles :
echo  Admin    : admin@bgfibank.com       / admin123
echo  Chef DC  : chef.commercial@bgfibank.com / Chef@2024
echo  Agent DC : agent.commercial@bgfibank.com / Agent@2024
echo  Chef DR  : maidou@bgfi.com          / Chef@2024
echo  Agent DR : eliel@bgfi.com           / Agent@2024
echo.
echo  Gardez cette fenetre ouverte !
echo  Ctrl+C pour arreter
echo.

:: Demarrer le serveur
npx wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000
