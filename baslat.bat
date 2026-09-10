@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist dur.stop del dur.stop
for %%f in (bot.log) do if %%~zf GTR 5000000 move /y bot.log bot-eski.log >nul 2>&1
:dongu
echo [%date% %time%] Bot baslatiliyor... >> bot.log
node index.js >> bot.log 2>&1
if exist dur.stop (
  del dur.stop
  echo [%date% %time%] Bot bilerek durduruldu. >> bot.log
  exit /b 0
)
echo [%date% %time%] Bot kapandi! 3sn sonra yeniden baslatiliyor... >> bot.log
timeout /t 3 /nobreak >nul
goto dongu
