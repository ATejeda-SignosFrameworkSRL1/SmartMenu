# 07 - Casos de Uso del Personal

**Proyecto:** SmartMenu  
**Actores:** Waiter (Mesero), Chef, Hostess, Bartender  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 CASOS DE USO - MESERO

1. [Login del Sistema](#cu-01-login-del-sistema)
2. [Ver Mesas Asignadas](#cu-02-ver-mesas-asignadas)
3. [Asignar Mesa a Clientes](#cu-03-asignar-mesa-a-clientes)
4. [Tomar Orden Manual](#cu-04-tomar-orden-manual)
5. [Ver Órdenes Activas](#cu-05-ver-órdenes-activas)
6. [Actualizar Estado de Orden](#cu-06-actualizar-estado-de-orden)
7. [Servir Platillos](#cu-07-servir-platillos)
8. [Procesar Pago](#cu-08-procesar-pago)

---

## CU-01: Login del Sistema

### Descripción
El personal del restaurante inicia sesión en el sistema.

### Actores
Todos los roles de personal

### Precondiciones
- Usuario tiene credenciales válidas
- Sistema está en línea

### Flujo Principal

1. Personal abre `http://localhost:3000`
2. Sistema redirige a `/login`
3. Personal ingresa:
   - Email
   - Password
4. Personal presiona "Iniciar Sesión"
5. Sistema valida credenciales
6. Sistema verifica rol del usuario
7. Sistema redirige según rol:
   - Admin/Manager → `localhost:3001` (Admin Panel)
   - Chef/KitchenStaff → `localhost:3002` (KDS)
   - Waiter/Hostess → `localhost:3003` (Waiter App)
   - Cashier → `localhost:3001/cashier`
8. Sistema muestra dashboard correspondiente
9. Sistema registra fecha/hora de login

### Postcondiciones
- Usuario está autenticado
- Token JWT almacenado
- Dashboard cargado

### Credenciales de Prueba
```
Mesero:
Email: waiter@smartmenu.com
Password: Waiter123!

Chef:
Email: chef@smartmenu.com
Password: Chef123!

Cajero:
Email: cashier@smartmenu.com
Password: Cash123!
```

### Flujos Alternativos

**FA1: Credenciales Inválidas**
- En paso 5:
  - Sistema detecta credenciales incorrectas
  - Sistema muestra: "Credenciales inválidas"
  - Usuario puede reintentar

**FA2: Usuario Inactivo**
- En paso 5:
  - Sistema detecta usuario desactivado
  - Sistema muestra: "Usuario inactivo. Contacta al administrador"
  - Login no procede

---

## CU-02: Ver Mesas Asignadas

### Descripción
El mesero visualiza las mesas de su zona.

### Actor
Waiter, Hostess

### Precondiciones
- Mesero ha iniciado sesión

### Flujo Principal

1. Sistema muestra Waiter App Dashboard
2. Sistema carga todas las mesas
3. Sistema muestra para cada mesa:
   - Número de mesa
   - Zona
   - Capacidad
   - Estado (Disponible, Ocupada, Reservada, Fuera de Servicio)
   - Código QR
4. Sistema usa colores para estados:
   - Verde: Disponible
   - Rojo: Ocupada
   - Amarillo: Reservada
   - Gris: Fuera de Servicio
5. Mesero puede filtrar por zona
6. Sistema actualiza estados en tiempo real vía SignalR

### UI/UX
```
┌────────────────────────────┐
│ SmartMenu Waiter           │
│ María González    [Salir]  │
├────────────────────────────┤
│                            │
│ Estadísticas:              │
│ Total: 20  Disponibles: 8  │
│ Ocupadas: 10  Reservadas: 2│
│                            │
│ Filtros: [Todas] [Terraza] │
│         [Salón] [Bar]      │
│                            │
│ ┌──────┐  ┌──────┐         │
│ │Mesa 1│  │Mesa 2│         │
│ │🟢    │  │🔴    │         │
│ │Cap: 4│  │Cap: 4│         │
│ └──────┘  └──────┘         │
│                            │
│ ┌──────┐  ┌──────┐         │
│ │Mesa 3│  │Mesa 4│         │
│ │🟢    │  │🟡    │         │
│ │Cap: 2│  │Cap: 6│         │
│ └──────┘  └──────┘         │
└────────────────────────────┘
```

---

## CU-03: Asignar Mesa a Clientes

### Descripción
El mesero/hostess asigna una mesa disponible a clientes que llegan.

### Actor
Waiter, Hostess

### Precondiciones
- Hay mesas disponibles
- Clientes están esperando

### Flujo Principal

1. Hostess consulta mesas disponibles
2. Hostess identifica mesa adecuada por:
   - Número de personas
   - Zona preferida
   - Disponibilidad
3. Hostess toca la mesa en la aplicación
4. Sistema muestra detalles de la mesa
5. Hostess presiona "Asignar Mesa"
6. Sistema solicita:
   - Número de personas
   - Nombre del cliente (opcional)
7. Hostess confirma asignación
8. Sistema cambia estado a "Ocupada"
9. Sistema notifica cambio vía SignalR
10. Hostess acompaña clientes a la mesa

### Postcondiciones
- Mesa marcada como "Ocupada"
- Sesión de mesa iniciada
- QR de mesa listo para escanear

---

## CU-04: Tomar Orden Manual

### Descripción
El mesero toma una orden directamente (sin que cliente use QR).

### Actor
Waiter

### Precondiciones
- Mesa está ocupada
- Clientes están listos para ordenar

### Flujo Principal

1. Mesero accede a la mesa en su aplicación
2. Mesero presiona "Nueva Orden"
3. Sistema muestra menú completo
4. Mesero navega por categorías
5. Para cada platillo que cliente ordena:
   - Mesero selecciona platillo
   - Mesero ingresa cantidad
   - Mesero agrega notas especiales
   - Sistema agrega al carrito temporal
6. Mesero revisa orden con cliente
7. Mesero confirma orden
8. Sistema envía orden a cocina
9. Sistema notifica a KDS vía SignalR
10. Mesero entrega ticket al cliente (opcional)

### Postcondiciones
- Orden creada en sistema
- Cocina notificada
- Mesero puede ver estado

---

## 📋 CASOS DE USO - CHEF

### CU-05: Ver Órdenes Activas

### Descripción
El chef visualiza todas las órdenes pendientes en el KDS.

### Actor
Chef, KitchenStaff

### Precondiciones
- Chef ha iniciado sesión en KDS

### Flujo Principal

1. Sistema muestra KDS Dashboard (fondo negro)
2. Sistema carga órdenes activas:
   - Pending
   - Confirmed
   - Preparing
3. Sistema muestra para cada orden:
   - Número de orden
   - Mesa
   - Tiempo desde creación
   - Items del pedido
   - Estado de cada item
   - Notas especiales
4. Sistema ordena por antigüedad (FIFO)
5. Sistema usa alertas de color:
   - Verde: < 15 min
   - Amarillo: 15-25 min
   - Rojo: > 25 min
6. Sistema actualiza en tiempo real
7. Chef ve nuevas órdenes aparecer automáticamente

### UI/UX - KDS
```
┌────────────────────────────┐
│ Kitchen Display System     │
│ Juan Pérez       [Salir]   │
│ Órdenes Activas: 3         │
├────────────────────────────┤
│                            │
│ ┌──────────────────────┐   │
│ │ ORD-00042  Mesa 1    │   │
│ │ 🟢 8 minutos         │   │
│ │ ───────────────────  │   │
│ │ 2x Ensalada César    │   │
│ │   Extra aderezo      │   │
│ │ 1x Churrasco         │   │
│ │   Término medio      │   │
│ │                      │   │
│ │ [Confirmar] [Listo]  │   │
│ └──────────────────────┘   │
│                            │
│ ┌──────────────────────┐   │
│ │ ORD-00043  Mesa 5    │   │
│ │ 🟡 18 minutos        │   │
│ │ ───────────────────  │   │
│ │ 1x Filet Mignon      │   │
│ │ 2x Papas Fritas      │   │
│ │                      │   │
│ │ [Confirmar] [Listo]  │   │
│ └──────────────────────┘   │
└────────────────────────────┘
```

---

### CU-06: Actualizar Estado de Orden

### Descripción
El chef actualiza el estado de las órdenes mientras prepara.

### Actor
Chef, KitchenStaff

### Precondiciones
- Hay órdenes activas

### Flujo Principal

1. Chef selecciona una orden nueva
2. Chef presiona "Confirmar"
3. Sistema cambia estado a "Confirmed"
4. Sistema notifica al mesero vía SignalR
5. Chef comienza preparación
6. Chef actualiza items individuales:
   - Marca "Preparando"
   - Marca "Listo" cuando termina
7. Cuando todos los items están listos:
   - Chef presiona "Orden Lista"
   - Sistema cambia estado a "Ready"
   - Sistema notifica al mesero
   - Sistema emite alerta sonora
8. Orden sale del KDS cuando mesero la recoge

### Estados del Item
- **Pending**: Esperando confirmación
- **Preparing**: En preparación
- **Ready**: Listo para servir

---

### CU-07: Servir Platillos

### Descripción
El mesero recoge platillos listos y los sirve.

### Actor
Waiter

### Precondiciones
- Orden está en estado "Ready"

### Flujo Principal

1. Mesero recibe notificación: "Orden {número} lista"
2. Mesero va a la cocina
3. Mesero verifica platillos contra orden
4. Mesero confirma recepción en app
5. Sistema marca items como "Picked Up"
6. Mesero lleva platillos a la mesa
7. Mesero verifica con cliente:
   - Platillos correctos
   - Cliente satisfecho
8. Mesero actualiza estado a "Served"
9. Sistema actualiza orden
10. Cliente disfruta su comida

### Postcondiciones
- Orden marcada como "Served"
- Cliente tiene sus platillos
- Mesero puede proceder con pago cuando cliente termine

---

### CU-08: Procesar Pago

### Descripción
El cajero/mesero procesa el pago de la cuenta.

### Actor
Cashier, Waiter

### Precondiciones
- Orden está servida
- Cliente solicita cuenta

### Flujo Principal

1. Mesero/Cajero accede a la orden
2. Sistema muestra resumen de cuenta:
   - Items consumidos
   - Subtotal
   - ITBIS (18%)
   - Propina (opcional)
   - Total
3. Personal pregunta método de pago al cliente
4. Personal selecciona método en sistema:
   - Efectivo
   - Tarjeta
   - Transferencia
5. Si es tarjeta:
   - Personal procesa en terminal
   - Ingresa código de autorización
6. Si es efectivo:
   - Personal ingresa monto recibido
   - Sistema calcula cambio
7. Personal confirma pago
8. Sistema genera factura
9. Sistema actualiza orden a "Completed"
10. Sistema libera mesa (estado → "Available")
11. Personal entrega recibo al cliente

### Postcondiciones
- Pago registrado
- Factura generada
- Mesa disponible
- Orden completada

### Flujos Alternativos

**FA1: División de Cuenta**
- En paso 2:
  - Cliente solicita dividir
  - Personal divide cuenta
  - Cada persona paga individualmente

**FA2: Pago con Descuento**
- En paso 2:
  - Personal aplica descuento
  - Sistema recalcula total
  - Personal procede con pago

---

## ✅ RESUMEN DE CASOS DE USO - PERSONAL

### Mesero/Hostess
| ID | Caso de Uso | Estado | Prioridad |
|----|-------------|--------|-----------|
| CU-01 | Login | ✅ Implementado | Alta |
| CU-02 | Ver Mesas | ✅ Implementado | Alta |
| CU-03 | Asignar Mesa | ⚠️ Parcial | Media |
| CU-04 | Tomar Orden Manual | ❌ Pendiente | Media |
| CU-07 | Servir Platillos | ⚠️ Parcial | Alta |
| CU-08 | Procesar Pago | ❌ Pendiente | Alta |

### Chef/Cocina
| ID | Caso de Uso | Estado | Prioridad |
|----|-------------|--------|-----------|
| CU-01 | Login | ✅ Implementado | Alta |
| CU-05 | Ver Órdenes KDS | ✅ Implementado | Alta |
| CU-06 | Actualizar Estado | ⚠️ Parcial | Alta |

---

**Última Actualización:** 7 de Febrero de 2026  
**Estado:** ✅ Documentación Completa
