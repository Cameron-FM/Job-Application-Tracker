@echo off
REM Job Tracker — Windows launcher.
REM
REM Lives at app\launcher\windows\launch.bat — kept out of the project root so
REM the root stays down to just the two double-click launchers, data\, and app\.
REM Normally launched via "Job Tracker (Windows).exe" (project root), a thin
REM wrapper built by make_exe.bat that just calls this file hidden — see
REM README. You CAN also double-click this file directly (Windows runs .bat
REM files on double-click with no wrapper needed); it self-locates the project
REM root regardless. All program files (incl. package.json) live in the
REM project's app\, and user data + logs live in its data\. Checks Node.js/npm,
REM reuses an already-running instance if one exists, otherwise installs deps
REM and starts the server, waits for it to become healthy, then opens the
REM browser. See app\ARCHITECTURE.md ("Desktop launchers & session lifecycle").
setlocal enabledelayedexpansion

REM --- 1. Resolve directories from the script's own location -----------------
REM This script lives at app\launcher\windows\, three levels below the project
REM root — resolve ROOT from here so it works regardless of where the repo was
REM cloned. npm commands must run inside app\ (that's where package.json lives).
set "HERE=%~dp0"
for %%I in ("%HERE%..\..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%\app"

set "PORT=3400"
set "HEALTH_URL=http://localhost:%PORT%/health"
set "APP_URL=http://localhost:%PORT%"
set "LOG_DIR=%ROOT%\data\logs"
set "LOG_FILE=%LOG_DIR%\app.log"
set "TMP_HEALTH=%TEMP%\job-tracker-health-%RANDOM%.json"

REM --- 2. Check Node.js and npm ----------------------------------------------
where node >nul 2>&1
if errorlevel 1 goto :node_missing
where npm >nul 2>&1
if errorlevel 1 goto :node_missing
goto :check_running

:node_missing
call :alert "Node.js is required to run Job Tracker but wasn't found. Install it from https://nodejs.org (the LTS version), then run Job Tracker again."
exit /b 1

REM --- 3. Already running? Reuse it instead of starting a second instance ---
REM Only trusts port 3400 if it's genuinely our /health endpoint — never
REM assumes and never kills whatever else might be using the port.
:check_running
curl -fsS --max-time 2 "%HEALTH_URL%" -o "%TMP_HEALTH%" 2>nul
if exist "%TMP_HEALTH%" (
  findstr /C:"\"app\"" "%TMP_HEALTH%" | findstr /C:"job-tracker" >nul 2>&1
  if not errorlevel 1 (
    del "%TMP_HEALTH%" >nul 2>&1
    start "" "%APP_URL%"
    exit /b 0
  )
  del "%TMP_HEALTH%" >nul 2>&1
)

REM Port-settle safety: if a previous instance was exiting at this exact moment,
REM its port may take a beat to free. Wait briefly (bounded) so a fresh start
REM won't collide — re-checking for a reusable instance each time, and never
REM hanging on a foreign process that happens to hold the port.
set /a settle=0
:settle_loop
if !settle! geq 10 goto :install
curl -s -o nul --max-time 1 "http://localhost:%PORT%/" 2>nul
if errorlevel 1 goto :install
curl -fsS --max-time 1 "%HEALTH_URL%" -o "%TMP_HEALTH%" 2>nul
if exist "%TMP_HEALTH%" (
  findstr /C:"\"app\"" "%TMP_HEALTH%" | findstr /C:"job-tracker" >nul 2>&1
  if not errorlevel 1 (
    del "%TMP_HEALTH%" >nul 2>&1
    start "" "%APP_URL%"
    exit /b 0
  )
  del "%TMP_HEALTH%" >nul 2>&1
)
timeout /t 1 /nobreak >nul
set /a settle+=1
goto :settle_loop

:install
REM --- 4. Install dependencies (keeps things in sync after a git pull) ------
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
echo [%date% %time%] Installing dependencies... >> "%LOG_FILE%"
call npm install >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  call :alert "Job Tracker couldn't install its dependencies. Check data\logs\app.log for details."
  exit /b 1
)

REM --- 5. Start the server in the background with a fresh session token ----
set "SESSION_ID=job-tracker-session-%RANDOM%%RANDOM%"
echo [%date% %time%] Starting server (session %SESSION_ID%)... >> "%LOG_FILE%"
start "JobTracker" /MIN cmd /c "set JOB_TRACKER_SESSION=%SESSION_ID%&& npm start >> "%LOG_FILE%" 2>&1"

REM --- 6. Wait for it to become healthy, then open the browser -------------
set /a attempt=0
:poll
if !attempt! geq 30 goto :timeout
curl -fsS --max-time 1 "%HEALTH_URL%" -o "%TMP_HEALTH%" 2>nul
if exist "%TMP_HEALTH%" (
  findstr /C:"\"status\"" "%TMP_HEALTH%" | findstr /C:"ok" >nul 2>&1
  if not errorlevel 1 (
    del "%TMP_HEALTH%" >nul 2>&1
    start "" "%APP_URL%"
    exit /b 0
  )
  del "%TMP_HEALTH%" >nul 2>&1
)
timeout /t 1 /nobreak >nul
set /a attempt+=1
goto :poll

:timeout
call :alert "Job Tracker didn't start within 30 seconds. Check data\logs\app.log for details."
exit /b 1

REM --- Native message box, no extra dependency (mshta ships with Windows) ---
:alert
mshta "javascript:new ActiveXObject('WScript.Shell').Popup('%~1',0,'Job Tracker',48);close();"
goto :eof
