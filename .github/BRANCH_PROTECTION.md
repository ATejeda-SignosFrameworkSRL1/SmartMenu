# Branch Protection Rules (S1.D4)

Estas reglas implementan la **Regla #1** del contrato de testing: ningún cambio
llega a `main` sin pasar el pre-deploy gate completo.

> No hay forma de aplicarlas vía PR — sólo el owner del repo puede activarlas en
> Settings → Branches → Branch protection rules. Este archivo documenta qué
> activar y por qué.

## Reglas para `main`

Activar en https://github.com/<owner>/SmartMenu/settings/branches:

### Rule: `main`

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (cuando exista CODEOWNERS)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Status checks required (definidos por `.github/workflows/ci.yml`):
    - `Backend — build + unit + coverage ≥ 30%`
    - `Backend — integration (Testcontainers SQL)`
    - `Frontend — client-app`
    - `Frontend — admin-panel`
    - `Frontend — kds-app`
    - `Frontend — waiter-app`
    - `Frontend — host-app`
    - `Frontend — cashier-app`
    - `Frontend — reservation-app`
    - `Container smoke (docker compose QA)`
    - `✅ Pre-deploy gate (regla #1)`

- [x] **Require conversation resolution before merging**

- [x] **Require signed commits** (opcional pero recomendado)

- [x] **Require linear history** (no merge commits — sólo squash o rebase)

- [x] **Do not allow bypassing the above settings**
  - [x] Include administrators (importante: admin no se salta el gate)

- [x] **Restrict who can push to matching branches** → vacío (todo PR)

- [x] **Allow force pushes** → **OFF**

- [x] **Allow deletions** → **OFF**

## Reglas para `Developer` (rama de desarrollo continuo)

Misma config que `main` excepto:
- Approvals: 1 (igual)
- Linear history: opcional (puede ser merge para preservar contexto)
- Include administrators: opcional

## Verificación manual

Una vez activadas, abrir un PR de prueba que:
1. Modifica un test para que falle.
2. Push al PR.

El PR debe quedar bloqueado con:
> Required check `Backend — build + unit + coverage ≥ 30%` is failing.

Si el merge button NO está deshabilitado, las reglas no están activas.

## CLI (alternativa, requiere `gh` con permisos de admin)

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f required_status_checks.strict=true \
  -F required_status_checks.contexts[]="Backend — build + unit + coverage ≥ 30%" \
  -F required_status_checks.contexts[]="Backend — integration (Testcontainers SQL)" \
  -F required_status_checks.contexts[]="Container smoke (docker compose QA)" \
  -F required_status_checks.contexts[]="✅ Pre-deploy gate (regla #1)" \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -f restrictions=null \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

## Coverage ratchet (sólo sube)

Actualizar `env.COVERAGE_THRESHOLD` en `ci.yml`:

| Sprint | Threshold | Cuándo subirla |
|--------|-----------|----------------|
| S1     | 30 %      | hoy (already) |
| S2     | 50 %      | cuando D2 services + más Infrastructure suban |
| S3     | 70 %      | cuando integration + E2E cubran más rutas |

Regla: nunca bajarla. Si una refactorización reduce coverage, agregar tests antes
de mergear.
