@echo off
setlocal
set "APPDIR=%~dp0"
set "APPFILE=%APPDIR%index.html"

REM Mission PMIS Stable Working Baseline Launcher
REM Opens in an app-style Edge/Chrome window when available.

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "Mission PMIS" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APPFILE:\=/%" --window-size=1500,950
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "Mission PMIS" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APPFILE:\=/%" --window-size=1500,950
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "Mission PMIS" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%APPFILE:\=/%" --window-size=1500,950
  exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "Mission PMIS" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///%APPFILE:\=/%" --window-size=1500,950
  exit /b
)
start "" "%APPFILE%"
