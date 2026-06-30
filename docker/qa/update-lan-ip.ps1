# update-lan-ip.ps1 — Re-apunta el stack QA a la IP LAN ACTUAL de la PC.
#
# Cuando la PC cambia de red (Wi-Fi/DHCP), su IP cambia y los QR dejan de ser
# alcanzables. Este script detecta la IP nueva, la guarda en docker/qa/.env y
# recrea SOLO Caddy. NO reconstruye las apps (el QR se deriva en runtime de la
# IP con la que abras el panel).
#
# Uso: clic derecho -> "Ejecutar con PowerShell"  (o desde una terminal en docker/qa)

$ErrorActionPreference = 'Stop'

# IP IPv4 de la interfaz con gateway por defecto (la que sale a la LAN),
# excluyendo adaptadores virtuales de WSL/Hyper-V/Loopback.
$cfg = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'WSL|vEthernet|Loopback' } |
    Select-Object -First 1
$ip = $cfg.IPv4Address.IPAddress
if (-not $ip) { Write-Error "No se pudo detectar la IP LAN. Conecta a la Wi-Fi e intenta de nuevo."; exit 1 }
$nip = $ip.Replace('.', '-')
Write-Host "IP LAN detectada: $ip   (nip.io: $nip)"

# Actualizar QA_LAN_IP / QA_LAN_NIP en docker/qa/.env (preserva el resto)
$envFile = Join-Path $PSScriptRoot ".env"
$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^(QA_LAN_IP|QA_LAN_NIP)=' } }
$lines += "QA_LAN_IP=$ip"
$lines += "QA_LAN_NIP=$nip"
Set-Content -Path $envFile -Value $lines -Encoding ascii
Write-Host ".env actualizado."

# Recrear Caddy con la IP nueva (sin rebuild de las apps)
Push-Location $PSScriptRoot
docker compose -f docker-compose.qa.yml up -d caddy
Pop-Location

Write-Host ""
Write-Host "==========================================================="
Write-Host " LISTO. Para imprimir/ver los QR, abre el panel POR LA IP:"
Write-Host "   Admin:  https://$ip`:8444"
Write-Host "   Menu :  https://$ip`:8451"
Write-Host " El QR apuntara solo a https://$ip`:8451 (sin reconstruir)."
Write-Host " Recuerda: corre SmartMenu-AbrirPuertos.bat (firewall) y"
Write-Host " ten el celular en la MISMA Wi-Fi."
Write-Host "==========================================================="
Read-Host "Enter para cerrar"
