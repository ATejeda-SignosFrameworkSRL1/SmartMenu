#!/usr/bin/env bash
# S1.D4 — Pre-deploy gate OBLIGATORIO (bash, para CI Linux + macOS dev).
# Equivalente a scripts/pre-deploy.ps1. Mismas 5 etapas, fail-fast.
#
# Uso:
#   ./scripts/pre-deploy.sh                           # corre todo
#   SKIP_E2E=1 ./scripts/pre-deploy.sh                # omite E2E
#   SKIP_CONTAINER_SMOKE=1 ./scripts/pre-deploy.sh    # omite docker compose
#   COVERAGE_THRESHOLD=50 ./scripts/pre-deploy.sh     # ratchet manual
#
# Regla #1 del contrato: NADA va a QA si esto no termina verde.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

COVERAGE_THRESHOLD="${COVERAGE_THRESHOLD:-30}"
SKIP_E2E="${SKIP_E2E:-0}"
SKIP_CONTAINER_SMOKE="${SKIP_CONTAINER_SMOKE:-0}"

start_time=$(date +%s)

stage() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  STAGE $1 — $2"
  echo "═══════════════════════════════════════════════════════════════════"
}

fail() {
  echo ""
  echo "❌  STAGE $1 FAILED: $2"
  echo "Pipeline detenido. NO se debe deployar."
  exit 1
}

pass() {
  echo ""
  echo "✅  STAGE $1 PASSED: $2"
}

# ─── STAGE 1: Lint + Build ──────────────────────────────────────────────────
stage 1 "Lint + Build (frontends + backend)"

FRONTENDS=(client-app admin-panel kds-app waiter-app host-app cashier-app reservation-app)
for app in "${FRONTENDS[@]}"; do
  echo "  → $app  (lint + type-check + test --if-present)..."
  (cd "$REPO_ROOT/src/frontend/$app" \
    && npm run lint > /dev/null 2>&1 || fail 1 "$app lint") || exit 1
  (cd "$REPO_ROOT/src/frontend/$app" \
    && npm run type-check > /dev/null 2>&1 || fail 1 "$app type-check") || exit 1
  # S1.D5: vitest si la app tiene script `test`.
  (cd "$REPO_ROOT/src/frontend/$app" \
    && npm test --if-present > /dev/null 2>&1 || fail 1 "$app test") || exit 1
done

echo "  → backend  dotnet build Release..."
(cd "$REPO_ROOT/src/backend" \
  && dotnet build SmartMenu.sln --configuration Release --nologo /p:TreatWarningsAsErrors=false > /dev/null \
  || fail 1 "backend dotnet build") || exit 1
pass 1 "Lint + Build"

# ─── STAGE 2: Unit tests + coverage gate ────────────────────────────────────
stage 2 "Unit tests + coverage gate ${COVERAGE_THRESHOLD}%"

# ThresholdStat=average → floor del promedio per-módulo (ratchet 30→50→70 %).
# Exclude SmartMenu.API porque controllers se cubren con integration tests, no unit.
(cd "$REPO_ROOT" && dotnet test tests/SmartMenu.UnitTests/SmartMenu.UnitTests.csproj \
    --configuration Release --nologo \
    /p:CollectCoverage=true \
    /p:CoverletOutputFormat=cobertura \
    /p:CoverletOutput="$REPO_ROOT/coverage/unit/" \
    /p:Exclude='[SmartMenu.API]*' \
    /p:Threshold="$COVERAGE_THRESHOLD" \
    /p:ThresholdType=line \
    /p:ThresholdStat=average \
  || fail 2 "unit tests / coverage threshold")
pass 2 "Unit tests verdes + coverage ≥ ${COVERAGE_THRESHOLD}%"

# ─── STAGE 3: Integration tests con Testcontainers ──────────────────────────
stage 3 "Integration tests (Testcontainers SQL Server)"

docker info > /dev/null 2>&1 || fail 3 "Docker daemon inaccesible — Testcontainers lo necesita"

(cd "$REPO_ROOT" && dotnet test tests/SmartMenu.IntegrationTests/SmartMenu.IntegrationTests.csproj \
    --configuration Release --nologo \
  || fail 3 "integration tests")
pass 3 "Integration tests verdes contra SQL Server real"

# ─── STAGE 4: Container smoke ───────────────────────────────────────────────
if [[ "$SKIP_CONTAINER_SMOKE" == "1" ]]; then
  echo ""
  echo "⚠  STAGE 4 SKIPPED por SKIP_CONTAINER_SMOKE=1"
else
  stage 4 "Container smoke (docker compose QA stack)"

  # Compose dev (más rápido). QA completo (Caddy/HTTPS) se valida manualmente.
  dev_compose="$REPO_ROOT/docker/docker-compose.yml"
  [[ -f "$dev_compose" ]] || fail 4 "no existe $dev_compose"

  echo "  → docker compose up -d --build sqlserver backend..."
  docker compose -f "$dev_compose" up -d --build sqlserver backend > /dev/null 2>&1 || fail 4 "compose up"

  echo "  → esperando /health/live (90s timeout)..."
  healthy=0
  for _ in $(seq 1 30); do
    if curl -sf -m 5 http://localhost:5000/health/live > /dev/null 2>&1; then
      healthy=1; break
    fi
    sleep 3
  done

  echo "  → docker compose down --volumes"
  docker compose -f "$dev_compose" down --volumes > /dev/null 2>&1 || true

  [[ "$healthy" == "1" ]] || fail 4 "backend /health/live nunca devolvió 200 en 90s"
  pass 4 "Backend Docker boot + /health/live OK"
fi

# ─── STAGE 5: E2E ───────────────────────────────────────────────────────────
if [[ "$SKIP_E2E" == "1" ]]; then
  echo ""
  echo "⚠  STAGE 5 SKIPPED por SKIP_E2E=1"
else
  stage 5 "E2E (Playwright)"

  if [[ ! -d "$REPO_ROOT/tests/e2e" ]]; then
    echo "  → tests/e2e no existe; saltando."
  else
    (cd "$REPO_ROOT/tests/e2e" \
      && [[ -d node_modules ]] || npm ci > /dev/null 2>&1 \
      && npx playwright test || fail 5 "Playwright")
    pass 5 "E2E verde"
  fi
fi

# ─── DONE ───────────────────────────────────────────────────────────────────
elapsed=$(( $(date +%s) - start_time ))
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅  PRE-DEPLOY GATE PASSED  (en ${elapsed}s)"
echo "  Safe to: merge → tag → docker compose build && deploy QA"
echo "═══════════════════════════════════════════════════════════════════"
