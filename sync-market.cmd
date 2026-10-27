@echo off
setlocal
cd /d "%~dp0"
node scripts\sync-market.mjs %*
exit /b %errorlevel%
