@echo off
title FeetOnFocus Backup Organizer
echo =====================================
echo   FeetOnFocus Backup Organizer
echo =====================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0organize-backups.ps1"

echo.
echo Press any key to close...
pause >nul
