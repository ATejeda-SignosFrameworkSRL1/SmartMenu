# 🏢 FLUJO OPERATIVO COMPLETO DEL RESTAURANTE

## **👥 ROLES DEL SISTEMA**

### **1. Host/Hostess (Recepcionista)**
- Asigna mesas a clientes
- Gestiona reservas
- Controla aforo del restaurante
- Activa/desactiva mesas en el sistema

### **2. Mesero/Camarero**
- Atiende dudas de clientes
- Asiste con el menú digital
- Lleva los platillos
- Gestiona solicitudes especiales
- Cierra cuentas (opcional)

### **3. Cocina (Chef/Cocineros)**
- Recibe pedidos en KDS (Kitchen Display System)
- Prepara platillos según prioridad
- Marca platillos como listos
- Gestiona tiempos de preparación

### **4. Bar/Bartender**
- Recibe pedidos de bebidas
- Prepara cócteles y bebidas
- Marca bebidas como listas

### **5. Runner (Despachador)**
- Recoge platillos listos
- Lleva alimentos a las mesas
- Verifica que todo esté correcto

### **6. Cajero**
- Supervisa pagos
- Gestiona efectivo
- Emite facturas
- Cierre de caja

### **7. Gerente/Administrador**
- Supervisa operaciones
- Accede a reportes en tiempo real
- Gestiona menú y precios
- Controla inventario

---

## **🔄 FLUJO OPERATIVO DETALLADO**

### **📍 FASE 1: LLEGADA Y ASIGNACIÓN**

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE LLEGA AL RESTAURANTE                       │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  HOST/HOSTESS                                       │
├─────────────────────────────────────────────────────┤
│  1. Verifica disponibilidad en panel               │
│  2. Consulta mapa de mesas en tiempo real          │
│  3. Asigna mesa según:                             │
│     - Número de personas                            │
│     - Zona preferida                                │
│     - Disponibilidad                                │
│  4. Activa mesa en el sistema                      │
│  5. Mesa queda "OCUPADA" con timer                 │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  SISTEMA                                            │
├─────────────────────────────────────────────────────┤
│  • Genera sesión única para la mesa                │
│  • QR Code se activa                               │
│  • Notifica a mesero asignado a esa zona           │
└─────────────────────────────────────────────────────┘
```

---

### **📱 FASE 2: INTERACCIÓN CON MENÚ**

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE                                            │
├─────────────────────────────────────────────────────┤
│  1. Escanea QR de la mesa                          │
│  2. Accede al menú digital                         │
│  3. Navega por categorías                          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  MESERO (Rol de Asistencia)                        │
├─────────────────────────────────────────────────────┤
│  • Recibe notificación: "Mesa 12 activa"          │
│  • Se acerca a dar bienvenida                      │
│  • Ofrece ayuda con el menú digital               │
│  • Explica funcionamiento si es necesario          │
│  • Responde dudas sobre platillos                  │
│  • Registra alergias/restricciones en el sistema   │
└─────────────────────────────────────────────────────┘
```

---

### **🛒 FASE 3: REALIZACIÓN DEL PEDIDO**

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE                                            │
├─────────────────────────────────────────────────────┤
│  1. Selecciona platillos                           │
│  2. Personaliza (sin cebolla, término, etc.)       │
│  3. Agrega notas especiales                        │
│  4. Confirma pedido                                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  SISTEMA (Routing inteligente)                     │
├─────────────────────────────────────────────────────┤
│  Divide el pedido automáticamente:                 │
│                                                     │
│  ├─► COCINA                                        │
│  │   • Entradas                                    │
│  │   • Platos fuertes                             │
│  │   • Guarniciones                               │
│  │                                                 │
│  ├─► BAR                                           │
│  │   • Bebidas alcohólicas                        │
│  │   • Cócteles                                   │
│  │   • Jugos frescos                              │
│  │                                                 │
│  └─► ESTACIÓN DE BEBIDAS                          │
│      • Refrescos                                   │
│      • Aguas                                       │
│      • Café                                        │
│                                                     │
│  Registra:                                         │
│  • Hora exacta del pedido                          │
│  • Mesa origen                                     │
│  • Prioridad (según tiempo de espera)             │
│  • Alergias/restricciones                         │
└─────────────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
```

---

### **👨‍🍳 FASE 4: PREPARACIÓN EN COCINA**

```
┌─────────────────────────────────────────────────────┐
│  KDS - KITCHEN DISPLAY SYSTEM (Pantalla Cocina)    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Mesa 12     │  │ Mesa 05     │  │ Mesa 18    │ │
│  │ ⏱️ 00:03:45 │  │ ⏱️ 00:15:22 │  │ ⏱️ 00:08:10│ │
│  │ ⚠️ URGENTE  │  │ 🔴 RETRASADO│  │ 🟢 NORMAL  │ │
│  ├─────────────┤  ├─────────────┤  ├────────────┤ │
│  │ 2x Burger   │  │ 1x Salmon   │  │ 3x Tacos   │ │
│  │ • Sin cebolla│  │ 1x Pasta    │  │ 1x Ensalada│ │
│  │ 1x Steak    │  │ 🌾 SIN GLUTEN│  │            │ │
│  │ • Término 3/4│  │             │  │            │ │
│  │ 🥜 ALERGIA  │  │             │  │            │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### **Proceso en Cocina:**

```
┌─────────────────────────────────────────────────────┐
│  CHEF/EXPO (Expeditor)                              │
├─────────────────────────────────────────────────────┤
│  1. Recibe pedido en KDS                           │
│  2. Analiza y distribuye tareas:                   │
│     • Estación de parrilla                         │
│     • Estación de frituras                         │
│     • Estación de ensaladas                        │
│  3. Coordina tiempos de cocción                    │
│  4. Prioriza según:                                │
│     - Tiempo de espera                             │
│     - Tipo de platillo                             │
│     - Complejidad                                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  COCINEROS (Por estación)                          │
├─────────────────────────────────────────────────────┤
│  • Leen el ticket en su pantalla                   │
│  • Ven notas especiales en grande                  │
│  • Alertas visuales para alergias                  │
│  • Preparan platillo                               │
│  • Cuando terminan: presionan "LISTO" en pantalla │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  SISTEMA                                            │
├─────────────────────────────────────────────────────┤
│  • Marca platillo como completado                  │
│  • Calcula tiempo de preparación real              │
│  • Notifica a RUNNER y MESERO                      │
│  • Si todos los platillos de mesa están listos:   │
│    → Notificación prioritaria                      │
└─────────────────────────────────────────────────────┘
```

---

### **🍹 FASE 4B: PREPARACIÓN EN BAR (Paralelo)**

```
┌─────────────────────────────────────────────────────┐
│  PANTALLA DEL BAR                                   │
├─────────────────────────────────────────────────────┤
│  Mesa 12: 2x Margarita, 1x Cerveza, 1x Limonada   │
│  Mesa 05: 3x Mojito                                │
│  Mesa 18: 2x Vino tinto                            │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  BARTENDER                                          │
├─────────────────────────────────────────────────────┤
│  1. Prepara bebidas según orden de llegada         │
│  2. Las bebidas se sirven ANTES que la comida      │
│  3. Marca como "LISTO" al terminar                 │
│  4. Notifica a RUNNER o MESERO                     │
└─────────────────────────────────────────────────────┘
```

---

### **🏃 FASE 5: DESPACHO Y ENTREGA**

```
┌─────────────────────────────────────────────────────┐
│  RUNNER/MESERO                                      │
├─────────────────────────────────────────────────────┤
│  Recibe notificación en tablet/smartphone:         │
│                                                     │
│  🔔 "Mesa 12 - 2 platillos listos"                │
│     • Hamburguesa sin cebolla                      │
│     • Steak 3/4                                    │
│                                                     │
│  Pasos:                                            │
│  1. Va a ventana de cocina/pass                    │
│  2. Verifica orden visual en KDS                   │
│  3. Toma platillos (con número de mesa visible)   │
│  4. Verifica contra pedido en su dispositivo       │
│  5. Lleva a mesa 12                                │
│  6. Confirma con cliente                           │
│  7. Marca en sistema: "ENTREGADO"                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  SISTEMA                                            │
├─────────────────────────────────────────────────────┤
│  • Actualiza estado a "EN MESA"                    │
│  • Inicia timer de satisfacción                    │
│  • Envía notificación al cliente:                  │
│    "¿Cómo está todo? 😊"                           │
└─────────────────────────────────────────────────────┘
```

---

### **🍽️ FASE 6: CONSUMO Y PEDIDOS ADICIONALES**

```
┌─────────────────────────────────────────────────────┐
│  DURANTE EL CONSUMO                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CLIENTE puede:                                     │
│  • Hacer pedidos adicionales desde el menú         │
│  • Solicitar condimentos                           │
│  • Llamar al mesero (botón en app)                │
│  • Ver su cuenta en tiempo real                    │
│                                                     │
│  MESERO recibe alertas:                            │
│  • "Mesa 12 solicita atención" 🔔                  │
│  • "Mesa 12 nuevo pedido: 1x Postre"              │
│  • Revisa estado de mesas en su zona              │
│                                                     │
│  GERENTE ve dashboard:                             │
│  • Mesas ocupadas: 24/30                          │
│  • Tiempo promedio: 45 min                        │
│  • Pedidos activos en cocina: 8                   │
│  • Alertas de mesas con >60 min                   │
└─────────────────────────────────────────────────────┘
```

---

### **💳 FASE 7: CIERRE Y PAGO**

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE                                            │
├─────────────────────────────────────────────────────┤
│  Opción A: Pago desde App                          │
│  1. Presiona "Solicitar cuenta"                    │
│  2. Ve resumen detallado                           │
│  3. Selecciona método de pago                      │
│  4. Agrega propina (10%, 15%, 20%, custom)        │
│  5. Paga directamente                              │
│  6. Recibe ticket digital                          │
│                                                     │
│  Opción B: Pago tradicional                        │
│  1. Presiona "Llamar para pagar"                   │
│  2. Mesero trae terminal                           │
│  3. Procesa pago                                   │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  MESERO/CAJERO                                      │
├─────────────────────────────────────────────────────┤
│  • Recibe notificación de pago completado          │
│  • Verifica en el sistema                          │
│  • Agradece y despide al cliente                   │
│  • Marca mesa como "LISTA PARA LIMPIAR"           │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  SISTEMA                                            │
├─────────────────────────────────────────────────────┤
│  Automáticamente:                                   │
│  • Cierra la sesión de la mesa                     │
│  • Genera reporte de la venta                      │
│  • Actualiza inventario                            │
│  • Registra propina para mesero                    │
│  • Calcula métricas (tiempo total, ticket prom.)  │
│  • Envía email con factura (si aplica)            │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  PERSONAL DE LIMPIEZA/MESERO                        │
├─────────────────────────────────────────────────────┤
│  • Recibe notificación: "Mesa 12 libre"           │
│  • Limpia y prepara mesa                           │
│  • Marca en sistema: "DISPONIBLE"                  │
│  • Mesa aparece verde en panel del host            │
└─────────────────────────────────────────────────────┘
```

---

## **📊 PANEL DE CONTROL EN TIEMPO REAL**

### **Dashboard del Gerente:**

```
┌─────────────────────────────────────────────────────┐
│  📊 VISTA GENERAL - Restaurante "La Buena Mesa"    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🟢 Mesas Disponibles: 6                           │
│  🟡 Mesas Ocupadas: 24                             │
│  🔴 Mesas por limpiar: 2                           │
│  ⚪ Reservadas: 3                                   │
│                                                     │
│  👨‍🍳 Cocina: 8 pedidos activos                     │
│  🍹 Bar: 3 pedidos activos                         │
│  ⏱️ Tiempo promedio de mesa: 42 min               │
│  💰 Ventas del día: $12,450                        │
│  📈 Ticket promedio: $285                          │
│                                                     │
│  ⚠️ ALERTAS:                                       │
│  • Mesa 15: >60 min (verificar satisfacción)      │
│  • Cocina: Ensalada César bajo inventario         │
│  • Mesa 8: Esperando platillo 18 min              │
└─────────────────────────────────────────────────────┘
```

---

## **🔄 FLUJO DE COMUNICACIÓN**

```
        CLIENTE
           ↕️ (App/QR)
        SISTEMA
           ↕️
     ┌─────┴──────┐
     ↓            ↓
  MESERO      COCINA/BAR
     ↕️            ↕️
  RUNNER ←─────→ KDS
     ↓
  CLIENTE
```

---

## **⚡ NOTIFICACIONES EN TIEMPO REAL**

### **Para Meseros:**
- 🔔 Nueva mesa asignada
- 🔔 Cliente solicita atención
- 🔔 Pedido listo para servir
- 🔔 Cliente solicita cuenta
- ⚠️ Mesa con >60 min

### **Para Cocina:**
- 🔔 Nuevo pedido recibido
- ⚠️ Pedido con >15 min
- 🔴 Pedido urgente/prioritario
- 🌾 Alerta de alérgenos

### **Para Gerente:**
- 📊 Alertas de tiempo excesivo
- 📉 Bajo inventario
- 💰 Ventas por hora
- ⚠️ Problemas operativos

---

## **🎯 MÉTRICAS CLAVE (KPIs)**

### **Eficiencia Operativa:**
- Tiempo promedio por mesa
- Rotación de mesas por día
- Tiempo de preparación por platillo
- Tiempo desde pedido hasta entrega

### **Satisfacción del Cliente:**
- Rating promedio
- Tiempo de espera percibido
- Quejas/reclamaciones
- Clientes recurrentes

### **Financieras:**
- Ticket promedio
- Ventas por hora/día/semana
- Margen por platillo
- Propinas promedio

### **Cocina:**
- Tiempo promedio de preparación
- Pedidos completados vs. rechazados
- Eficiencia por estación
- Desperdicio de alimentos

---

## **🚨 GESTIÓN DE SITUACIONES ESPECIALES**

### **1. Mesa sin QR funcional:**
- Mesero puede activar manualmente
- Cliente accede por link directo
- Sistema genera código temporal

### **2. Cliente sin smartphone:**
- Mesero toma pedido en su tablet
- Ingresa directamente al sistema
- Flujo continúa normal

### **3. Pedido retrasado:**
- Sistema alerta automáticamente
- Gerente recibe notificación
- Mesero ofrece compensación (bebida gratis)

### **4. Error en pedido:**
- Cliente reporta problema desde app
- Mesero recibe alerta inmediata
- Cocina prepara reemplazo con prioridad
- Sistema registra para analytics

### **5. División de cuenta:**
- Clientes pueden dividir desde app
- Por persona o por items
- Cada uno paga su parte
- Sistema reconcilia automáticamente

---

## **📱 INTERFACES POR ROL**

### **Host/Hostess - Tablet/PC:**
- Mapa visual de mesas
- Lista de reservas
- Control de aforo
- Asignación rápida

### **Mesero - Smartphone/Tablet:**
- Lista de mesas asignadas
- Notificaciones en tiempo real
- Toma de pedidos manual (backup)
- Estado de pedidos

### **Cocina - Pantalla grande (KDS):**
- Pedidos en cola
- Timers por platillo
- Alertas visuales
- Control táctil

### **Bar - Tablet/Pantalla:**
- Cola de bebidas
- Recetas rápidas
- Inventario de bar
- Timers

### **Gerente - PC/Tablet:**
- Dashboard completo
- Reportes en tiempo real
- Control total del sistema
- Analytics avanzados

---

## **📄 DOCUMENTOS RELACIONADOS**

- [Resumen Ejecutivo Smart Menu](./01-RESUMEN-EJECUTIVO-SMART-MENU.md)
- Arquitectura Técnica (Próximamente)
- Modelo de Base de Datos (Próximamente)
- Casos de Uso Detallados (Próximamente)

---

**Fecha de Creación:** 6 de Febrero, 2026
**Versión:** 1.0
**Autor:** Smart Menu Team
