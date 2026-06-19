# SmartMenu — E2E smoke tests

Playwright specs que ejercitan los happy paths del stack QA después de cada cambio significativo. Cubren las regresiones P0 que se cazaron manualmente durante la saga.

## Setup

```bash
cd tests/e2e
npm install
npx playwright install --with-deps chromium
```

## Run

Requiere el stack QA corriendo:

```bash
docker compose -f docker/qa/docker-compose.qa.yml up -d --build
```

Después:

```bash
npm test              # headless
npm run test:headed   # con browser visible
npm run test:ui       # Playwright UI (interactivo, mejor para debug)
npm run test:debug    # debug step-by-step
npm run report        # ver reporte HTML del último run
```

## Specs

| Archivo | Cubre |
|---|---|
| `health.spec.ts` | API `/health/ready`, customer endpoints anónimos (P0.1), mutaciones protegidas (Bloque A), security headers (F5) |
| `customer-flow.spec.ts` | Root `/` → `/table` → `/table/<qrCode>` → form nombre → `/menu`. Detecta regresiones tipo blank screen, /login redirect, 401 loops |
| `staff-logins.spec.ts` | Login + dashboard render + JWT en localStorage + role match para los 6 staff apps |

## URLs override

Por default los specs apuntan a `localhost:84XX` del stack QA. Si tu QA está en otra parte:

```bash
E2E_CLIENT_URL=https://qa.smartmenu.local:8443 \
E2E_ADMIN_URL=https://admin.qa.smartmenu.local:8443 \
... \
npm test
```

## CI integration

Para activar en GitHub Actions, descomentar el job `e2e` en `.github/workflows/ci.yml` después que el stack QA pueda levantarse desde un runner ubuntu-latest.
