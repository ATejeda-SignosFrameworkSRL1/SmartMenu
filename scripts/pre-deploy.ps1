<#
.SYNOPSIS
  Pre-deploy gate OBLIGATORIO (S1.D4) — corre las 5 etapas del pipeline en orden,
  fail-fast. Nada va a QA si esto no termina verde.

.DESCRIPTION
  Regla #1 del contrato de testing: ningún `docker compose build && up` a QA sin que
  esta suite pase entera. Stage rojo → STOP.

    Stage 1: Lint + Build       (<2 min)  — 7 frontends + backend
    Stage 2: Unit tests         (<5 min)  — coverage gate 30 % (ratchet S1)
    Stage 3: Integration tests  (~10 min) — Testcontainers SQL Server real
    Stage 4: Container smoke    (~10 min) — docker compose up + health checks
    Stage 5: E2E (opcional)     (~15 min) — Playwright; --SkipE2E para omitirlo

.PARAMETER SkipE2E
  Omite Stage 5 (útil para iteración local rápida; CI siempre lo corre).

.PARAMETER SkipContainerSmoke
  Omite Stage 4 (cuando Docker no esté disponible).

.PARAMETER CoverageThreshold
  Mínimo de line coverage para Stage 2. Default 30 (Sprint 1). Roadmap: 50 (S2), 70 (S3).

.EXAMPLE
  .\scripts\pre-deploy.ps1
  Corre las 5 etapas completas.

.EXAMPLE
  .\scripts\pre-deploy.ps1 -SkipE2E -SkipContainerSmoke
  Solo lint/build + unit + integration (loop de desarrollo).
#>
param(
    [switch]$SkipE2E,
    [switch]$SkipContainerSmoke,
    [int]$CoverageThreshold = 30
)

$ErrorActionPreference = 'Stop'
$startTime = Get-Date
$repoRoot = Split-Path -Parent $PSScriptRoot

function Write-Stage($n, $title) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  STAGE $n — $title" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Fail-Stage($n, $reason) {
    Write-Host ""
    Write-Host "❌  STAGE $n FAILED: $reason" -ForegroundColor Red
    Write-Host "Pipeline detenido. NO se debe deployar." -ForegroundColor Red
    exit 1
}

function Pass-Stage($n, $title) {
    Write-Host ""
    Write-Host "✅  STAGE $n PASSED: $title" -ForegroundColor Green
}

# ─── STAGE 1: Lint + Build ──────────────────────────────────────────────────
Write-Stage 1 "Lint + Build (frontends + backend)"

$frontends = @('client-app', 'admin-panel', 'kds-app', 'waiter-app', 'host-app', 'cashier-app', 'reservation-app')

foreach ($app in $frontends) {
    $appPath = Join-Path $repoRoot "src\frontend\$app"
    Write-Host "  → $app  (lint + type-check + test --if-present)..." -ForegroundColor DarkGray
    Push-Location $appPath
    try {
        npm run lint 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail-Stage 1 "$app  lint" }
        npm run type-check 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail-Stage 1 "$app  type-check" }
        # S1.D5: vitest si la app tiene script `test`. --if-present no falla si no existe.
        npm test --if-present 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail-Stage 1 "$app  test" }
    } finally { Pop-Location }
}

Write-Host "  → backend  dotnet build Release..." -ForegroundColor DarkGray
Push-Location (Join-Path $repoRoot "src\backend")
try {
    dotnet build SmartMenu.sln --configuration Release --nologo /p:TreatWarningsAsErrors=false 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail-Stage 1 "backend dotnet build" }
} finally { Pop-Location }
Pass-Stage 1 "Lint + Build"

# ─── STAGE 2: Unit tests + coverage gate ────────────────────────────────────
Write-Stage 2 "Unit tests + coverage gate $CoverageThreshold%"

Push-Location $repoRoot
try {
    # ThresholdStat=average → floor del promedio per-módulo. Captura el espíritu del
    # ratchet (30→50→70%). Excluímos SmartMenu.API porque controllers se cubren con
    # integration tests, no unit. Stat=total estaría dominado por código no-business
    # (migrations, hubs, Program.cs) y daría señales engañosas.
    dotnet test tests/SmartMenu.UnitTests/SmartMenu.UnitTests.csproj `
        --configuration Release --nologo `
        /p:CollectCoverage=true `
        /p:CoverletOutputFormat=cobertura `
        /p:CoverletOutput=$repoRoot/coverage/unit/ `
        /p:Exclude='[SmartMenu.API]*' `
        /p:Threshold=$CoverageThreshold `
        /p:ThresholdType=line `
        /p:ThresholdStat=average
    if ($LASTEXITCODE -ne 0) { Fail-Stage 2 "unit tests / coverage threshold" }
} finally { Pop-Location }
Pass-Stage 2 "Unit tests verdes + coverage ≥ $CoverageThreshold%"

# ─── STAGE 3: Integration tests con Testcontainers ──────────────────────────
Write-Stage 3 "Integration tests (Testcontainers SQL Server)"

# Verifica Docker antes de intentar
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail-Stage 3 "Docker no responde — Testcontainers necesita el daemon" }
} catch { Fail-Stage 3 "Docker daemon inaccesible" }

Push-Location $repoRoot
try {
    dotnet test tests/SmartMenu.IntegrationTests/SmartMenu.IntegrationTests.csproj `
        --configuration Release --nologo
    if ($LASTEXITCODE -ne 0) { Fail-Stage 3 "integration tests" }
} finally { Pop-Location }
Pass-Stage 3 "Integration tests verdes contra SQL Server real"

# ─── STAGE 4: Container smoke (docker compose QA) ───────────────────────────
if ($SkipContainerSmoke) {
    Write-Host ""
    Write-Host "⚠  STAGE 4 SKIPPED por -SkipContainerSmoke" -ForegroundColor Yellow
} else {
    Write-Stage 4 "Container smoke (docker compose QA stack)"

    # Usa el compose dev (más rápido y sin Caddy/HTTPS). Para smoke del QA completo
    # con Caddy correr manualmente: docker compose -f docker/qa/docker-compose.qa.yml up
    $devCompose = Join-Path $repoRoot "docker\docker-compose.yml"
    if (-not (Test-Path $devCompose)) { Fail-Stage 4 "no existe $devCompose" }

    Write-Host "  → docker compose up -d --build sqlserver backend (puede tardar)..." -ForegroundColor DarkGray
    docker compose -f $devCompose up -d --build sqlserver backend 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail-Stage 4 "docker compose up falló" }

    Write-Host "  → esperando /health/live (90s timeout)..." -ForegroundColor DarkGray
    $deadline = (Get-Date).AddSeconds(90)
    $healthyAt = $null
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:5000/health/live" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { $healthyAt = Get-Date; break }
        } catch { Start-Sleep -Seconds 3 }
    }

    Write-Host "  → docker compose down --volumes" -ForegroundColor DarkGray
    docker compose -f $devCompose down --volumes 2>&1 | Out-Null

    if (-not $healthyAt) { Fail-Stage 4 "backend /health/live nunca devolvió 200 en 90s" }
    Pass-Stage 4 "Backend Docker boot + /health/live OK"
}

# ─── STAGE 5: E2E (Playwright) ──────────────────────────────────────────────
if ($SkipE2E) {
    Write-Host ""
    Write-Host "⚠  STAGE 5 SKIPPED por -SkipE2E" -ForegroundColor Yellow
} else {
    Write-Stage 5 "E2E (Playwright)"

    $e2ePath = Join-Path $repoRoot "tests\e2e"
    if (-not (Test-Path $e2ePath)) {
        Write-Host "  → tests/e2e no existe todavía; saltando." -ForegroundColor DarkGray
    } else {
        Push-Location $e2ePath
        try {
            if (-not (Test-Path "node_modules")) { npm ci 2>&1 | Out-Null }
            npx playwright test
            if ($LASTEXITCODE -ne 0) { Fail-Stage 5 "Playwright" }
        } finally { Pop-Location }
        Pass-Stage 5 "E2E verde"
    }
}

# ─── DONE ───────────────────────────────────────────────────────────────────
$elapsed = (Get-Date) - $startTime
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅  PRE-DEPLOY GATE PASSED  (en $($elapsed.ToString('mm\:ss')))" -ForegroundColor Green
Write-Host "  Safe to: merge → tag → docker compose build && deploy QA" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
