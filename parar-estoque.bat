@echo off
rem Para o servidor do Controle de Estoque (encerra o node.exe e o iniciar-estoque.bat).
chcp 65001 >nul
echo Parando o Controle de Estoque...
schtasks /End /TN "Controle de Estoque" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
echo Pronto. Para ligar de novo, saia e entre no Windows ou use: schtasks /Run /TN "Controle de Estoque"
pause
