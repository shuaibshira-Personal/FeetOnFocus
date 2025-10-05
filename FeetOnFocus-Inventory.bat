@echo off
echo Starting FeetOnFocus Inventory Management System...
echo.

REM Check if executable exists
if not exist "dist\FeetOnFocus-Inventory-win32-x64\FeetOnFocus-Inventory.exe" (
    echo Error: Application not found!
    echo Please run: npm run package
    echo.
    pause
    exit /b 1
)

REM Start the application
start "" "dist\FeetOnFocus-Inventory-win32-x64\FeetOnFocus-Inventory.exe"

echo Application started successfully!
timeout /t 2 /nobreak >nul