$env:PATH += ";C:\Program Files\dotnet"

$root = "c:\Users\Signos admin\Documents\GitHub\SmartMenu"

$frontends = @(
    @{ name = "client-app";      port = 3000 },
    @{ name = "admin-panel";     port = 3001 },
    @{ name = "kds-app";         port = 3002 },
    @{ name = "waiter-app";      port = 3003 },
    @{ name = "host-app";        port = 3004 },
    @{ name = "cashier-app";     port = 3005 },
    @{ name = "reservation-app"; port = 3007 }
)

Write-Host "[1/3] Verificando dependencias npm..." -ForegroundColor Cyan
foreach ($app in $frontends) {
    $path = "$root\src\frontend\$($app.name)"
    if (!(Test-Path "$path\node_modules")) {
        Write-Host "  npm install -> $($app.name)" -ForegroundColor Yellow
        Push-Location $path
        npm install --silent
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR en npm install de $($app.name)" -ForegroundColor Red
        }
        Pop-Location
    } else {
        Write-Host "  OK -> $($app.name)" -ForegroundColor DarkGray
    }
}

Write-Host "[2/3] Iniciando backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH += ';C:\Program Files\dotnet'; cd '$root\src\backend'; dotnet run --project SmartMenu.API"

Write-Host "  Esperando que el backend arranque (10s)..." -ForegroundColor DarkGray
Start-Sleep -Seconds 10

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5041/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  Backend listo (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Backend aun iniciando, continuando..." -ForegroundColor Yellow
}

Write-Host "[3/3] Iniciando frontends..." -ForegroundColor Cyan
foreach ($app in $frontends) {
    $path = "$root\src\frontend\$($app.name)"
    Write-Host "  $($app.name) -> http://localhost:$($app.port)" -ForegroundColor White
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; npm run dev"
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=== SmartMenu iniciado ===" -ForegroundColor Cyan
Write-Host "  Cliente    -> http://localhost:3000" -ForegroundColor White
Write-Host "  Admin      -> http://localhost:3001" -ForegroundColor White
Write-Host "  Chef (KDS) -> http://localhost:3002" -ForegroundColor White
Write-Host "  Mesero     -> http://localhost:3003" -ForegroundColor White
Write-Host "  Host       -> http://localhost:3004" -ForegroundColor White
Write-Host "  Caja       -> http://localhost:3005" -ForegroundColor White
Write-Host "  Reservas   -> http://localhost:3007" -ForegroundColor White
Write-Host "  Backend    -> http://localhost:5041/swagger" -ForegroundColor White
Write-Host ""
Write-Host "Espera 20 segundos para que todos los frontends compilen." -ForegroundColor DarkGray
