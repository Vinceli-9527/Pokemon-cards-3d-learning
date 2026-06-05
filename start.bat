@echo off
title pokemon-cards-3d-learning
cd /d "%~dp0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo ============================================
echo   Marnie TCG Cards - http://localhost:3000/
echo   按 Ctrl+C 停止
echo ============================================
start http://localhost:3000
C:\Python314\python.exe -m http.server 3000
pause
