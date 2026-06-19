# Contributing to SmartMenu

Bienvenido. SmartMenu es un sistema de menú digital con compliance fiscal RD
(ITBIS 18 %, Propina Ley 13-07, e-CF DGII). El estándar es alto y la rama
`main` está protegida. Lee este documento antes de tu primer PR.

---

## 🚨 Las 4 reglas no-negociables (Sprint 1, sellado en CI)

### Regla 1 — Pre-deploy gate OBLIGATORIO

> **Ningún `docker compose build && up` a QA sin que la suite completa pase.**
> Stage rojo → STOP.

El pipeline (5 etapas, fail-fast) se ejecuta automáticamente en CI para todo PR
contra `main` o `Developer`, y también puede correrse local:

```powershell
# Windows (PowerShell)
.\scripts\pre-deploy.ps1
.\scripts\pre-deploy.ps1 -SkipE2E -SkipContainerSmoke   # loop dev rápido
```

```bash
# Linux / macOS / WSL
./scripts/pre-deploy.sh
SKIP_E2E=1 SKIP_CONTAINER_SMOKE=1 ./scripts/pre-deploy.sh
```

| Stage | Qué corre | SLA | Falla si... |
|------:|-----------|----:|-------------|
| 1 | Lint + type-check + `npm test --if-present` (7 frontends) + `dotnet build` Release | <2 min | algún lint/type/test/build rompe |
| 2 | Unit tests backend + coverage ≥ **30 %** average (line) | <5 min | tests rojos o coverage cae |
| 3 | Integration tests con SQL Server 2022 vía Testcontainers | ~10 min | el WebApplicationFactory + DB real no pasa los 5 happy paths |
| 4 | Container smoke: `docker compose up sqlserver backend` + curl `/health/live` | ~10 min | el backend dockerizado no bootea sano |
| 5 | E2E Playwright (customer flow + 6 staff logins) | ~15 min | Chromium no completa el happy path |

### Regla 2 — Toda código cambio viaja CON su test, en el mismo commit

| Tipo de cambio | Test exigido |
|----------------|--------------|
| Feature nueva | smoke test que ejercita la feature |
| Bug fix | regression test (1 `describe` por bug, link al issue en el comentario) |
| Modificación de feature existente | actualizar test correspondiente |
| Refactor sin cambio de comportamiento | tests deben pasar SIN modificación |
| Cambio de schema / config | test de migration + test que ejercita el config |
| Nueva dependencia | test que use la dep (justifica su inclusión) |

Reviewers van a rechazar PRs que rompen este pacto. Si genuinamente no se puede
testear (ej. cambio en `tailwind.config.js`), documentar por qué en el PR.

### Regla 3 — El conteo total de tests sólo CRECE entre releases

```
v1.0.0:  215 tests
v1.0.1:  226 tests   ✅
v1.0.2:  240 tests   ✅
v1.1.0:  238 tests   ❌  PR debe explicar por qué bajaron 2 tests
```

Excepción legítima: feature explícitamente removida (con commit
`feat!: remove X`). Tests obsoletos se borran en el MISMO commit que borra
la feature.

### Regla 4 — Todo ítem nuevo del proyecto se refleja en la suite

Nuevo controller → integration test
Nueva entity → unit test del default state
Nueva migration → test de aplicación idempotente
Nueva ruta frontend → al menos un Playwright spec que la navegue
Nueva variable env → smoke test que la lea

---

## 📐 Pipeline detallado (qué corre, dónde)

### Stage 2 (Unit backend) — `tests/SmartMenu.UnitTests/`

- xUnit + FluentAssertions + Moq
- EF Core InMemory para tests que tocan DbContext
- Cobertura actual: **186 tests verdes en ~7 s**
- Areas cubiertas: Domain (25/25 entities), AuthService (S4.2 password + S4.3
  lockout + refresh rotation/replay), OrderService (state machine + P0.2 fiscal
  guard + server-side pricing), ExceptionHandlingMiddleware (11 branches),
  IdempotencyMiddleware (cache replay)

### Stage 3 (Integration) — `tests/SmartMenu.IntegrationTests/`

- xUnit + Testcontainers (SQL Server 2022 real, mismo motor que prod)
- WebApplicationFactory<Program> con override de ConnectionString
- Una sola instancia de SQL Server compartida por collection (rápido)
- Cobertura actual: **11 tests verdes en ~14 s**
- Areas: health endpoints, P0.1 anonymous customer endpoints, full auth flow
  (register → login → /me), migration idempotence, 14 DbContext tables existence

### Stage 5 (E2E) — `tests/e2e/`

- Playwright contra QA stack (Caddy HTTPS + 7 frontends + backend Docker)
- Customer flow: QR scan → name → menu → cart
- 6 staff logins via quick-login buttons
- Asume `docker compose -f docker/qa/docker-compose.qa.yml up` corriendo

### Frontend tests — Vitest (reference: `src/frontend/admin-panel/`)

- vitest + @testing-library/react + jsdom
- Cubre: `lib/auth-client.ts` (DRY auth factory, F3)
- 14 tests verdes en ~2.4 s
- Roadmap: replicar setup a las otras 6 apps en S2

---

## 📈 Coverage ratchet — sólo sube

Configurado en `.github/workflows/ci.yml` env `COVERAGE_THRESHOLD`:

| Sprint | Threshold | Estado |
|-------:|----------:|--------|
| 1      | **30 %**  | Actual: Avg 44 %, Domain 67 %, Application 61 % |
| 2      | 50 %      | Cuando Infrastructure suba cobertura |
| 3      | 70 %      | Cuando integration + E2E cubran más rutas |

Métrica: `ThresholdType=line ThresholdStat=average` (per-módulo average), con
`Exclude='[SmartMenu.API]*'` (controllers se cubren con integration tests, no
unit).

**Nunca bajarla.** Si una refactorización reduce coverage, agregar tests antes
de mergear.

---

## 🛡️ Branch protection

Detalles operativos en [`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md).
Resumen:

- `main` requiere PR + 1 approval + status checks verdes + linear history.
- Force push deshabilitado.
- Administrators NO se saltan el gate.
- Status checks requeridos: backend-unit, backend-integration, 7× frontend,
  container-smoke, pre-deploy-gate.

---

## 🧑‍💻 Workflow del PR

1. **Branch from `Developer`**: `feature/<topic>` o `fix/<topic>`.
2. **Hacer el cambio + el test en el mismo commit** (Regla 2).
3. **Correr local**: `./scripts/pre-deploy.sh` (puedes saltar E2E/container con env vars).
4. **Push + PR a `Developer`** (no a `main` directo).
5. **CI debe quedar verde**. Status checks bloquean merge si fallan.
6. **1 reviewer aprueba** → squash & merge.
7. **Para liberar a `main`**: PR `Developer → main`, mismo gate.

---

## 🐛 Cómo escribir un test de regresión

Cuando arreglas un bug, agregas un test que FALLE sin el fix y PASE con él:

```csharp
// tests/SmartMenu.UnitTests/Domain/OrderTests.cs
[Fact]
public void Bug_42_completing_order_without_payment_no_longer_allowed()
{
    // Regression: https://github.com/<owner>/SmartMenu/issues/42
    // Antes del fix, UpdateOrderStatus("Completed") aceptaba sin Payment row,
    // dejando órdenes "Completed" sin cobro registrado.
    var (svc, _, db) = Build();
    await SeedOrder(db, OrderStatus.Served, total: 1500m);
    // No hay pagos → debe rechazar
    var act = () => svc.UpdateOrderStatusAsync(1, "Completed");
    await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*sin cobro*");
}
```

Format del nombre del test: `Bug_<issue>_<short_description>`. Eso indexa los
tests por el bug que los originó.

---

## ❓ Preguntas frecuentes

**P: El pre-deploy local tarda mucho. ¿Cómo itero?**
R: `./scripts/pre-deploy.sh` con `SKIP_E2E=1 SKIP_CONTAINER_SMOKE=1` corre sólo
Stages 1-3 en <8 min. CI siempre corre todo.

**P: Mi feature no se puede testear unitariamente.**
R: Considera (1) testearla integration-style, (2) testear sus partes puras,
(3) escribirla más testeable. Si genuinamente no, documentar en el PR.

**P: El coverage cae después de mi refactor.**
R: Stage 2 lo va a rechazar. Agrega tests antes de mergear. Es por diseño.

**P: ¿Puedo bypasear el gate en emergencias?**
R: No. La rama está protegida con "include administrators". Si hay emergencia
real, el path es un hotfix branch desde `main` con su propio PR y review.

---

## 📚 Referencias

- [CLAUDE.md](./CLAUDE.md) — orientación para asistentes IA sobre la base de código.
- [.github/BRANCH_PROTECTION.md](./.github/BRANCH_PROTECTION.md) — config exacta de branch rules.
- [Documentations/04-Guias-de-Desarrollo/11-Testing.md](./Documentations/04-Guias-de-Desarrollo/11-Testing.md) — guía técnica detallada.

---

Hecho con disciplina por el equipo de SmartMenu.
