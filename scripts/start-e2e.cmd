@echo off
setlocal

cd /d "%~dp0.."

where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -ExecutionPolicy Bypass -File ".\scripts\set-e2e-env.ps1" -RunTests
  goto :end
)

where powershell >nul 2>nul
if %errorlevel%==0 (
  powershell -ExecutionPolicy Bypass -File ".\scripts\set-e2e-env.ps1" -RunTests
  goto :end
)

echo Error: Weder pwsh noch powershell gefunden.
echo Bitte PowerShell installieren oder PATH pruefen.
exit /b 1

:end
endlocal
