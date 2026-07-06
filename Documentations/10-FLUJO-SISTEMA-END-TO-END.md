# 📖 SmartMenu — Flujo End-to-End del Sistema

> **Versión**: revisada al 2026-05-22 contra commit `4af5019` y configuración local (`SmartMenu.API` nativo + frontends Docker + SQL Server Express local `DbNewMenu`).
> **Objetivo**: explicar paso a paso qué ocurre desde que un cliente reserva en el portal hasta que la caja registra el pago final, incluyendo qué entidad cambia, qué endpoint se llama y qué app está involucrada en cada paso.

---

## 🗺️ Mapa visual del flujo

```
┌─────────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐      ┌──────────────┐
│ Reservation │ ───► │   Host     │ ───► │  Client    │ ───► │  Waiter    │ ───► │ KDS Cocina/  │
│  (portal)   │      │   App      │      │  PWA       │      │   App      │      │   Bar        │
└─────────────┘      └────────────┘      └────────────┘      └────────────┘      └──────────────┘
      │                    │                    │                    │                    │
      │                    │                    │                    │                    ▼
      │                    │                    │                    │            ┌──────────────┐
      │                    │                    │                    │            │ Waiter sirve │
      │                    │                    │                    │            └──────┬───────┘
      │                    │                    │                    │                   │
      │                    │                    │                    ▼                   │
      │                    │                    │            ┌───────────────┐           │
      │                    │                    │            │ Cashier App   │ ◄─────────┘
      │                    │                    │            │ (e-CF DGII)   │
      │                    │                    │            └───────┬───────┘
      │                    │                    │                    │
      │                    │                    │                    ▼
      │                    │                    │            ┌───────────────┐
      └────────────────────┴────────────────────┴──────────► │  Admin Panel  │
                                                              │   /reports    │
                                                              └───────────────┘
```

---

## 👥 Roles y apps

| Rol | App | Puerto QA | Login (seed) |
|-----|-----|-----------|--------------|
| Cliente público | reservation-app | `8449` | (anónimo) |
| Cliente con mesa | client-app PWA | `8451` | (anónimo) |
| Host / hostess | host-app | `8447` | `host@smartmenu.com / Host123!` |
| Mesero | waiter-app | `8446` | `waiter@smartmenu.com / Waiter123!` |
| Chef | kds-app (vista cocina) | `8445` | `chef@smartmenu.com / Chef123!` |
| Bartender | kds-app (vista bar) | `8445` | `bartender@smartmenu.com / Bar123!` |
| Cajero | cashier-app | `8448` | `cashier@smartmenu.com / Cash123!` |
| Admin | admin-panel | `8444` | `admin@smartmenu.com / Admin123!` |

---

## 🔑 Estados clave

### `TableReservation`
- `IsConfirmed` = `false` (Portal) ó `true` (creada por host) → `true` al aceptar
- `IsCancelled` = `false` → `true` al rechazar
- `ReservedUntil` = `ReservationDateTime + 4h` (DRY, calculado al crear)
- `AdvanceBlockMinutes` = `60` (cuánto antes bloquear la mesa)
- `Source` = `"Portal"` ó `"Internal"`

### `Table.Status` (enum `TableStatus`)
| Valor | Cuándo |
|-------|--------|
| `Available` | Libre |
| `Occupied` | Cliente activo con orden |
| `Reserved` | **Computado**: faltan ≤ 60 min para una reserva y `ReservedUntil` aún no pasa |
| `Billing` | Cliente solicitó la cuenta, esperando pago |
| `Cleaning` | Pago cobrado, mesa esperando higiene |
| `Reserved` (manual) | Host bloqueó manualmente |

### `Order.Status` (enum `OrderStatus`)
`Pending` → `Confirmed` → `Preparing` → `Ready` → `Served` → `Completed`
(o `Cancelled` en cualquier punto antes de `Completed`)

### `Payment.Status` (enum `PaymentStatus`)
`Pending` → `Processing` → `Completed`
(o `Failed` / `Refunded`)

---

## 📡 SignalR hubs (notificaciones en tiempo real)

| Hub | Path | Quién escucha |
|-----|------|---------------|
| `ReservationHub` | `/hubs/reservations` | host, admin, reservation |
| `OrderHub` | `/hubs/orders` | waiter, cashier, admin |
| `KitchenHub` | `/hubs/kitchen` | KDS (chef + bartender), waiter |
| `TableHub` | `/hubs/tables` | host, waiter, admin |

Eventos emitidos en cada cambio: `ReservationConfirmed`, `ReservationCancelled`, `OrderCreated`, `OrderStatusChanged`, `KitchenReady`, `BarReady`, `TableStatusChanged`, `PaymentCompleted`, etc.

---

# 🍽️ Fases del flujo completo

## **FASE 1 — Reserva**

### 1.1 Cliente entra al portal de reservas
- App: **reservation-app** (`https://localhost:8449`)
- Acceso: anónimo (sin login)
- Selecciona: fecha, hora, # comensales, zona preferida
- El portal pide al backend mesas disponibles:
  ```
  GET /api/tablereservation/public/available-tables?dateTime=2026-05-30T20:00&guests=4
  ```
- Backend devuelve mesas cuya capacidad ≥ guests y que no tengan reservas que se solapen en una ventana de ±2h.

### 1.2 Cliente llena el formulario
| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| Nombre | ✅ | `CustomerName` |
| Teléfono | ✅ | `CustomerPhone` (formato libre) |
| Email | ⚠️ Opcional | `CustomerEmail` |
| # comensales | ✅ | `NumberOfGuests` |
| Solicitudes especiales | ❌ | `SpecialRequests` (alergias, cumpleaños, etc.) |
| Pre-orden | ❌ | Selecciona platos del menú (se guarda en `ReservationPreOrder` + `PreOrderItems`) |

### 1.3 POST al backend
```
POST /api/tablereservation/public
```
Backend hace:
1. Crea `TableReservation` con `IsConfirmed = false`, `Source = "Portal"`, `ReservedUntil = ReservationDateTime + 4h`
2. Si hay pre-orden, crea `ReservationPreOrder` + N `PreOrderItem`
3. Broadcast WS al `ReservationHub`: `NewReservation`
4. Devuelve `{ id, message: "Reserva recibida. Pendiente de confirmación." }`

> 📌 La mesa **NO** cambia su `Status` aún — solo cuando faltan 60 min y la reserva está confirmada.

---

## **FASE 2 — Host acepta la reserva**

### 2.1 Notificación al host
- App: **host-app** → tab "Reservas"
- SignalR `/hubs/reservations` recibe `NewReservation`
- Suena audio + badge "Pendientes (N)" parpadea
- Card aparece con borde morado/ámbar pulsante

### 2.2 Host revisa la reserva
La tarjeta muestra:
- Nombre, teléfono, **email** (mailto:), # comensales, mesa, hora
- Solicitudes especiales en bloque ámbar
- Pre-orden expandible (clic en "Pre-orden (N platos)")

### 2.3 Host clic "Aceptar"
```
PUT /api/tablereservation/{id}/confirm
```
Backend hace:
1. `reservation.IsConfirmed = true`
2. `SaveChangesAsync`
3. Broadcast WS `ReservationConfirmed { reservationId, timestamp }`

> ⚠️ **No se manda email/SMS al cliente** automáticamente — esto está pendiente de integración.

### 2.3.bis Host clic "Rechazar" (alternativo)
```
PUT /api/tablereservation/{id}/cancel
```
Backend hace:
1. `reservation.IsCancelled = true`
2. Si no hay otra reserva próxima en ≤ 1 h, libera la mesa: `Status → Available`
3. Broadcast WS `ReservationCancelled`

---

## **FASE 3 — Bloqueo automático de mesa (60 min antes)**

> Este paso no requiere acción humana. Ocurre **dinámicamente al consultar mesas**.

Cada vez que un app pide `GET /api/table`, el backend calcula en tiempo real (no en DB):

```csharp
table.Status =
  if exists Reservation r where
    r.TableId == table.Id
    && r.ReservedUntil > now
    && r.ReservationDateTime <= now + r.AdvanceBlockMinutes
    && !r.IsCancelled
  then "Reserved"
  else table.Status
```

Consecuencias:
- Host-app muestra la mesa amarilla en el grid
- Waiter-app muestra la mesa amarilla
- **Si un cliente intenta escanear el QR** y la mesa está reservada, `TableSessionController` devuelve `BadRequest: "La mesa está reservada hasta HH:mm"`

> 💡 El mesero puede **clic en la mesa amarilla** y abre un popup con datos del cliente reservante (nombre, teléfono, email, # comensales, hora, solicitudes, pre-orden).

---

## **FASE 4 — Cliente llega al restaurante**

### 4.1 Opción A — Host asigna manualmente
- Host-app → tab "Mesas" → click en mesa → modal "Asignar"
- Llena: nombre del cliente, # comensales reales, notas
- `POST /api/tablesession` crea `TableSession` y `Order` esqueleto
- Mesa pasa a `Occupied`

### 4.2 Opción B — Cliente escanea el QR
- Cliente apunta cámara al QR pegado en la mesa
- QR redirige a `https://qa.smartmenu.local:8443/table/<qrCode>`
- client-app:
  1. `GET /api/table/qr/{qrCode}` → identifica la mesa y zona
  2. Muestra landing con nombre de mesa, capacidad, zona
  3. Cliente ingresa su nombre
  4. `POST /api/tablesession` → crea sesión + Order esqueleto
- Mesa `Occupied`, `Order.Status = Pending`

> 🚫 Si la mesa está `Reserved` y la reserva no es del cliente, **el QR se bloquea** con mensaje de mesa ocupada hasta tal hora.

---

## **FASE 5 — Cliente ordena**

### 5.1 Browse menú
- App: **client-app** (`/menu`)
- `GET /api/dish` (con `AsNoTracking`, paginado por categoría)
- Cliente filtra por: categoría, "Vegetariano", "Vegano", "Sin gluten", "Popular", "Picante"
- Click "Agregar" en un plato → modal de personalización:

| Campo | Opciones |
|-------|----------|
| Cantidad | `1`, `2`, `3`... |
| Course timing | `Entrada` / `Plato Fuerte` / `Postre` |
| Guarnición | depende del plato |
| Personalizaciones | texto libre (ej: "sin cebolla") |
| Alergias | texto libre (ej: "alérgico a mariscos") |
| Notas | texto libre |

- Click "Agregar RD$XXX" → item al carrito (zustand local, no toca DB todavía)

### 5.2 Carrito (`/cart`)
- Cliente puede:
  - Cambiar cantidad ±
  - Eliminar items
  - Escribir "Instrucciones especiales" para la orden completa
- Footer: total acumulado

### 5.3 Confirmar orden
- Click "Confirmar Orden"
- `POST /api/order` con payload:
  ```json
  {
    "tableId": 25,
    "customerName": "Cliente ZT E2E",
    "items": [{ "dishId": 1, "quantity": 1, "courseTiming": 0, "notes": "..." }],
    "specialInstructions": null
  }
  ```
- Backend hace:
  1. Crea `Order` con `Status = Pending`
  2. Crea N `OrderItem` (uno por plato)
  3. **Recalcula totales server-side**:
     - `Subtotal = Σ (item.UnitPrice × item.Quantity)`
     - `Tax = Subtotal × 0.18` (ITBIS)
     - `Tip = Subtotal × 0.10` (propina legal)
     - `Total = Subtotal + Tax + Tip`
  4. Bloquea cambios con `RowVersion` (concurrency token)
  5. Broadcast WS `OrderCreated` al `OrderHub` y `KitchenHub`
  6. Devuelve la orden con id + orderNumber generado (`ORD-YYYYMMDDHHmmss-XXXXXX`)
- Cliente redirigido a `/order-status/{id}` que muestra:
  - Stepper: Pendiente → Confirmada → Preparando → Lista → Servida
  - Item list con precios
  - Tiempo estimado

---

## **FASE 6 — Cocina y Bar preparan**

### 6.1 KDS recibe la orden
- App: **kds-app** (`/kitchen` para chef, `/bar` para bartender)
- SignalR `/hubs/kitchen` recibe `OrderCreated`
- La orden aparece como card con borde rojo (sin tocar)
- Items se filtran según rol:
  - **Chef** ve items con categoría "Entradas", "Platos Fuertes", "Pastas", "Postres"
  - **Bartender** ve items con categoría "Bebidas" o nombre que matchea keywords (`cerveza`, `vino`, `mojito`, etc.)

### 6.2 Chef/Bartender clic "Preparar"
```
PUT /api/order/{id}/kitchen-preparing    (chef)
PUT /api/order/{id}/bar-preparing        (bartender)
```
- Backend: `Order.Status = Preparing`, `Order.KitchenPreparing = true`
- WS broadcast `OrderStatusChanged`
- Card se pone amarilla
- Cliente en client-app ve "Preparando" en el stepper

### 6.3 Chef/Bartender clic "Listo"
```
PUT /api/order/{id}/kitchen-ready
PUT /api/order/{id}/bar-ready
```
- Backend: `Order.KitchenReady = true` (o `BarReady`), si ambos listos → `Status = Ready`
- WS broadcast `KitchenReady` / `BarReady`
- **El waiter recibe notificación push + sonido**

---

## **FASE 7 — Mesero sirve la orden**

### 7.1 Notificación al waiter
- App: **waiter-app** → tab "Mis Mesas"
- Card pulsa verde, audio alert: "Pedido listo en Mesa #X"

### 7.2 Waiter asigna la orden a sí mismo (si era anónima)
- Si la orden no tiene `AssignedWaiterId` → aparece en "Mesas General" con badge rojo "Pedido nuevo"
- Click → modal "¿Aceptar este pedido?" → `PUT /api/order/{id}/assign-waiter/{waiterId}`
- Pasa a "Mis Mesas"

### 7.3 Waiter sirve
- Click "Marcar Servido" en la card
```
PUT /api/order/{id}/kitchen-served     (si era de cocina)
PUT /api/order/{id}/bar-served         (si era de bar)
```
- Backend: `Order.ServedAt = now`, si todo servido → `Status = Served`
- Mesa `Occupied` continúa (cliente sigue ahí)

---

## **FASE 8 — Cliente pide la cuenta**

### 8.1 Cliente activa "Solicitar cuenta"
- App: **client-app** → `/order-status/{id}` → botón "Solicitar Cuenta"
- Modal: selecciona método de pago preferido (`Cash`, `Card`, `Transfer`), % de propina, y RNC opcional para e-CF

```
POST /api/payment/request-billing/{orderId}
```
Payload:
```json
{
  "preferredMethod": "Card",
  "tipPercentage": 10,
  "tipAmount": 24.50,
  "requiresFiscalReceipt": false,
  "rnc": null,
  "businessName": null
}
```

Backend hace:
1. `Order.ClientRequestedPaymentMethod = "Card"`, `ClientTipAmount = 24.50`
2. **Mesa.Status → `Billing`**
3. Broadcast WS `OrderBillingRequested` al cashier

### 8.2 Cashier-app recibe
- App: **cashier-app**
- Listado de mesas "Por Cobrar" se actualiza vía SignalR
- Card muestra: # mesa, # orden, total, tip sugerido, método solicitado

---

## **FASE 9 — Caja procesa el pago**

### 9.1 Cajero abre la orden
- Click en la card → vista de cobro
- Pantalla muestra:
  - **Subtotal** (suma de items)
  - **ITBIS 18%** (`Subtotal × 0.18`)
  - **Propina 10% Ley 13-07** (`Subtotal × 0.10`)
  - **Retención ISR 10% sobre propina** (`Tip × 0.10`)
  - **Total a cobrar**
- Cajero puede ajustar la propina si el cliente cambió de opinión

### 9.2 (Opcional) e-CF DGII
- Si el cliente pidió factura fiscal:
  - Cajero ingresa RNC → `GET /api/payment/validate-rnc/{rnc}` (rate limited)
  - Backend valida con padron DGII
  - Si OK, se incluye `RazonSocial`, `NombreComercial` en el ticket
  - Al cobrar, se generará el e-CF (NCF) y se firma con cert `certificates/dgii-cert.pfx`

### 9.3 Confirmar cobro
```
POST /api/payment/collect
```
Payload:
```json
{
  "orderId": 6,
  "method": "Card",
  "amount": 313.60,
  "tipAmount": 24.50,
  "rnc": null,
  "splitType": "None"
}
```

Backend hace (transaccional):
1. Crea `Payment` con `Status = Completed`, `CompletedAt = UtcNow`, `ProcessedByWaiterId`
2. **P0.2 fiscal guard**: si Order.Total ≠ Payment.Amount + (todos los Payments ya cobrados), rechaza
3. `Order.Status = Completed`
4. `Mesa.Status = Cleaning`
5. Si e-CF: llama DGII API, guarda `FiscalNCF`, `FiscalSignature` en el Payment
6. Broadcast WS `PaymentCompleted` a `OrderHub` y `TableHub`

### 9.4 Tickets
- Físico: impresora térmica recibe el formato (vía `GET /api/payment/by-order/{orderId}/receipt`)
- Digital: si `customerEmail` existe, se envía PDF (opcional)

---

## **FASE 10 — Higiene y cierre**

### 10.1 Mesa en `Cleaning`
- Personal de servicio limpia
- Manual: cualquier app con permisos hace `PUT /api/table/{id}/status` con `newStatus = "Available"`
- Mesa vuelve a Available, lista para próxima reserva o walk-in

### 10.2 Métricas en tiempo real (admin)
- App: **admin-panel** → `/` (Dashboard)
- Widgets actualizados con cada `PaymentCompleted`:
  - `GET /api/reports/sales-today` → `TotalSales`, `TipsTotal`, `TransactionCount`, `AverageTicket`
  - `GET /api/reports/waiters?from=...&to=...` → por mesero
  - `GET /api/reports/dish-avg-time?from=...&to=...` → tiempo promedio de prep por plato

### 10.3 Cierre de turno del waiter
- App: waiter-app → botón "Cerrar Turno"
- `PUT /api/waitershift/{id}/close`
- Backend: calcula propinas pendientes, genera summary, archiva el shift

---

# 📊 Resumen — Tabla de transiciones

| Paso | Quién | Acción | Order Status | Mesa Status | Payment Status |
|------|-------|--------|--------------|-------------|----------------|
| 1 | Cliente | Reserva portal | — | Available | — |
| 2 | Host | Acepta | — | Available | — |
| 3 | (auto) | 60min antes | — | **Reserved** | — |
| 4 | Cliente | Escanea QR | — | **Occupied** | — |
| 5 | Cliente | Confirma orden | **Pending** | Occupied | — |
| 6a | Chef/Bar | Preparar | **Preparing** | Occupied | — |
| 6b | Chef/Bar | Listo | **Ready** | Occupied | — |
| 7 | Mesero | Sirve | **Served** | Occupied | — |
| 8 | Cliente | Pide cuenta | Served | **Billing** | — |
| 9 | Cajero | Cobra | **Completed** | **Cleaning** | **Completed** |
| 10 | Personal | Limpia | Completed | Available | Completed |

---

# 🧩 Anexo — Endpoints clave por fase

| Fase | Método + Ruta | Quién la llama |
|------|---------------|----------------|
| 1.1 | `GET /api/tablereservation/public/available-tables` | reservation-app |
| 1.3 | `POST /api/tablereservation/public` | reservation-app |
| 2.3 | `PUT /api/tablereservation/{id}/confirm` | host-app |
| 2.3 bis | `PUT /api/tablereservation/{id}/cancel` | host-app |
| 4.1 | `POST /api/tablesession` | host-app, client-app |
| 4.2 | `GET /api/table/qr/{qrCode}` | client-app |
| 5.1 | `GET /api/dish` | client-app |
| 5.3 | `POST /api/order` | client-app |
| 6.2 | `PUT /api/order/{id}/kitchen-preparing`<br>`PUT /api/order/{id}/bar-preparing` | kds-app |
| 6.3 | `PUT /api/order/{id}/kitchen-ready`<br>`PUT /api/order/{id}/bar-ready` | kds-app |
| 7.2 | `PUT /api/order/{id}/assign-waiter/{waiterId}` | waiter-app |
| 7.3 | `PUT /api/order/{id}/kitchen-served`<br>`PUT /api/order/{id}/bar-served` | waiter-app |
| 8.1 | `POST /api/payment/request-billing/{orderId}` | client-app |
| 9.2 | `GET /api/payment/validate-rnc/{rnc}` | cashier-app |
| 9.3 | `POST /api/payment/collect` | cashier-app |
| 9.4 | `GET /api/payment/by-order/{orderId}/receipt` | cashier-app, impresora |
| 10.2 | `GET /api/reports/sales-today` | admin-panel |
| 10.2 | `GET /api/reports/waiters` | admin-panel |
| 10.2 | `GET /api/reports/dish-avg-time` | admin-panel |
| 10.3 | `PUT /api/waitershift/{id}/close` | waiter-app |

---

# 🛡️ Reglas fiscales (Dominican Republic / DGII)

Configuradas en `appsettings.json → Billing`:

```json
"Billing": {
  "TaxRate": 0.18,        // ITBIS
  "TipRate": 0.10,        // Propina legal Ley 13-07
  "IsrOnTipRate": 0.10    // Retención ISR sobre propina
}
```

- **ITBIS 18%**: impuesto al valor agregado, sobre subtotal antes de propina
- **Propina 10%**: obligatoria por ley, se calcula sobre subtotal (no sobre total con ITBIS)
- **ISR 10% sobre propina**: retención que paga el restaurante a la DGII por cada propina cobrada
- **e-CF**: emisión electrónica vía DGII API, requiere certificado P12 y RNC del cliente si pide factura

---

# 🔌 Tablas DB clave

```
Users ─┬─ WaiterShifts
       └─ Orders (assignedWaiterId)

Zones ── Tables ─┬─ TableReservations ── ReservationPreOrders ── PreOrderItems
                 ├─ TableSessions
                 └─ Orders ── OrderItems ── Dishes (con Category)
                       │
                       └── Payments (CompletedAt, FiscalNCF, ProcessedByWaiterId)

RefreshTokens (auth)
LoginAttempts (rate limit)
```

---

# 🚪 Salidas alternativas (edge cases)

| Situación | Endpoint | Resultado |
|-----------|----------|-----------|
| Cliente cancela orden antes de Preparing | `POST /api/order/{id}/cancel` | Order → Cancelled, Mesa libre |
| Pago falla | `POST /api/payment/collect` con `Status = Failed` | Payment Failed, Order sigue Served |
| Reembolso | `POST /api/payment/{id}/refund` | Payment → Refunded |
| Mover orden a otra mesa | `PUT /api/order/{orderId}/move-to-table/{newTableId}` | Cambia TableId |
| Mesas virtuales (juntar 2 mesas) | `POST /api/virtualtable` + items consolidados | Una orden cobre N mesas |
| Walk-in sin reserva | El host hace lo mismo que asignar reserva, pero sin paso 1-3 | Funciona idéntico desde Fase 4.1 |

---

# 🎯 TL;DR

1. **Cliente** reserva en el portal → reserva queda `Pending`.
2. **Host** acepta → reserva `Confirmed` + broadcast WS.
3. **60 min antes**, la mesa se computa como `Reserved` (bloquea QR).
4. **Cliente llega**, escanea QR (o host la asigna) → mesa `Occupied`.
5. **Cliente** ordena en su PWA → `Order` con totales calculados (ITBIS + propina).
6. **Chef/Bartender** marca preparando → listo → broadcast al waiter.
7. **Waiter** sirve → `Order.ServedAt`.
8. **Cliente** pide cuenta → mesa `Billing`.
9. **Cajero** cobra (con e-CF opcional) → `Payment.Completed`, `Order.Completed`, mesa `Cleaning`.
10. **Admin** ve métricas en tiempo real en `/reports`.

> Todo el flujo persiste en tu SQL Server local `DESKTOP-NMHPOSS\SQLEXPRESS → DbNewMenu`.
> Cualquier app del staff con SignalR conectado ve los cambios en tiempo real sin recargar.
