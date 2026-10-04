@echo off
setlocal
rem DevToolkit launcher for Windows. Double-click to start, then open the URL shown.
rem Optional: set HOST=0.0.0.0 to share on your network, PORT=8080 to change the port.
cd /d "%~dp0"
if "%PORT%"=="" set PORT=8080

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" "http://localhost:%PORT%/"
  node server\server.mjs
  goto :end
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Node.js not found - using Python instead.
  start "" "http://localhost:%PORT%/"
  python server\serve.py
  goto :end
)

echo.
echo  DevToolkit needs Node.js 18+ or Python 3.8+ to run its local web server.
echo  Install one of them, or ask your administrator to host DevToolkit on your network.
echo.
pause
:end
endlocal
