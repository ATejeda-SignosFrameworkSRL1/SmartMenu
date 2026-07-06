# Arquitectura actual del sistema de tiempo real

> Documento de **análisis del estado actual** (read-only). No describe cómo *debería* ser, sino cómo está implementado **hoy** en el repositorio. Rama `Developer`.

---

## 1. Mecanismo de tiempo real

El proyecto usa un **modelo híbrido**:

- **SignalR** (ASP.NET Core) como canal push principal — sobre **WebSockets** con *fallback* a **Server-Sent Events** y **Long Polling** (negociados por el SDK). No hay WebSockets "crudos" ni SSE implementados a mano.
- **Polling HTTP** (intervalos `setInterval`) como **red de seguridad** en TODAS las apps que consumen tiempo real, y como **único** mecanismo en algunas pantallas (client-app, admin `/kitchen`, admin `/bar`).

No se usa Redis backplane: `AddStackExchangeRedisCache` está **comentado** (`Program.cs:90`) y `AddSignalR()` se registra **sin** backplane (`Program.cs:253`) → **un solo proceso de backend** (ver §8, escalabilidad).

---

## 2. Inventario de archivos

### Backend (`src/backend/SmartMenu.API`)
| Archivo | Rol |
|---|---|
| `Program.cs` | `AddSignalR()` (l.253), JWT por `?access_token=` para `/hubs/*` (l.126-139), `MapHub` de los 4 hubs (l.369-372) |
| `Hubs/OrderHub.cs` | Hub `/hubs/orders` — grupos `order_{id}`, `waiter_{id}`, `admin` |
| `Hubs/KitchenHub.cs` | Hub `/hubs/kitchen` — grupo `kitchen` (auto-join) |
| `Hubs/TableHub.cs` | Hub `/hubs/tables` — grupo `table_{id}` |
| `Hubs/ReservationHub.cs` | Hub `/hubs/reservations` |
| `Hubs/TableRealtimeNotifier.cs` (`ITableRealtimeNotifier` en `Application/Services`) | Servicio inyectable que difunde estado de mesa vía `IHubContext<TableHub>` |
| `Controllers/OrderController.cs` | Emite `NewKitchenOrder`, `OrderReadyForService`/`CustomerFinished`/`ItemsAddedToOrder` (a `waiter_{id}`/All), `PaymentRegistered` |
| `Controllers/PaymentController.cs` | Emite `PaymentRegistered`, `BillingRequested` |
| `Controllers/TableController.cs` | Emite `TableStatusChanged` (directo + vía notifier) |
| `Controllers/TableReservationController.cs` | Emite eventos de reserva |
| `Controllers/TableClaimController.cs` | Emite `TableClaimRequested/Approved/Rejected` |
| `Infrastructure/Services/ReservationService.cs` | `BroadcastTableStatusAsync()` → `TableStatusChanged` en acciones de reserva |
| `BackgroundServices/ReservationLifecycleService.cs` | Barrido temporal → `ReservationNoShow`, `ReservationCompleted`, `AvailabilityChanged` |

### Frontend (`src/frontend`)
| App | Archivo(s) | Hubs que consume |
|---|---|---|
| **admin-panel** | `lib/useFloorPlanLive.ts` | `/hubs/tables` + `/hubs/reservations` |
| | `lib/useAdminNotifications.ts` | `/hubs/orders` (grupo `admin`) |
| | `app/reservations/page.tsx` | `/hubs/reservations` |
| | `app/kitchen/page.tsx` · `app/bar/page.tsx` | **ninguno** (solo polling) |
| **waiter-app** | `lib/useWaiterFloorPlan.ts` | `/hubs/tables` + `/hubs/reservations` |
| | `lib/useWaiterNotifications.ts` | `/hubs/orders` (grupo `waiter_{id}`) |
| | `app/page.tsx` | recibe eventos vía el hook (callback `onTableEvent`) + polling |
| **host-app** | `lib/useHostFloorPlan.ts` | `/hubs/tables` |
| | `app/page.tsx` | `/hubs/reservations` |
| **kds-app** | `app/page.tsx` | `/hubs/kitchen` |
| **cashier-app** | `app/page.tsx` | `/hubs/orders` |
| **client-app** | — | **ninguno** (polling de `/api/order/{id}` cada 5 s) |

Reconexión común en casi todos: `.withAutomaticReconnect([0, 2000, 5000, 10000, 30000])`. La kds-app usa `.withAutomaticReconnect()` (curva por defecto).

---

## 3. Configuración del Hub (`Program.cs`)

```csharp
builder.Services.AddSignalR();              // l.253 — sin Redis backplane, sin opciones (KeepAlive/Handshake por defecto)

// JWT para SignalR: el token viaja como query string ?access_token= (no header) — l.126-139
options.Events = new JwtBearerEvents {
  OnMessageReceived = context => {
    var accessToken = context.Request.Query["access_token"];
    var path = context.HttpContext.Request.Path;
    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
        context.Token = accessToken;
    return Task.CompletedTask;
  }
};

// Mapeo de hubs — l.369-372
app.MapHub<OrderHub>("/hubs/orders");
app.MapHub<KitchenHub>("/hubs/kitchen");
app.MapHub<TableHub>("/hubs/tables");
app.MapHub<ReservationHub>("/hubs/reservations");
```

- **No** `EnableDetailedErrors`, **no** `MaximumReceiveMessageSize` custom, **no** `KeepAliveInterval`/`HandshakeTimeout` custom (valores por defecto).
- En cliente, el token se inyecta con `accessTokenFactory: () => ensureFreshToken(<app>)` (refresca si expira en <60 s).
- En el stack QA, Caddy enruta `/hubs/*` **directo al backend** (carve-out `app-with-backend` en el Caddyfile); el rewrite de Next.js de `/hubs` queda sin uso (estaba congelado a `localhost:5041`).

---

## 4. Hubs en detalle

### `/hubs/orders` — `OrderHub` `[Authorize]` (cualquier usuario autenticado)
- **Métodos invocables por el cliente:** `JoinOrderGroup(orderId)`, `LeaveOrderGroup`, `JoinWaiterGroup(waiterId)`, `LeaveWaiterGroup`, `JoinAdminGroup`, `LeaveAdminGroup`.
- **Grupos:** `order_{id}`, `waiter_{id}`, `admin`.
- **Métodos `NotifyNewOrder` / `NotifyOrderStatusChanged` / `NotifyOrderCompleted`:** definidos pero **NUNCA invocados** (ver §8, código muerto). Los broadcasts reales salen de los controllers vía `IHubContext`.

### `/hubs/kitchen` — `KitchenHub` `[Authorize(Roles="Admin,Manager,Chef,KitchenStaff,Bartender")]`
- **`OnConnectedAsync` → auto-join al grupo `kitchen`** (el KDS no necesita invocar nada).
- Métodos `JoinKitchenGroup` / `LeaveKitchenGroup` (manuales) + `NotifyNewOrderForKitchen` / `NotifyItemReady` (**muertos**, los controllers emiten directo).

### `/hubs/tables` — `TableHub` `[Authorize]`
- **Grupos:** `table_{id}` (definido pero **no se usa**: todo se difunde a `Clients.All`).
- Método `NotifyTableStatusChanged` (**muerto**). El canal real es `ITableRealtimeNotifier` (controllers + `ReservationService`).

### `/hubs/reservations` — `ReservationHub` `[Authorize(Roles="Admin,Manager,Host,Hostess")]`
- Métodos `NotifyNewReservation` / `NotifyReservationConfirmed` / `NotifyReservationCancelled` (**muertos**).
- ⚠️ **El rol `Waiter` NO está autorizado en este hub** (ver §8) — la waiter-app se suscribe a `/hubs/reservations` y esa conexión es rechazada por autorización.

### `Clients.User` — **no se usa en ningún hub.** El direccionamiento es por **grupos** (`waiter_{id}`, `admin`, `kitchen`) o **broadcast** (`Clients.All`).

---

## 5. Flujo completo (ejemplo: cambio de estado de mesa por el Host)

1. **Componente que inicia:** Host pulsa "Sentar"/"Asignar"/"Cobrar" en `host-app` (o el cliente paga, o un mesero abre cuenta).
2. **Endpoint que recibe:** p. ej. `POST /api/tablesession`, `PUT /api/tablereservation/{id}/seat`, `POST /api/payment/collect`, `PUT /api/table/{id}/status` (controllers en `SmartMenu.API`).
3. **Capa de negocio:** el servicio correspondiente (`ReservationService`, `OrderService`, lógica del controller). Aquí se aplica la regla de negocio (ventana de reserva, estado efectivo, etc.).
4. **Persistencia:** EF Core `ApplicationDbContext` → SQL Server (`DbNewMenu`). Se guarda el nuevo estado (`Table.Status`, `TableReservation.Status`, `Payment`, etc.).
5. **Notificación:** tras persistir, el controller/servicio llama a `ITableRealtimeNotifier.TableStatusChangedAsync(...)` (o `_xHub.Clients.{All|Group(...)}.SendAsync("Evento", payload)`), que difunde por el hub correspondiente.
6. **Frontend recibe:** los hooks suscritos (`useFloorPlanLive` admin, `useHostFloorPlan` host, `useWaiterFloorPlan` waiter) reciben `TableStatusChanged` por `/hubs/tables`, **reconcilian el estado en memoria** (`applyStatus`/`applyWaiter`) y React re-renderiza **sin recargar**. El **polling** (5–20 s) actúa como respaldo y para transiciones temporales (p. ej. "Reservada" dinámica).

---

## 6. Diagrama de la arquitectura actual

```text
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (7 apps Next.js)                                             │
│  client │ admin │ kds │ waiter │ host │ cashier │ reservation         │
│   (POST/GET)   hooks SignalR + polling de respaldo                    │
└───────────┬───────────────────────────────────▲──────────────────────┘
            │ HTTPS  (acción del usuario)        │ push SignalR (WS/SSE/LP)
            ▼                                     │
┌─────────────────────────────────────────────────────────────────────┐
│ CADDY (QA)  — termina TLS, /api·/uploads·/hubs → backend:8080         │
└───────────┬───────────────────────────────────▲──────────────────────┘
            ▼                                     │
┌─────────────────────────────────────────────────────────────────────┐
│ API (ASP.NET Core Controllers)                                        │
│   OrderController · PaymentController · TableController ·             │
│   TableReservationController · TableClaimController                   │
└───────────┬───────────────────────────────────▲──────────────────────┘
            ▼                                     │ IHubContext<XHub>.SendAsync(...)
┌───────────────────────────────┐                │
│ SERVICIO (Application/Infra)  │                │
│   OrderService · Reservation- │────────────────┤
│   Service.BroadcastTableStatus│ (notifica tras │
└───────────┬───────────────────┘  persistir)    │
            ▼                                      │
┌───────────────────────────────┐                │
│ REPOSITORIO / EF Core DbContext│                │
└───────────┬───────────────────┘                │
            ▼                                      │
┌───────────────────────────────┐                │
│ BASE DE DATOS (SQL Server)    │                │
│   DbNewMenu                   │                │
└───────────────────────────────┘                │
                                                  │
┌─────────────────────────────────────────────────────────────────────┐
│ SignalR HUBS (1 proceso, sin backplane)                              │
│   /hubs/orders   /hubs/kitchen   /hubs/tables   /hubs/reservations    │
│   grupos: kitchen · admin · waiter_{id} · order_{id} · table_{id}     │
│   scope dominante: Clients.All (broadcast)                            │
└───────────┬───────────────────────────────────────────────────────────┘
            ▼
   CLIENTES CONECTADOS (filtran en el cliente lo que les aplica)
```

**Detalle importante:** el flujo NO es un único pipeline lineal. La notificación SignalR la dispara el **controller/servicio** *después* de persistir; los métodos internos de los Hubs no participan (son código muerto).

---

## 7. Catálogo de eventos de tiempo real

| Evento | Emisor (archivo:línea) | Hub · Scope | Consumidores (frontend) | Datos |
|---|---|---|---|---|
| **TableStatusChanged** | `TableRealtimeNotifier:18`; `TableController:198,377`; (vía `ReservationService.BroadcastTableStatusAsync`) | tables · `Clients.All` | admin `useFloorPlanLive`, host `useHostFloorPlan`, waiter `useWaiterFloorPlan` (+ grilla vía `onTableEvent`) | `{tableId, status, timestamp}` |
| **TableWaiterChanged** | `TableRealtimeNotifier:21` | tables · All | admin, host, waiter (planos) | `{tableId, waiter, waiterName, timestamp}` |
| **FloorPlanVisibilityChanged** | `TableRealtimeNotifier:24` | tables · All | admin, host, waiter | `{hostEnabled, waiterEnabled, timestamp}` |
| **NewReservation** | `TableReservationController:552` | reservations · All | admin `useFloorPlanLive` + `reservations/page`, host `page`, waiter `useWaiterFloorPlan`* | objeto reserva completo |
| **ReservationConfirmed** | `TableReservationController:308,359` | reservations · All | admin, host, waiter* | `{reservationId, timestamp}` |
| **ReservationCancelled** | `TableReservationController:318,359` | reservations · All | admin, host, waiter* | `{reservationId, timestamp}` |
| **ReservationTableAssigned** | `TableReservationController:219,237` | reservations · All | admin, waiter* | `{reservationId, tableId, tableIds, tableNumber, timestamp}` |
| **ReservationSeated** | `TableReservationController:277` | reservations · All | admin, waiter* | `{reservationId, tableId, tableSessionId, timestamp}` |
| **ReservationNoShow** | `TableReservationController:295`; `ReservationLifecycleService:101` | reservations · All | (sin consumidor explícito) | `{reservationId, timestamp}` |
| **ReservationRescheduled** | `TableReservationController:330` | reservations · All | (sin consumidor explícito) | `{reservationId, newDateTime, timestamp}` |
| **ReservationCompleted** | `ReservationLifecycleService:146` | reservations · All | (sin consumidor explícito) | `{reservationId, timestamp}` |
| **AvailabilityChanged** | `TableReservationController:543`; `ReservationLifecycleService:103` | reservations · All | host `page` | `{date, timestamp}` |
| **NewKitchenOrder** | `OrderController:71,198,655,771` | kitchen · `Group("kitchen")` | kds-app `page` | `{orderId, orderNumber, items, timestamp}` |
| **KitchenItemReady** | `KitchenHub:22` (método del hub, sin invocador) | kitchen · All | (sin consumidor) | `{orderId, itemId, timestamp}` |
| **NewOrderCreated** | `OrderHub:11` (**muerto**) | orders · All | (sin consumidor) | `{orderId, tableId, timestamp}` |
| **OrderStatusChanged** | `OrderHub:16` (**muerto**) | orders · All | (sin consumidor) | `{orderId, status, timestamp}` |
| **OrderCompleted** | `OrderHub:21` (**muerto**) | orders · All | cashier `page` (escucha, pero nadie lo emite) | `{orderId, timestamp}` |
| **OrderReadyForService** | `OrderController:56,58` (vía `eventName`) | orders · `waiter_{id}` / All | waiter `useWaiterNotifications` | payload de orden |
| **CustomerFinished** | `OrderController` (vía `eventName`) | orders · waiter_{id}/All | waiter `useWaiterNotifications` | payload |
| **ItemsAddedToOrder** | `OrderController` (vía `eventName`) | orders · waiter_{id}/All | waiter `useWaiterNotifications` | payload |
| **PaymentRegistered** | `PaymentController:156`; `OrderController:789` | orders · All | cashier `page` | `{paymentId, orderId, orderNumber, method, amount, tipAmount, totalAmount, completedAt}` |
| **BillingRequested** | `PaymentController:389,391` | orders · `waiter_{id}` o All | waiter `useWaiterNotifications` | `{orderId, orderNumber, tableNumber, paymentMethod, tip…, total, message}` |
| **TableClaimRequested** | `TableClaimController:75` | orders · `Group("admin")` | admin `useAdminNotifications` | `{requestId, waiterId, waiterName, tableId, tableNumber, orderId, message, timestamp}` |
| **TableClaimApproved** | `TableClaimController:167` | orders · `waiter_{id}` | waiter `useWaiterNotifications` | `{requestId, tableId, tableNumber, message, adminNote, timestamp}` |
| **TableClaimRejected** | `TableClaimController:219` | orders · `waiter_{id}` | waiter `useWaiterNotifications` | `{requestId, tableId, tableNumber, message, adminNote, timestamp}` |

\* La suscripción de la **waiter-app a `/hubs/reservations`** existe en código pero **falla por autorización** (el `ReservationHub` no permite el rol `Waiter`) — ver §8.

---

## 8. Problemas detectados

### 🔴 Críticos / funcionales
1. **Desajuste de roles en `ReservationHub`.** Está `[Authorize(Roles="Admin,Manager,Host,Hostess")]` (`ReservationHub.cs:6`), **sin `Waiter`**. La `waiter-app` se conecta a `/hubs/reservations` (`useWaiterFloorPlan.ts:160`) → la negociación es rechazada por autorización para usuarios con rol `Waiter`. La red de seguridad de reservas del mesero **no funciona** (el estado de mesa por `/hubs/tables` sí, porque `TableHub` es solo `[Authorize]`).
2. **Self-order del cliente no llega a cocina/bar sin un mesero.** La orden nace `Pending`; el KDS solo muestra `Confirmed/Preparing/Ready` y `NewKitchenOrder` solo se emite al confirmar (`OrderController` status→Confirmed). (Documentado aparte.)
3. **Pago por comensal: parte ya pagada queda seleccionada.** Tras un pago parcial, la UI del waiter no avanza a la parte siguiente y el botón no se deshabilita → reintentos contra una parte ya cobrada → 400 en bucle. (Documentado aparte.)

### 🟠 Código muerto
4. **Todos los métodos `NotifyXxx` de los 4 Hubs son código muerto.** Los clientes solo invocan `Join*Group`; los broadcasts reales salen de los controllers vía `IHubContext`. Métodos sin invocador: `OrderHub.NotifyNewOrder/NotifyOrderStatusChanged/NotifyOrderCompleted`, `KitchenHub.NotifyNewOrderForKitchen/NotifyItemReady`, `TableHub.NotifyTableStatusChanged`, `ReservationHub.Notify*`.
5. **Eventos emitidos sin consumidor:** `KitchenItemReady`, `ReservationNoShow`, `ReservationRescheduled`, `ReservationCompleted` (nadie los escucha en el frontend). `OrderCompleted` se **escucha** (cashier) pero **nadie lo emite** (solo el método muerto del hub).
6. **Grupos definidos y no usados:** `table_{id}` (TableHub) y `order_{id}` (OrderHub) tienen Join/Leave pero ningún broadcast los usa.

### 🟡 Eventos duplicados / inconsistencias
7. **`NewKitchenOrder` se emite desde 4 sitios** del `OrderController` (l.71, 198, 655, 771) + el método muerto del hub. Cada uno arma el payload por separado (riesgo de divergencia).
8. **`TableStatusChanged` tiene dos rutas:** `ITableRealtimeNotifier` (canónica) y `_tableHub.Clients.All.SendAsync` directo en `TableController:198,377`. Conviene una sola.
9. **`PaymentRegistered` se emite desde dos sitios** (`PaymentController:156` y `OrderController:789`) → posible doble notificación al cashier para el mismo cobro.
10. **`ReservationConfirmed`/`Cancelled` emitidos desde varios puntos** (controller + zone-decision + lifecycle) — verificar que no se dupliquen en una misma transición.

### 🟡 Broadcasts innecesarios
11. **Predominio de `Clients.All`.** Casi todos los eventos de mesa/reserva van a *todos* los clientes del hub, que luego filtran en el cliente. No se aprovechan grupos por zona/rol → tráfico O(N clientes) por evento.

### 🟡 Tiempo real incompleto (depende de polling)
12. **admin `/kitchen` (30 s) y `/bar` (10 s) NO usan SignalR** — solo polling. La kds-app standalone (`:8445`) sí usa `/hubs/kitchen`. Dos implementaciones de KDS conviviendo.
13. **client-app sin tiempo real:** el seguimiento de orden del comensal es polling de `/api/order/{id}` cada 5 s.
14. **Bar sin canal propio:** no hay grupo/hub "bar"; `NewKitchenOrder` va al grupo `kitchen` y el bar se distingue por **palabras clave** en el nombre del plato (`DrinkKeywords`), no por un campo (`OrderItem.Destination` existe pero **nunca se asigna**).

### 🟠 Condiciones de carrera
15. **Estado "Reservada" dinámico** se calcula en cada `GET /api/floorplan` según la ventana de bloqueo y se refresca por **polling** (no hay push de la transición temporal) → ventana de hasta 10-20 s entre el cambio real y el reflejo.
16. **UI optimista vs polling/SignalR**: la grilla del waiter parchea en vivo y a la vez hace polling; posibles parpadeos si el GET trae un snapshot más viejo que el último evento.

### 🟢 Reconexión y fugas de memoria
17. **Reconexión:** presente en todas las conexiones (`withAutomaticReconnect`). Tras reconectar, `KitchenHub` re-une al grupo `kitchen` automáticamente (`OnConnectedAsync`); `useWaiterNotifications`/`useAdminNotifications` re-invocan `JoinWaiterGroup`/`JoinAdminGroup` en el callback de reconexión. **OK.**
18. **Limpieza:** los hooks hacen `conn.stop()` y `clearInterval` en el cleanup del `useEffect` → sin fugas evidentes. Matiz: cada cliente abre **varias** conexiones (la waiter-app abre 3: tables, reservations, orders) — costo de conexiones, no fuga.
19. **Errores de conexión** ya se loguean (`conn.start().catch(e => console.error(...))`) tras un fix reciente; antes eran silenciosos.

### 🔴 Escalabilidad
20. **Sin backplane (Redis/Azure SignalR).** `AddSignalR()` sin distribución → **solo funciona con un único proceso de backend**. Si se escala horizontalmente (varias réplicas del API), un evento emitido en la instancia A **no** llega a los clientes conectados a la instancia B. Habilitar `AddStackExchangeRedis` (ya hay Redis en el compose, hoy comentado) sería el primer paso para escalar.
21. **`Clients.All` + filtrado en cliente** no escala a muchas mesas/dispositivos; conviene segmentar por grupos (zona, rol).

---

## 9. Resumen

- **Tecnología:** SignalR (WebSockets→SSE→LongPolling) + polling de respaldo. Sin SSE/WebSocket manual. Sin backplane.
- **Hubs:** 4 (`orders`, `kitchen`, `tables`, `reservations`). El direccionamiento real es por **grupos** (`kitchen`, `admin`, `waiter_{id}`) y **`Clients.All`**; **no** se usa `Clients.User`.
- **Patrón de emisión:** los **controllers/servicios** difunden vía `IHubContext` *después de persistir*; los **métodos internos de los Hubs son código muerto**.
- **Canónico para mesas:** `ITableRealtimeNotifier` → `TableStatusChanged`/`TableWaiterChanged`/`FloorPlanVisibilityChanged` por `/hubs/tables`, consumido por los planos de admin/host/waiter (reconciliación en sitio).
- **Riesgos principales hoy:** rol `Waiter` no autorizado en `ReservationHub`; ausencia de backplane (no escala horizontalmente); abundancia de `Clients.All`; código muerto en los hubs; KDS admin solo-polling; bar sin canal/campo de enrutamiento propio.

> Generado por análisis estático del repositorio (rama `Developer`). No se modificó código de la aplicación.
