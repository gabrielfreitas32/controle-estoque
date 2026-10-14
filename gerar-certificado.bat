@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Gerando o certificado HTTPS...
call npm run gerar-certificado
echo.
echo Para liberar a porta no Firewall, abra o PowerShell COMO ADMINISTRADOR e rode:
echo   netsh advfirewall firewall add rule name="Estoque HTTPS" dir=in action=allow protocol=TCP localport=3443
pause
