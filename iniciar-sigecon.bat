@echo off
title SiGeCon - Servidor (desenvolvimento)
cd /d "%~dp0"
echo ============================================================
echo   SiGeCon - servidor de desenvolvimento
echo   Endereco: http://localhost:3000
echo   O navegador abre sozinho em alguns segundos.
echo   Para PARAR: clique aqui e aperte Ctrl + C, ou feche a janela.
echo ============================================================
echo.
rem Abre o navegador depois de 6s (tempo de o servidor subir)
start "" powershell -WindowStyle Hidden -Command "Start-Sleep 6; Start-Process 'http://localhost:3000'"
call npm run dev
echo.
echo Servidor encerrado. Pode fechar esta janela.
pause
