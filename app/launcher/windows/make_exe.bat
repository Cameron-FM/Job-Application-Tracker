@echo off
REM One-time, Windows-only step to produce a real, double-clickable
REM "Job Tracker.exe" with a custom icon, wrapping launch.bat.
REM launch.bat alone already works fine on double-click (Windows runs .bat
REM files directly) — this is purely a cosmetic upgrade for anyone who wants
REM a proper .exe with an icon instead.
REM
REM Uses the C# compiler that ships with every Windows install (part of the
REM .NET Framework since Windows 7) — no downloads, no Visual Studio needed.
REM
REM Run this ONCE, on an actual Windows machine, from anywhere:
REM   app\launcher\windows\make_exe.bat
REM It writes "Job Tracker.exe" into the project root, next to launch.bat.
setlocal

set "ROOT=%~dp0..\..\.."
set "CSC="

REM Look for csc.exe across common .NET Framework install locations.
for %%D in (
  "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319"
  "%WINDIR%\Microsoft.NET\Framework\v4.0.30319"
  "%WINDIR%\Microsoft.NET\Framework64\v3.5"
  "%WINDIR%\Microsoft.NET\Framework\v3.5"
) do (
  if exist "%%~D\csc.exe" set "CSC=%%~D\csc.exe"
)

if "%CSC%"=="" (
  echo Could not find csc.exe ^(the C# compiler^). It ships with Windows by
  echo default; if it's genuinely missing, install the .NET Framework 4
  echo runtime from https://dotnet.microsoft.com/download/dotnet-framework
  echo and run this script again.
  exit /b 1
)

echo Using compiler: %CSC%
"%CSC%" /nologo /target:winexe /out:"%ROOT%\Job Tracker.exe" /win32icon:"%~dp0JobTracker.ico" "%~dp0JobTrackerLauncher.cs"

if errorlevel 1 (
  echo.
  echo Build failed — see the compiler output above.
  exit /b 1
)

echo.
echo Done. "Job Tracker.exe" was created in the project root.
echo Double-click it to run Job Tracker.
