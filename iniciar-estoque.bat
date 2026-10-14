@echo off
rem Liga o servidor do Controle de Estoque e o religa sozinho se ele parar por algum erro.
rem O registro (log) fica em %USERPROFILE%\estoque-servidor.log
chcp 65001 >nul
title Controle de Estoque (servidor)
set "LOG=%USERPROFILE%\estoque-servidor.log"
if exist "%LOG%" for %%A in ("%LOG%") do if %%~zA gtr 5000000 del "%LOG%"
cd /d "%~dp0backend"

:inicio
echo [%date% %time%] Iniciando o servidor... >> "%LOG%"
call npm start >> "%LOG%" 2>&1
echo [%date% %time%] O servidor parou. Reiniciando em 10 segundos... >> "%LOG%"
timeout /t 10 /nobreak >nul
goto inicio
