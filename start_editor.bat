@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo Marche Booth Map v1.11 - Event Manager / Editor Server
echo.
echo Event Manager: http://localhost:8000/event_manager.html
echo Viewer:       http://localhost:8000/
echo Stop: Ctrl+C
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/event_manager.html
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/event_manager.html
  python -m http.server 8000
  goto :eof
)
echo Python was not found.
pause
