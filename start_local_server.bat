@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo Marche Booth Map v1.11.1 - Local Server
echo.
echo Viewer:       http://localhost:8000/
echo Event Manager:http://localhost:8000/event_manager.html
echo Stop: Ctrl+C
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  python -m http.server 8000
  goto :eof
)
echo Python was not found.
echo Install Python or use GitHub Pages for viewing.
pause
