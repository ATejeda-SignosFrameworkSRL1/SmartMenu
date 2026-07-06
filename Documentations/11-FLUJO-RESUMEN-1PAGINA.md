# 📄 SmartMenu — Flujo del Sistema (1 página)

**Qué es:** sistema de menú digital para restaurantes. El cliente escanea un QR, ordena y paga desde su celular; el staff (host, mesero, cocina, caja, admin) coordina todo en tiempo real vía SignalR.

## Flujo completo

```
Reserva → Host acepta → (auto) mesa Reserved → Cliente llega → Ordena → Cocina/Bar → Mesero sirve → Caja cobra → Limpieza
reservation  host-app                          client-app    client    kds-app    waiter-app   cashier-app
```

| # | Quién | Acción | Endpoint clave | Order | Mesa | Pago |
|---|-------|--------|----------------|-------|------|------|
| 1 | Cliente | Reserva en portal | `POST /api/tablereservation/public` | — | Available | — |
| 2 | Host | Acepta / rechaza | `PUT /api/tablereservation/{id}/confirm` | — | Available | — |
| 3 | (auto) | 60 min antes | computado en `GET /api/table` | — | **Reserved** | — |
| 4 | Cliente | Escanea QR (o host asigna) | `POST /api/tablesession` | — | **Occupied** | — |
| 5 | Cliente | Confirma orden | `POST /api/order` | **Pending** | Occupied | — |
| 6 | Chef/Bar | Preparar → Listo | `PUT /api/order/{id}/kitchen-ready` | Preparing→**Ready** | Occupied | — |
| 7 | Mesero | Sirve | `PUT /api/order/{id}/kitchen-served` | **Served** | Occupied | — |
| 8 | Cliente | Pide la cuenta | `POST /api/payment/request-billing/{orderId}` | Served | **Billing** | — |
| 9 | Cajero | Cobra (+ e-CF opcional) | `POST /api/payment/collect` | **Completed** | **Cleaning** | **Completed** |
| 10 | Personal | Limpia → libera | `PUT /api/table/{id}/status` | Completed | Available | Completed |

## Apps y roles

| App | Rol | App | Rol |
|-----|-----|-----|-----|
| reservation-app | Cliente público (reserva) | kds-app | Chef + Bartender |
| client-app (PWA) | Cliente en mesa (QR) | cashier-app | Cajero |
| host-app | Host / asignación de mesas | admin-panel | Admin / reportes |
| waiter-app | Mesero | | |

## Tiempo real (SignalR)

`/hubs/reservations` · `/hubs/orders` · `/hubs/kitchen` · `/hubs/tables`
Eventos: `NewReservation`, `OrderCreated`, `OrderStatusChanged`, `KitchenReady`/`BarReady`, `OrderBillingRequested`, `PaymentCompleted`, `TableStatusChanged`. Todo el staff conectado ve los cambios sin recargar.

## Reglas fiscales (DGII — `appsettings.json → Billing`)

Cálculo server-side sobre el subtotal: **ITBIS 18%** + **Propina legal 10%** (Ley 13-07) + **Retención ISR 10% sobre propina**. Si el cliente pide factura, se emite **e-CF (NCF)** firmado con certificado P12 y validación de RNC contra el padrón DGII.

## Estados

- **Order:** `Pending → Confirmed → Preparing → Ready → Served → Completed` (o `Cancelled`)
- **Mesa:** `Available → Reserved → Occupied → Billing → Cleaning → Available`
- **Payment:** `Pending → Processing → Completed` (o `Failed` / `Refunded`)

> 📚 Versión detallada paso a paso: [10-FLUJO-SISTEMA-END-TO-END.md](10-FLUJO-SISTEMA-END-TO-END.md)
