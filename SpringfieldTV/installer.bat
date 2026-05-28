@echo off
setlocal enabledelayedexpansion

:: 1. RICHIESTA PRIVILEGI AMMINISTRATORE
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Richiesta privilegi amministratore...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d ""%~dp0"" && ""%~f0""' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ============================================
echo   SpringfieldTV - Installazione Automatica
echo ============================================
echo.

:: 2. VERIFICA E AGGIORNAMENTO NODE.JS v22
set "NEED_UPDATE=0"
where node >nul 2>&1
if %errorlevel% equ 0 (
    node -v | findstr "v20." >nul
    if !errorlevel! equ 0 (
        echo [AVVISO] Rilevato Node.js v20. Puppeteer richiede la v22 o superiore.
        echo [INFO] Aggiornamento in corso...
        set "NEED_UPDATE=1"
    ) else (
        echo [OK] Node.js aggiornato gia' presente. Versione:
        node --version
    )
) else (
    set "NEED_UPDATE=1"
)

if "%NEED_UPDATE%"=="1" (
    echo [INFO] Download di Node.js v22.12.0...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'Continue'; try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi' -OutFile \"$env:TEMP\node_installer.msi\" -ErrorAction Stop } catch { Write-Host 'ERRORE: Download fallito - ' $_.Exception.Message; exit 1 }"
    
    if not exist "%TEMP%\node_installer.msi" (
        echo [ERRORE] Il download di Node.js e' fallito.
        goto :errore
    )

    echo [INFO] Installazione silenziosa di Node.js v22 in corso...
    msiexec /i "%TEMP%\node_installer.msi" /qn /norestart
    if %errorlevel% neq 0 (
        echo [ERRORE] Installazione MSI fallita con codice %errorlevel%
        del "%TEMP%\node_installer.msi" 2>nul
        goto :errore
    )
    del "%TEMP%\node_installer.msi" 2>nul
    echo [OK] Node.js installato con successo.
)

:find_npm
set "PATH=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%PATH%;%APPDATA%\npm"

set "NPM_CMD="
if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if exist "C:\Program Files (x86)\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\x86\nodejs\npm.cmd"
if "%NPM_CMD%"=="" where npm >nul 2>&1 && set "NPM_CMD=npm"

if "%NPM_CMD%"=="" (
    echo [ERRORE] Impossibile trovare npm nel sistema. Riavvia il PC e riprova.
    goto :errore
)

echo [OK] Trovato npm di sistema: "%NPM_CMD%"
echo.

:: 3. PREPARAZIONE DESTINAZIONE E COPIA PULITA
set "DEST=%LOCALAPPDATA%\SpringfieldTV"
echo [INFO] Cartella destinazione: %DEST%

if not exist "%DEST%" mkdir "%DEST%"

echo \node_modules\ > "%TEMP%\exclude_list.txt"
echo .msi >> "%TEMP%\exclude_list.txt"
echo .exe >> "%TEMP%\exclude_list.txt"
echo %~nx0 >> "%TEMP%\exclude_list.txt"

echo [INFO] Copia dei file di progetto in corso...
xcopy /E /Y /Q /EXCLUDE:%TEMP%\exclude_list.txt "%~dp0*" "%DEST%\" >nul 2>&1
del "%TEMP%\exclude_list.txt" 2>nul

cd /d "%DEST%"

if exist "node_modules" rd /s /q "node_modules"

:: 4. INSTALLAZIONE DIPENDENZE
echo [INFO] Esecuzione di 'npm install' per Puppeteer...
echo [INFO] Scaricamento moduli e Chromium in corso (Attendi qualche minuto)...
echo.

cmd /c ""%NPM_CMD%" install --no-audit --no-fund"
if %errorlevel% neq 0 (
    echo.
    echo [ERRORE] L'installazione dei pacchetti npm e' fallita.
    goto :errore
)

echo.
echo [OK] Dipendenze installate con successo.

:: 5. CREAZIONE COLLEGAMENTO CON ICONA PERSONALIZZATA
echo [INFO] Creazione collegamento sul Desktop con icona...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\SpringfieldTV.lnk'); $s.TargetPath = '%DEST%\run.vbs'; $s.WorkingDirectory = '%DEST%'; if (Test-Path '%DEST%\icon.ico') { $s.IconLocation = '%DEST%\icon.ico' }; $s.Save()"

echo.
echo [OK] Installazione completata! Chiusura in corso...
exit /b 0

:errore
echo.
echo ============================================
echo   L'INSTALLAZIONE E' FALLITA!
echo ============================================
pause
exit /b 1