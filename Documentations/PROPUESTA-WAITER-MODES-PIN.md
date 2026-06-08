# Propuesta: Host name en modal + Modos PUBLIC/PRIVATE para Waiter

## 1. Resumen Ejecutivo

- **Parte A (Host en modal)**: el dato existe en BD (`TableReservation.CreatedByHostId` + nav property `CreatedByHost`). El endpoint `GET /api/tablereservation` (controller líneas 30-89) **NO lo devuelve** — bug pre-existente, fix de ~3 líneas backend + ~5 líneas frontend.
- **Parte B (PIN vs Login)**: hoy el waiter-app usa solo **login JWT por device** (email+password, BCrypt, refresh token rotation, lockout 5 fails/15 min, JWT 60min). No existe campo `Pin` en `User`.
- **Recomendación**: implementar **modelo híbrido** — login JWT del *device* (turno) + PIN corto para *acciones sensibles* en device compartido. NO eliminar el login actual.
- **Roadmap**: primero Parte A (1h), después PIN como capa opcional sobre el auth existente (~2-3 días).

---

## 2. Parte A — Host name en modal "Mesa Reservada"

### Diagnóstico

**Entidad** (`src/backend/SmartMenu.Domain/Entities/TableReservation.cs:40-45`):
```csharp
public int? CreatedByHostId { get; set; }
public User? CreatedByHost { get; set; }  // nav property ya existe
```

**Endpoint** (`src/backend/SmartMenu.API/Controllers/TableReservationController.cs:30-89`): el `.Select()` que arma el JSON **no incluye** `.Include(r => r.CreatedByHost)` ni proyecta `createdByHostName`. **Es un bug pre-existente** — el modelo lo soporta, el controller no lo expone.

**Modal** (`src/frontend/waiter-app/app/page.tsx`):
- Interface `ReservedTableInfo` (línea **176-189**) no tiene campo de host.
- Modal JSX (línea **3629-3749**): muestra customerName, phone, comensales, email, hora reservada, special requests, pre-order. **No hay slot para host.**
- Carga de datos (línea **732-755**): consume `/api/tablereservation`, filtra cliente-side por tableId.

### Cambios mínimos

**Backend** (`TableReservationController.cs`, método `GetReservations`):
1. Antes del `.Select()` (línea 45): agregar `.Include(r => r.CreatedByHost)`
2. Dentro del `.Select(r => new { ... })`: agregar
```csharp
createdByHostName = r.CreatedByHost != null
    ? r.CreatedByHost.FirstName + " " + r.CreatedByHost.LastName
    : null,
```
3. No existe endpoint `GET /api/tablereservation/{id}`; el frontend reusa el listado — un solo fix cubre todo.

**Frontend** (`waiter-app/app/page.tsx`):
1. Línea 188: agregar `createdByHostName?: string | null;` al interface `ReservedTableInfo`
2. Modal (entre líneas 3717 y 3718, después del bloque "Hora reservada"): nuevo bloque visual con icono `Users` o `UserCheck` mostrando el nombre del host.

### Mockup ASCII del modal

```
+----------------------------------------+
| (X)         Mesa #5                    |
|        Terraza · Reservada             |
+----------------------------------------+
| CLIENTE                                |
| Juan Pérez                             |
|                                        |
| +-------------+  +-------------------+ |
| | Teléfono    |  | Comensales        | |
| | 809-555-... |  | (i) 4 personas    | |
| +-------------+  +-------------------+ |
|                                        |
| +------------------------------------+ |
| | HORA RESERVADA                     | |
| | Sab 12 abr · 19:30                 | |
| | Mesa bloqueada hasta 23:30         | |
| +------------------------------------+ |
|                                        |
| +------------------------------------+ |
| | RECIBIDA POR  <-- NUEVO            | |
| | (icon) María González (Host)       | |
| +------------------------------------+ |
|                                        |
| (special requests, preorder...)        |
+----------------------------------------+
|                          [ Cerrar ]    |
+----------------------------------------+
```

Endpoint adicional recomendado: **NO**. Reutilizar `GET /api/tablereservation`.

---

## 3. Parte B — Auth actual del waiter (code path)

```
LoginScreen (waiter-app/app/login/page.tsx)
   |
   | POST /api/auth/login { email, password }
   v
AuthController.Login  ->  AuthService.LoginAsync (Infrastructure/Services/AuthService.cs:90)
   |  - LoginAttempts table (S4.3 lockout: 5 fails / 15 min)
   |  - BCrypt.Verify
   |  - GenerateAccessToken (JWT 60min, claims: sub, email, role, jti)
   |  - IssueRefreshTokenAsync (random 64B, SHA256-hashed, 14 days, rotation)
   v
LocalStorage: waiter_token, waiter_refresh, waiter_user
   |
   v
api.ts (axios) -> interceptor agrega Authorization: Bearer
                -> on 401: refresh transparente (auth-client.ts:73-94)
                -> SignalR conecta con ?access_token= en query
```

**Modelo actual** (`User.cs`): `Email, PasswordHash, FirstName, LastName, Phone, Role, IsActive, RestaurantId, AssignedZoneId`. **No hay campo Pin.** Password policy estricta (12+ chars, mayúscula/minúscula/dígito/especial, `AuthService.cs:35-48`) — incompatible con flujo rápido de salón.

**Asociación waiter → mesa/orden**:
- `Order.AssignedWaiterId` (`Order.cs:17`). Lo setea `POST /api/order` y se reclama vía `TableClaimController` (mesero pide → admin aprueba → asigna `TableSession.AssignedWaiterId` + `Order.AssignedWaiterId`).
- `WaiterShift` + `WaiterShiftController.GetShiftOwnerId` extrae waiterId del claim `sub` del JWT — **HOY el shift está atado al usuario del JWT del device.** Esto rompe en device compartido.

---

## 4. Parte C — Diseño del modo PÚBLICO (PIN)

### Schema propuesto (agregar a `User`)

```csharp
public string? PinHash { get; set; }       // BCrypt hash (NO plaintext)
public DateTime? PinSetAt { get; set; }    // forzar renovación cada N días
public int PinFailedAttempts { get; set; } // lockout corto
public DateTime? PinLockedUntil { get; set; }
```

**Longitud**: **6 dígitos** (4 = 10K combinaciones es débil; 6 = 1M, alineado con Toast/Square). PIN convive con `PasswordHash`; no lo reemplaza.

### Flow modo PÚBLICO

```
Device compartido (tablet salón) - sesión "shift JWT" genérica:
   POST /api/auth/shift-login  -> JWT role "WaiterDevice"
       (cuenta de servicio "salon-tablet-1@restaurant", NO un humano)
   Token de larga duración (8h = turno completo).

Waiter llega:
   1. Pulsa "Tomar Mesa 5"
   2. Modal: "Ingresa tu PIN" (numpad onscreen, dígitos enmascarados *)
   3. POST /api/auth/pin-verify { pin: "123456" }
      -> Backend resuelve qué User tiene ese PinHash (filtrado por RestaurantId)
      -> Devuelve action token JWT corto (5 min, claim waiterId)
   4. La acción (claim mesa, crear orden, cerrar cuenta) se envía con
      header X-Waiter-Action-Token además del device JWT.
   5. Sin actividad 60-120s o "Salir" -> action token muere.
```

### Respuestas a las preguntas

| Pregunta | Recomendación |
|---|---|
| Largo del PIN | **6 dígitos** (4 muy débil, 8 muy molesto) |
| PIN reemplaza password? | **No, coexiste.** Password = login fuerte (admin/desktop). PIN = acción rápida en device compartido |
| Cuándo validar? | **Por acción sensible** (claim mesa, cerrar cuenta, descuentos) + auto-logout 60-120s sin actividad. NO por cada lectura |
| Cómo desactivar al waiter actual | Botón "Salir" en header + auto-timeout. Action token en `sessionStorage` (no localStorage; se borra al cerrar tab) |
| SignalR? | Device JWT mantiene el hub abierto. Notificaciones del grupo `waiter_{id}` solo dentro del ventana del action token; o hub con device-id + filtrado frontend |
| Riesgo shoulder-surfing | Real. Mitigaciones: **numpad con orden aleatorio** (Square lo hace), enmascarar inmediato, lockout 3 fallos/5min |

---

## 5. Parte D — Comparación PIN vs Login

| Criterio | Login JWT (actual) | PIN (público) |
|---|---|---|
| Velocidad cambio de waiter | Lento (logout+login ~20s) | Rápido (~3s) |
| Seguridad | Alta (password fuerte + refresh rotation) | Media (6 dígitos + shoulder-surfing) |
| Auditabilidad | Excelente (jti único, IP logged) | Buena si cada acción registra waiterId del action token |
| Requiere device personal | Sí | No (1 tablet sirve a todo el equipo) |
| Costo hardware | Alto ($300+ × N waiters) | Bajo (1-2 tablets por salón) |
| Funciona con SignalR | Nativo | Requiere device JWT base + filtrado |
| Si se pierde device | Token revocable, refresh en BD | PIN vive en la cabeza del waiter, device "vacío" |
| UX al inicio del turno | Login una vez | Device login + clock-in con PIN |

---

## 6. Parte E — Recomendación

**Veredicto: implementar AMBOS modos, configurable a nivel `Restaurant`.**

### Por tipo de restaurante

**1. Pequeño (3-5 waiters, baja rotación)** → **Modo PRIVADO/login** es suficiente. Cada waiter usa su phone personal o tablet asignada. Inversión hardware mínima. PIN agrega complejidad sin valor. Costo de logout/login ocurre 1-2× por día — irrelevante.

**2. Grande / cadena (15+ waiters, alta rotación, turnos solapados)** → **Modo PÚBLICO/PIN claramente superior.** Múltiples waiters por turno + handoffs frecuentes (waiter va al baño y otro debe tomar la mesa) = login/logout es fricción crítica. Casos:
   - Express counter: 1 tablet, 3 waiters rotando → PIN obligatorio
   - Salón con 8 estaciones fijas (1 device por zona) → PIN
   - Bar con varios waiters al mismo POS → PIN

**3. Devices compartidos vs personales** → **El factor decisivo NO es el tamaño, es el modelo de devices.** Si la cadena pagó tablets personales: login + biometría (futura). Si comparte devices por zona/estación: PIN siempre.

### Sistemas POS comerciales (de memoria)

- **Toast**: PIN 4-6 dígitos por defecto, login email para gerencia. Modelo idéntico al propuesto aquí.
- **Square for Restaurants**: PIN obligatorio en device compartido. Manager passcode para overrides.
- **Lightspeed Restaurant (K Series)**: PIN-first; email login solo para admin/dueño.
- **Aloha (NCR)**: cardswipe + PIN históricamente; hoy PIN onscreen.
- **Patrón industria**: **PIN gana para waiters, login fuerte solo para gerencia.** El usuario está alineado con la práctica estándar.

### "¿Es necesario el modo público?"

Sí, **para cualquier restaurante con más de 8 waiters por turno O con devices compartidos**. Para family-owned pequeños con phones personales, opcional pero no urgente.

---

## 7. Parte F — Roadmap

### Sprint 1 (1-2h) — quick win Parte A
- Fix backend: agregar `.Include(r => r.CreatedByHost)` + `createdByHostName` al `.Select()` de `GET /api/tablereservation`.
- Fix frontend: agregar campo al interface + bloque visual en modal (ver mockup).
- No requiere migración.

### Sprint 2 (~1 día) — infraestructura PIN
- Migración EF: agregar `PinHash, PinSetAt, PinFailedAttempts, PinLockedUntil` a `Users` (idempotente vía `EnsureUserPinColumnsAsync` siguiendo el patrón de `DbInitializer`).
- Endpoint admin: `PUT /api/user/{id}/pin` (Admin/Manager setea PIN inicial; waiter cambia el suyo con password actual).
- Flag `Restaurant.AuthMode` enum `{PrivateOnly, PublicPin, Hybrid}` en `appsettings.json` o entity.

### Sprint 3 (~1 día) — flow PIN end-to-end
- `POST /api/auth/pin-verify` (rate-limited, lockout 3 fails/5min) → action token JWT corto (5 min).
- Middleware que acepta action token en header `X-Waiter-Action-Token` para endpoints sensibles (`POST /api/order`, `POST /api/tableclaim`, `POST /api/payment`, `WaiterShiftController.*`).
- UI waiter-app: shared device mode — splash "Ingresa PIN" + numpad onscreen (orden randomizado).

### Sprint 4 (~0.5 día) — pulir
- Auto-logout 90s sin actividad.
- Activity log: cada acción con action token registra `userId, action, timestamp` (auditoría DGII-friendly).
- Tests: colisión de PIN entre waiters del mismo restaurante (BCrypt-hash no permite `UNIQUE INDEX` directo — validar iterando users del restaurante en `pin-verify`).

**Decisiones que dependen del usuario**:
1. PIN único por restaurante (mejor UX) o globalmente único?
2. Forzar cambio de PIN cada 90 días?
3. Permitir que el mismo waiter use PIN en device compartido Y login en su phone personal simultáneamente?

---

## Bugs notados, NO arreglados (para decisión del usuario)

1. **`GET /api/tablereservation` no incluye `createdByHostName`** aunque el dato existe en BD. (Parte A — fix trivial.)
2. **`WaiterShiftController.StartShift` extrae waiterId del JWT** (`GetShiftOwnerId`, líneas 26-34) — en modo PIN compartido requeriría aceptar el action token o un `WaiterId` explícito; hoy todos los shifts del turno se atribuirían al usuario del device JWT.

---

## Archivos relevantes (rutas absolutas)

- `src/backend/SmartMenu.Domain/Entities/TableReservation.cs`
- `src/backend/SmartMenu.Domain/Entities/User.cs`
- `src/backend/SmartMenu.Domain/Entities/Order.cs`
- `src/backend/SmartMenu.Domain/Entities/WaiterShift.cs`
- `src/backend/SmartMenu.API/Controllers/TableReservationController.cs`
- `src/backend/SmartMenu.API/Controllers/AuthController.cs`
- `src/backend/SmartMenu.API/Controllers/WaiterShiftController.cs`
- `src/backend/SmartMenu.API/Controllers/TableClaimController.cs`
- `src/backend/SmartMenu.Infrastructure/Services/AuthService.cs`
- `src/frontend/waiter-app/app/page.tsx`
- `src/frontend/waiter-app/app/login/page.tsx`
- `src/frontend/waiter-app/lib/auth-client.ts`
