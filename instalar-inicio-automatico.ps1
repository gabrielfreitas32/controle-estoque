# Faz o Controle de Estoque ligar sozinho quando você entra no Windows (sem janela e sem VS Code).
# Para instalar:  powershell -ExecutionPolicy Bypass -File .\instalar-inicio-automatico.ps1
# Para remover:   powershell -ExecutionPolicy Bypass -File .\instalar-inicio-automatico.ps1 -Remover
param([switch]$Remover)

$nome = 'Controle de Estoque'

if ($Remover) {
  Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host 'Início automático removido. Se o servidor ainda estiver aberto, reinicie o computador ou encerre o node.exe.'
  exit 0
}

$vbs = Join-Path $PSScriptRoot 'iniciar-estoque-oculto.vbs'
if (-not (Test-Path $vbs)) {
  Write-Host 'Não encontrei o arquivo iniciar-estoque-oculto.vbs ao lado deste script.' -ForegroundColor Red
  exit 1
}

$acao      = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""
$gatilho   = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$config    = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

try {
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Principal $principal -Force -ErrorAction Stop | Out-Null
} catch {
  Write-Host 'Não foi possível criar a tarefa. Abra o PowerShell como administrador (botão direito > Executar como administrador) e rode o comando de novo.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Start-ScheduledTask -TaskName $nome
Write-Host 'Pronto! O Controle de Estoque vai ligar sozinho sempre que você entrar no Windows.' -ForegroundColor Green
Write-Host 'Ele já foi iniciado agora. Aguarde uns 10 segundos e abra http://localhost:3000'
Write-Host "Registro do servidor: $env:USERPROFILE\estoque-servidor.log"
