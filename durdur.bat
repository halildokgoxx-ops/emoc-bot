@echo off
cd /d "%~dp0"
echo dur> dur.stop
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Bot durduruldu.
pause
