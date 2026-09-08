@echo off
cd /d "%~dp0"
echo.
echo Mission Companion local server

echo Open http://localhost:8000 in your browser.
echo Press Ctrl+C here to stop the server.
echo.
py -m http.server 8000 2>nul || python -m http.server 8000
pause
