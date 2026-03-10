@echo off
echo Starting Blood Emergency Website...
echo.

cd /d "%~dp0backend"

if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo Starting server...
npm start

pause
