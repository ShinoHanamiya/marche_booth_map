@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo Marche Booth Map v1.6 - Editor Server
echo.
echo Editor: http://localhost:8000/editor.html
echo Stop: Ctrl+C
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/editor.html
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/editor.html
  python -m http.server 8000
  goto :eof
)
echo Python was not found.
pause
