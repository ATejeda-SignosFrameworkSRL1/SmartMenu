# 06 - Casos de Uso del Cliente

**Proyecto:** SmartMenu  
**Actor Principal:** Cliente  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 CASOS DE USO

1. [Escanear QR y Acceder al Menú](#cu-01-escanear-qr-y-acceder-al-menú)
2. [Explorar Menú](#cu-02-explorar-menú)
3. [Buscar Platillos](#cu-03-buscar-platillos)
4. [Filtrar Platillos](#cu-04-filtrar-platillos)
5. [Ver Detalles de Platillo](#cu-05-ver-detalles-de-platillo)
6. [Agregar al Carrito](#cu-06-agregar-al-carrito)
7. [Modificar Carrito](#cu-07-modificar-carrito)
8. [Realizar Pedido](#cu-08-realizar-pedido)
9. [Ver Estado de Pedido](#cu-09-ver-estado-de-pedido)
10. [Pagar Cuenta](#cu-10-pagar-cuenta)

---

## CU-01: Escanear QR y Acceder al Menú

### Descripción
El cliente escanea el código QR ubicado en su mesa para acceder al menú digital.

### Actor Principal
Cliente

### Precondiciones
- La mesa tiene un código QR funcional
- El cliente tiene un dispositivo con cámara y navegador web

### Flujo Principal

1. Cliente toma su dispositivo móvil
2. Cliente abre la aplicación de cámara o escáner QR
3. Cliente escanea el código QR de la mesa
4. Sistema redirige a: `http://localhost:3000/table/table-{id}`
5. Sistema identifica la mesa y muestra:
   - Nombre del restaurante
   - Número de mesa
   - Zona de la mesa
   - Capacidad de la mesa
6. Sistema guarda el ID de mesa en el carrito
7. Sistema espera 2 segundos
8. Sistema redirige automáticamente al menú (`/menu`)
9. Cliente visualiza el menú completo

### Postcondiciones
- Cliente está en la página del menú
- Mesa está asociada a la sesión del cliente
- Carrito está inicializado con el ID de la mesa

### Flujos Alternativos

**FA1: QR Inválido**
- En el paso 4:
  - Sistema no encuentra la mesa
  - Sistema muestra error: "Mesa no encontrada"
  - Sistema sugiere escanear nuevamente

**FA2: Sin Conexión**
- En el paso 4:
  - Sistema no puede conectarse al servidor
  - Sistema muestra mensaje: "Sin conexión. Intenta nuevamente"
  - Cliente espera y reintenta

### Reglas de Negocio
- RN-01: Cada mesa tiene un QR único
- RN-02: El QR contiene el formato: `table-{número}`
- RN-03: La sesión se mantiene hasta que el cliente cierre el navegador

### Datos de Ejemplo
```
URL QR: http://localhost:3000/table/table-1
Mesa: 1
Zona: Terraza
Capacidad: 4 personas
```

### UI/UX
```
┌─────────────────────────────┐
│   [Logo SmartMenu]          │
│                             │
│  ¡Bienvenido!               │
│                             │
│  ┌─────────────────────┐   │
│  │                     │   │
│  │    Mesa 1           │   │
│  │                     │   │
│  └─────────────────────┘   │
│                             │
│  Zona: Terraza              │
│  Capacidad: 4 personas      │
│                             │
│  Mesa lista para ordenar ✓  │
│                             │
│  [↻ Redirigiendo...]        │
└─────────────────────────────┘
```

---

## CU-02: Explorar Menú

### Descripción
El cliente navega por las diferentes categorías y platillos del menú.

### Actor Principal
Cliente

### Precondiciones
- Cliente ha escaneado el QR y accedió al menú

### Flujo Principal

1. Sistema muestra menú organizado por categorías:
   - Entradas
   - Platos Fuertes
   - Postres
   - Bebidas
2. Cliente desliza verticalmente para ver más categorías
3. Cliente toca una categoría
4. Sistema desplaza automáticamente a esa sección
5. Cliente visualiza platillos de la categoría:
   - Imagen
   - Nombre
   - Descripción breve
   - Precio
   - Tiempo de preparación
   - Iconos (vegetariano, vegano, sin gluten)
6. Cliente continúa explorando otras categorías

### Postcondiciones
- Cliente conoce las opciones disponibles

### UI/UX
```
┌─────────────────────────────┐
│ SmartMenu         [🛒 0]    │
├─────────────────────────────┤
│ [🔍 Buscar platillos...]    │
│                             │
│ [Vegetariano] [Vegano]      │
│ [Sin Gluten]                │
│                             │
│ ┌─ Entradas ─────────────┐ │
│ ├─ Platos Fuertes ───────┤ │
│ ├─ Postres ──────────────┤ │
│ └─ Bebidas ──────────────┘ │
│                             │
│ === Entradas ===            │
│                             │
│ ┌─────────────────────┐    │
│ │ [Imagen]            │    │
│ │ Ensalada César      │    │
│ │ Lechuga romana...   │    │
│ │ RD$ 350 • 10 min 🌱 │    │
│ │ [+ Agregar]         │    │
│ └─────────────────────┘    │
│                             │
│ ┌─────────────────────┐    │
│ │ [Imagen]            │    │
│ │ Sopa del Día        │    │
│ │ Pregunta a tu...    │    │
│ │ RD$ 280 • 5 min     │    │
│ │ [+ Agregar]         │    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

---

## CU-03: Buscar Platillos

### Descripción
El cliente busca platillos específicos por nombre.

### Actor Principal
Cliente

### Precondiciones
- Cliente está en el menú

### Flujo Principal

1. Cliente toca el campo de búsqueda
2. Sistema muestra el teclado
3. Cliente escribe el nombre o palabra clave
4. Sistema filtra platillos en tiempo real
5. Sistema muestra solo platillos que coincidan
6. Cliente ve resultados mientras escribe
7. Cliente selecciona un platillo de los resultados

### Flujos Alternativos

**FA1: Sin Resultados**
- En el paso 4:
  - Sistema no encuentra coincidencias
  - Sistema muestra: "No se encontraron platillos con '{búsqueda}'"
  - Sistema sugiere: "Intenta con otro término"

### Reglas de Negocio
- RN-04: Búsqueda no distingue mayúsculas/minúsculas
- RN-05: Búsqueda incluye nombre y descripción
- RN-06: Búsqueda se actualiza cada letra ingresada

---

## CU-04: Filtrar Platillos

### Descripción
El cliente filtra platillos por preferencias dietéticas.

### Actor Principal
Cliente

### Precondiciones
- Cliente está en el menú

### Flujo Principal

1. Cliente ve filtros disponibles:
   - 🌱 Vegetariano
   - 🌾 Vegano
   - 🚫 Sin Gluten
2. Cliente toca uno o más filtros
3. Sistema activa visualmente el filtro (cambio de color)
4. Sistema filtra platillos inmediatamente
5. Sistema muestra solo platillos que cumplen los filtros
6. Cliente puede activar/desactivar filtros
7. Sistema actualiza resultados dinámicamente

### Postcondiciones
- Solo se muestran platillos que cumplen los filtros activos

### Flujos Alternativos

**FA1: Sin Resultados con Filtros**
- En el paso 4:
  - Sistema no encuentra platillos con esos filtros
  - Sistema muestra: "No hay platillos disponibles con estos filtros"
  - Cliente puede quitar filtros para ver más opciones

---

## CU-05: Ver Detalles de Platillo

### Descripción
El cliente visualiza información completa de un platillo.

### Actor Principal
Cliente

### Precondiciones
- Cliente está en el menú

### Flujo Principal

1. Cliente toca un platillo
2. Sistema muestra modal/página con:
   - Imagen grande
   - Nombre completo
   - Descripción detallada
   - Precio
   - Calorías (si disponible)
   - Alérgenos (si aplica)
   - Tiempo de preparación
   - Iconos de preferencias
   - Modificadores disponibles (extras, sin ingredientes)
3. Cliente lee la información
4. Cliente puede:
   - Agregar al carrito
   - Cerrar y volver al menú

### UI/UX
```
┌─────────────────────────────┐
│ [← Volver]       [✕ Cerrar] │
├─────────────────────────────┤
│                             │
│    [Imagen Grande]          │
│                             │
│ Churrasco Argentino         │
│ ⭐⭐⭐⭐⭐ (125 reviews)      │
│                             │
│ Jugoso churrasco de res     │
│ de 300g acompañado de       │
│ papas fritas, ensalada      │
│ y chimichurri casero.       │
│                             │
│ 🔥 850 calorías             │
│ ⏱️ 25 minutos               │
│ ⚠️ Contiene: gluten         │
│                             │
│ Modificadores:              │
│ ☐ Extra chimichurri (+50)   │
│ ☐ Término medio             │
│ ☐ Sin papas                 │
│                             │
│ ┌─────────────────────┐    │
│ │ RD$ 850.00          │    │
│ │ [+ Agregar al Carrito] │  │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

---

## CU-06: Agregar al Carrito

### Descripción
El cliente agrega platillos a su carrito de compras.

### Actor Principal
Cliente

### Precondiciones
- Cliente está en el menú

### Flujo Principal

1. Cliente selecciona un platillo
2. Cliente presiona botón "Agregar"
3. Sistema agrega el platillo al carrito con cantidad 1
4. Sistema muestra notificación: "Agregado al carrito ✓"
5. Sistema actualiza contador del carrito en el header
6. Cliente puede continuar agregando más platillos

### Flujos Alternativos

**FA1: Agregar con Cantidad**
- En el paso 2:
  - Cliente especifica cantidad (2, 3, etc.)
  - Sistema agrega con la cantidad indicada

**FA2: Platillo Ya en Carrito**
- En el paso 3:
  - Sistema detecta que el platillo ya existe
  - Sistema incrementa la cantidad
  - Sistema muestra: "Cantidad actualizada"

### Postcondiciones
- Platillo está en el carrito
- Contador del carrito muestra el total de items

### Reglas de Negocio
- RN-07: Cantidad mínima: 1
- RN-08: Cantidad máxima: 10 por platillo
- RN-09: Carrito se mantiene hasta completar orden

---

## CU-07: Modificar Carrito

### Descripción
El cliente modifica las cantidades o elimina items de su carrito.

### Actor Principal
Cliente

### Precondiciones
- Cliente tiene items en el carrito

### Flujo Principal

1. Cliente toca el icono del carrito
2. Sistema muestra página del carrito con:
   - Lista de items
   - Cantidad de cada item
   - Precio unitario
   - Subtotal por item
   - Controles para modificar cantidad
3. Cliente puede:
   - Aumentar cantidad (+)
   - Disminuir cantidad (-)
   - Eliminar item (🗑️)
   - Agregar notas especiales
4. Sistema actualiza totales en tiempo real
5. Cliente revisa los cambios

### Flujos Alternativos

**FA1: Eliminar Último Item**
- En el paso 3:
  - Cliente elimina el último item
  - Sistema muestra: "Tu carrito está vacío"
  - Sistema sugiere: "Explora el menú"

**FA2: Cantidad Cero**
- En el paso 3:
  - Cliente reduce cantidad a 0
  - Sistema elimina el item automáticamente

### UI/UX
```
┌─────────────────────────────┐
│ [← Menú]        Mi Carrito  │
├─────────────────────────────┤
│                             │
│ Mesa 1 • Terraza            │
│                             │
│ ┌─────────────────────┐    │
│ │ Ensalada César      │    │
│ │ RD$ 350.00          │    │
│ │ [-] 2 [+]  [🗑️]     │    │
│ │ Subtotal: RD$ 700   │    │
│ │                     │    │
│ │ [✏️ Notas especiales] │   │
│ └─────────────────────┘    │
│                             │
│ ┌─────────────────────┐    │
│ │ Churrasco          │    │
│ │ RD$ 850.00          │    │
│ │ [-] 1 [+]  [🗑️]     │    │
│ │ Subtotal: RD$ 850   │    │
│ └─────────────────────┘    │
│                             │
│ ────────────────────────    │
│ Subtotal:    RD$ 1,550.00   │
│ ITBIS (18%): RD$ 279.00     │
│ ────────────────────────    │
│ Total:       RD$ 1,829.00   │
│                             │
│ ┌─────────────────────┐    │
│ │  Confirmar Orden    │    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

---

## CU-08: Realizar Pedido

### Descripción
El cliente confirma y envía su pedido a la cocina.

### Actor Principal
Cliente

### Precondiciones
- Cliente tiene al menos un item en el carrito

### Flujo Principal

1. Cliente revisa su carrito
2. Cliente opcionalmente agrega:
   - Notas especiales por item
   - Instrucciones generales
   - Propina sugerida
3. Cliente presiona "Confirmar Orden"
4. Sistema valida:
   - Mesa está disponible
   - Items están disponibles
   - Cantidades son válidas
5. Sistema crea la orden con:
   - Número de orden único
   - Fecha y hora
   - Items del carrito
   - Totales calculados
6. Sistema guarda la orden en base de datos
7. Sistema notifica a cocina vía SignalR
8. Sistema muestra confirmación:
   - Número de orden
   - Tiempo estimado
   - Estado: "Enviado a cocina"
9. Sistema limpia el carrito
10. Cliente recibe notificación de éxito

### Postcondiciones
- Orden está creada en el sistema
- Cocina recibe notificación
- Carrito está vacío
- Cliente puede hacer seguimiento

### Flujos Alternativos

**FA1: Item No Disponible**
- En el paso 4:
  - Sistema detecta que un item no está disponible
  - Sistema muestra: "{Platillo} ya no está disponible"
  - Sistema sugiere: "¿Deseas eliminarlo?"
  - Cliente decide:
    - Eliminar item y continuar
    - Cancelar orden

**FA2: Error de Conexión**
- En el paso 6:
  - Sistema no puede conectarse al servidor
  - Sistema muestra: "Error al enviar orden. Intenta nuevamente"
  - Orden no se crea
  - Cliente puede reintentar

### Reglas de Negocio
- RN-10: Orden debe tener al menos 1 item
- RN-11: Número de orden formato: `ORD-YYYYMMDD-XXXXX`
- RN-12: ITBIS es 18% del subtotal
- RN-13: Propina es opcional (sugerencia: 10%)

### UI/UX - Confirmación
```
┌─────────────────────────────┐
│         ¡Orden Enviada!     │
│                             │
│        ✓                    │
│                             │
│ Orden #ORD-20260207-00042   │
│                             │
│ Tu orden ha sido enviada    │
│ a la cocina.                │
│                             │
│ Tiempo estimado:            │
│      25 minutos             │
│                             │
│ ┌─────────────────────┐    │
│ │ Ver Estado         │    │
│ └─────────────────────┘    │
│                             │
│ ┌─────────────────────┐    │
│ │ Hacer Otra Orden   │    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

---

## CU-09: Ver Estado de Pedido

### Descripción
El cliente verifica el estado actual de su pedido.

### Actor Principal
Cliente

### Precondiciones
- Cliente ha realizado un pedido

### Flujo Principal

1. Cliente accede a "Ver Estado" desde confirmación
2. Sistema muestra:
   - Número de orden
   - Estado actual
   - Progreso visual
   - Tiempo transcurrido
   - Tiempo estimado restante
3. Sistema actualiza estado en tiempo real vía SignalR
4. Cliente ve progreso:
   - ⏳ Pendiente
   - ✓ Confirmado
   - 👨‍🍳 Preparando
   - ✅ Listo
   - 🍽️ Servido

### Estados de Orden
- **Pending**: Recién creada
- **Confirmed**: Confirmada por cocina
- **Preparing**: En preparación
- **Ready**: Lista para servir
- **Served**: Servida al cliente

### UI/UX
```
┌─────────────────────────────┐
│ Orden #ORD-20260207-00042   │
├─────────────────────────────┤
│                             │
│ ○───●───●───○───○           │
│                             │
│ Recibida  Confirmada        │
│         Preparando          │
│                 Lista       │
│                     Servida │
│                             │
│ Estado Actual:              │
│ 👨‍🍳 Preparando en cocina    │
│                             │
│ Tiempo transcurrido: 8 min  │
│ Tiempo estimado: 17 min más │
│                             │
│ Tus Platillos:              │
│                             │
│ ✅ Ensalada César (2)       │
│    Estado: Lista            │
│                             │
│ 👨‍🍳 Churrasco (1)           │
│    Estado: Preparando       │
│                             │
│ [🔄 Actualizar Estado]      │
└─────────────────────────────┘
```

---

## CU-10: Pagar Cuenta

### Descripción
El cliente procede a pagar su cuenta.

### Actor Principal
Cliente

### Precondiciones
- Cliente tiene una orden servida

### Flujo Principal

1. Cliente solicita la cuenta
2. Sistema muestra resumen:
   - Items consumidos
   - Subtotal
   - ITBIS (18%)
   - Propina (opcional)
   - Total
3. Cliente selecciona método de pago:
   - Efectivo
   - Tarjeta
   - Transferencia
   - Pago digital (Stripe)
4. Cliente confirma pago
5. Sistema procesa según método elegido
6. Sistema actualiza orden a "Completed"
7. Sistema genera factura electrónica (si aplica DGII)
8. Sistema muestra confirmación de pago
9. Sistema envía recibo por email (opcional)

### Postcondiciones
- Orden está pagada
- Factura generada
- Mesa queda disponible

### Flujos Alternativos

**FA1: División de Cuenta**
- En el paso 2:
  - Cliente solicita dividir cuenta
  - Sistema muestra opciones:
    - Por partes iguales
    - Por items
    - Por porcentaje
  - Cada persona paga su parte

**FA2: Aplicar Descuento**
- En el paso 2:
  - Cliente tiene código de descuento
  - Sistema valida código
  - Sistema aplica descuento
  - Sistema recalcula total

### Reglas de Negocio
- RN-14: ITBIS (18%) es obligatorio
- RN-15: Propina es opcional (sugerencia 10%)
- RN-16: Descuentos se aplican antes de impuestos
- RN-17: Factura DGII si RNC proporcionado

---

## ✅ RESUMEN DE CASOS DE USO

| ID | Caso de Uso | Estado | Prioridad |
|----|-------------|--------|-----------|
| CU-01 | Escanear QR y Acceder | ✅ Implementado | Alta |
| CU-02 | Explorar Menú | ✅ Implementado | Alta |
| CU-03 | Buscar Platillos | ✅ Implementado | Media |
| CU-04 | Filtrar Platillos | ✅ Implementado | Media |
| CU-05 | Ver Detalles | ⚠️ Parcial | Media |
| CU-06 | Agregar al Carrito | ✅ Implementado | Alta |
| CU-07 | Modificar Carrito | ✅ Implementado | Alta |
| CU-08 | Realizar Pedido | ✅ Implementado | Alta |
| CU-09 | Ver Estado | ⚠️ Parcial | Media |
| CU-10 | Pagar Cuenta | ❌ Pendiente | Alta |

---

**Última Actualización:** 7 de Febrero de 2026  
**Estado:** ✅ Documentación Completa
