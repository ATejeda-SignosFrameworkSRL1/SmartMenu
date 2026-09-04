# update-lan-ip.ps1 — Re-apunta el stack QA a la IP LAN ACTUAL de la PC.
#
# Cuando la PC cambia de red (Wi-Fi/DHCP), su IP cambia y los QR dejan de ser
# alcanzables. Este script detecta la IP nueva, la guarda en docker/qa/.env y
# recrea SOLO Caddy. NO reconstruye las apps (el QR se deriva en runtime de la
# IP con la que abras el panel).
#
# ORDEN IMPORTANTE: primero se detecta la IP y se ESCRIBE el .env (no necesita
# Docker), y solo despues se espera a Docker para recrear Caddy. Si Docker esta
# apagado el .env ya queda correcto y Caddy lo toma en el proximo arranque.
#
# Uso manual: clic derecho -> "Ejecutar con PowerShell".
# Uso automatico (Tarea Programada): se invoca con -Auto (silencioso, espera a Docker).

param([switch]$Auto)

$ErrorActionPreference = 'Continue'
$logFile = Join-Path $PSScriptRoot "update-lan-ip.log"
function Log($m) {
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
    if (-not $Auto) { Write-Host $m }
}

# --- 1) Detectar la IP LAN actual (interfaz con gateway, sin WSL/Hyper-V) -----
# No requiere Docker: se hace ANTES de esperarlo para que el .env nunca quede
# con la IP vieja aunque Docker Desktop este apagado.
$cfg = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'WSL|vEthernet|Loopback' } |
    Select-Object -First 1
$ip = $cfg.IPv4Address.IPAddress
if (-not $ip) {
    Log "No se pudo detectar la IP LAN (sin conexion?)."
    if (-not $Auto) { Read-Host "Enter para cerrar" }
    exit 1
}
$nip = $ip.Replace('.', '-')
Log "IP LAN detectada: $ip  (nip.io: $nip)"

# --- 2) Actualizar QA_LAN_IP / QA_LAN_NIP en docker/qa/.env (preserva el resto) ---
$envFile = Join-Path $PSScriptRoot ".env"
$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^(QA_LAN_IP|QA_LAN_NIP)=' } }
$lines += "QA_LAN_IP=$ip"
$lines += "QA_LAN_NIP=$nip"
Set-Content -Path $envFile -Value $lines -Encoding ascii
Log ".env actualizado: QA_LAN_IP=$ip / QA_LAN_NIP=$nip"

# --- 3) Esperar a que Docker responda (al iniciar sesion tarda en arrancar) ---
$deadline = (Get-Date).AddMinutes(4)
$dockerReady = $false
while ((Get-Date) -lt $deadline) {
    docker info > $null 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    Start-Sleep -Seconds 6
}
if (-not $dockerReady) {
    Log "Docker no respondio en 4 min. El .env YA quedo actualizado con $ip; Caddy tomara la IP nueva en el proximo arranque del stack (docker compose -f docker-compose.qa.yml up -d caddy)."
    if (-not $Auto) {
        Write-Host ""
        Write-Host "==========================================================="
        Write-Host " Docker no respondio, pero el .env ya quedo en $ip."
        Write-Host " Cuando Docker arranque, recrea Caddy con:"
        Write-Host "   docker compose -f docker-compose.qa.yml up -d caddy"
        Write-Host "==========================================================="
        Read-Host "Enter para cerrar"
    }
    exit 0
}

# --- 4) Recrear SOLO Caddy con la IP nueva (sin rebuild de las apps) ---------
Push-Location $PSScriptRoot
docker compose -f docker-compose.qa.yml up -d caddy > $null 2>&1
$ok = ($LASTEXITCODE -eq 0)
Pop-Location
Log ("Caddy recreado con IP {0}: {1}" -f $ip, $(if ($ok) {'OK'} else {'FALLO'}))

if (-not $Auto) {
    Write-Host ""
    Write-Host "==========================================================="
    Write-Host " LISTO. Para imprimir/ver los QR, abre el panel POR LA IP:"
    Write-Host "   Admin:  https://$ip`:8444"
    Write-Host "   Menu :  https://$ip`:8451"
    Write-Host " El QR apuntara solo a https://$ip`:8451 (sin reconstruir)."
    Write-Host " (El firewall ya es permanente; el celular debe estar en la"
    Write-Host "  misma Wi-Fi.)"
    Write-Host "==========================================================="
    Read-Host "Enter para cerrar"
}
