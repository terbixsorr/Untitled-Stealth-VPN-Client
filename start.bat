@echo off
chcp 65001 >nul
cd /d "C:\C41A~1"
start "" "C:\C41A~1\node_modules\electron\dist\electron.exe" "C:\C41A~1\main.js"
exit /b