@echo off
title SiGeCon - Compartilhar (tunel Cloudflare)
cd /d "%~dp0"
echo Iniciando o servidor em uma nova janela...
start "SiGeCon - Servidor" /D "%~dp0" cmd /k "npm run dev"
echo Aguardando o servidor subir (10 segundos)...
timeout /t 10 >nul
echo.
echo ============================================================
echo   Criando o tunel publico do Cloudflare.
echo   Copie o link  https://....trycloudflare.com  abaixo.
echo   Para PARAR: aperte Ctrl + C aqui e feche a janela do servidor.
echo ============================================================
echo.
cloudflared tunnel --url http://localhost:3000
echo.
echo Tunel encerrado. Pode fechar esta janela.
pause
