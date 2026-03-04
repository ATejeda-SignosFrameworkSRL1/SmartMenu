# 👤 USER JOURNEY COMPLETO - SMART MENU

## **📋 ÍNDICE DE USER JOURNEYS**

1. [Cliente - Escanea QR y Hace Pedido](#1-cliente-escanea-qr-y-hace-pedido)
2. [Cliente - Realiza Pago](#2-cliente-realiza-pago)
3. [Mesero - Atiende Mesa](#3-mesero-atiende-mesa)
4. [Cocina - Prepara Pedido](#4-cocina-prepara-pedido)
5. [Host - Asigna Mesa](#5-host-asigna-mesa)
6. [Administrador - Gestiona Menú](#6-administrador-gestiona-menú)
7. [Gerente - Revisa Analytics](#7-gerente-revisa-analytics)

---

## **1. CLIENTE - ESCANEA QR Y HACE PEDIDO**

### **👤 Persona**
- **Nombre:** María González
- **Edad:** 32 años
- **Contexto:** Llega al restaurante con 2 amigos para cenar
- **Dispositivo:** iPhone 14 Pro
- **Experiencia técnica:** Media-Alta

### **🎯 Objetivo**
Ver el menú y hacer un pedido sin esperar al mesero

---

### **📍 JOURNEY PASO A PASO**

#### **FASE 1: LLEGADA Y ACCESO**

**Paso 1.1: Llegada al Restaurante**
```
⏱️ Tiempo: 0 min
📍 Ubicación: Entrada del restaurante

🎬 Acción del Usuario:
- María y sus amigos llegan al restaurante
- Son recibidos por el host/hostess

💭 Pensamiento:
"Espero que no tengamos que esperar mucho por una mesa"

📱 Pantalla: N/A
```

**Paso 1.2: Asignación de Mesa**
```
⏱️ Tiempo: 1 min
📍 Ubicación: Recepción

🎬 Acción del Host:
- Host consulta disponibilidad en su tablet
- Asigna mesa #12 en la terraza
- Activa la mesa en el sistema

💭 Pensamiento del Host:
"Terraza está disponible y el clima está perfecto"

📱 Pantalla (Host):
┌─────────────────────────────────────┐
│ 🏠 Vista de Mesas                   │
├─────────────────────────────────────┤
│                                     │
│  Terraza (6/8 ocupadas)            │
│                                     │
│  🟢 Mesa 12  [4 personas]          │
│  🔴 Mesa 13  [Ocupada]             │
│  🟢 Mesa 14  [2 personas]          │
│                                     │
│  [Asignar Mesa 12]                 │
│  Personas: 3 ▼                      │
│  Mesero: Carlos Ruiz ▼             │
│                                     │
│  ✅ Confirmar Asignación            │
└─────────────────────────────────────┘

🔄 Sistema:
- Genera sessionId único: "abc123xyz"
- Activa QR code de la mesa 12
- Notifica a mesero Carlos
- Estado mesa: "OCCUPIED"
```

**Paso 1.3: Sentarse en la Mesa**
```
⏱️ Tiempo: 2 min
📍 Ubicación: Mesa 12, Terraza

🎬 Acción del Usuario:
- María y sus amigos se sientan
- Ven el código QR en el centro de la mesa
- El QR está en un display acrílico elegante

💭 Pensamiento:
"Oh, tienen menú digital. Qué conveniente."

📸 Elemento Visual:
┌─────────────────────┐
│                     │
│   [QR CODE]         │
│                     │
│  ESCANEA PARA       │
│  VER EL MENÚ        │
│                     │
│  Mesa 12            │
└─────────────────────┘
```

**Paso 1.4: Escanear QR Code**
```
⏱️ Tiempo: 2 min 10 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- María saca su iPhone
- Abre la cámara
- Escanea el código QR

💭 Pensamiento:
"Espero que funcione rápido"

📱 Cámara iPhone:
┌─────────────────────────────────────┐
│ 📷 Cámara                           │
│                                     │
│      [Enfocando QR]                 │
│                                     │
│  🔍 Código detectado                │
│  "smartmenu.app/t/12/s/abc123xyz"  │
│                                     │
│  Toca para abrir en Safari          │
└─────────────────────────────────────┘

🔗 URL:
https://smartmenu.app/table/12/session/abc123xyz
```

---

#### **FASE 2: CARGA Y BIENVENIDA**

**Paso 2.1: Carga de la Aplicación**
```
⏱️ Tiempo: 2 min 12 seg
📍 Ubicación: Mesa 12

🎬 Acción del Sistema:
- Se abre el navegador
- Carga la PWA
- Muestra splash screen

💭 Pensamiento:
"Está cargando... espero que no tarde"

📱 Pantalla:
┌─────────────────────────────────────┐
│                                     │
│          🍽️ SmartMenu              │
│                                     │
│      [Animación de carga]           │
│                                     │
│     Cargando tu menú...             │
│                                     │
└─────────────────────────────────────┘

⚙️ Background:
GET /api/tables/12/session?sessionId=abc123xyz
Response: { 
  tableNumber: "12", 
  sessionId: "abc123xyz",
  status: "active",
  waiter: { name: "Carlos Ruiz" }
}

GET /api/menu
Response: { categories: [...], dishes: [...] }
```

**Paso 2.2: Pantalla de Bienvenida**
```
⏱️ Tiempo: 2 min 15 seg
📍 Ubicación: Mesa 12

🎬 Acción del Sistema:
- Muestra pantalla de bienvenida personalizada
- Confirma mesa y sesión

💭 Pensamiento:
"Genial, ya estoy adentro. Qué rápido."

📱 Pantalla:
┌─────────────────────────────────────┐
│ 👋 ¡Bienvenidos!                    │
├─────────────────────────────────────┤
│                                     │
│  📍 Mesa 12 - Terraza               │
│  👨‍🍳 Tu mesero: Carlos Ruiz         │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Navega por nuestro menú, agrega   │
│  platillos a tu carrito y ordena    │
│  cuando estés listo. 🍽️             │
│                                     │
│  [Ver Menú]                         │
│                                     │
│  ⚠️ ¿Tienes alguna alergia?         │
│  [Configurar Restricciones]         │
│                                     │
└─────────────────────────────────────┘

⏱️ Duración: 3 segundos (auto-avanza)
```

---

#### **FASE 3: NAVEGACIÓN DEL MENÚ**

**Paso 3.1: Vista Principal del Menú**
```
⏱️ Tiempo: 2 min 18 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Ve las categorías del menú
- Scroll vertical para explorar

💭 Pensamiento:
"Wow, las fotos se ven deliciosas. Me gusta que tenga filtros."

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ SmartMenu   🛒(0)  👤  Mesa 12   │
├─────────────────────────────────────┤
│ 🔍 Buscar platillos...              │
├─────────────────────────────────────┤
│ Filtros: [🌱] [🌾] [🌶️] [⭐]         │
├─────────────────────────────────────┤
│                                     │
│ 🍕 Entradas                         │
│ ┌─────────────────────────────┐    │
│ │ [Imagen: Guacamole]         │    │
│ │ Guacamole Clásico       $85 │    │
│ │ ⭐ 4.8 • 🌱 Vegetariano     │    │
│ │ 🌶️🌶️ Picante               │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ [Imagen: Alitas]            │    │
│ │ Alitas BBQ              $120 │    │
│ │ ⭐ 4.9 • ⏱️ 15 min          │    │
│ └─────────────────────────────┘    │
│                                     │
│ 🥩 Platos Fuertes                   │
│ 🍰 Postres                          │
│ 🍹 Bebidas                          │
│                                     │
└─────────────────────────────────────┘
  ↓ Scroll para ver más
```

**Paso 3.2: Explorar Categoría**
```
⏱️ Tiempo: 2 min 30 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Toca en "Platos Fuertes"
- Navega por los platillos

💭 Pensamiento:
"Voy a ver qué tienen de platos fuertes"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Platos Fuertes  🛒(0)  Mesa 12   │
├─────────────────────────────────────┤
│ 🔍 Buscar en esta categoría...      │
├─────────────────────────────────────┤
│ Ordenar: [Popularidad ▼]            │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────┐    │
│ │ [Imagen HD: Ribeye Steak]   │    │
│ │                             │    │
│ │ Ribeye Premium 400g         │    │
│ │ $385                        │    │
│ │ ⭐ 4.9 (127 reseñas)        │    │
│ │ ⏱️ 20-25 min                │    │
│ │                             │    │
│ │ Con papas y ensalada        │    │
│ │                             │    │
│ │ 🔥 LO MÁS PEDIDO            │    │
│ │                             │    │
│ │ [Ver Detalles]              │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ [Imagen: Salmon]            │    │
│ │ Salmón a la Parrilla        │    │
│ │ $295                        │    │
│ │ ⭐ 4.7 • 🌾 Sin Gluten      │    │
│ └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Paso 3.3: Ver Detalle del Platillo**
```
⏱️ Tiempo: 2 min 45 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Toca "Ver Detalles" en el Ribeye
- Se abre modal con información completa

💭 Pensamiento:
"Se ve increíble. Déjame ver qué incluye."

📱 Pantalla (Modal):
┌─────────────────────────────────────┐
│ ✕                              🛒(0) │
│                                     │
│ [Galería: 3 imágenes HD]            │
│ ● ○ ○                               │
│                                     │
├─────────────────────────────────────┤
│ Ribeye Premium 400g                 │
│ $385                                │
│ ⭐ 4.9 (127 reseñas)                │
├─────────────────────────────────────┤
│                                     │
│ 📝 Descripción                      │
│ Corte de res premium madurado 21    │
│ días, sellado a la perfección.      │
│ Acompañado de papas al horno y      │
│ ensalada fresca.                    │
│                                     │
│ 🍴 Incluye                          │
│ • Papas al horno o papas fritas     │
│ • Ensalada de la casa               │
│ • Salsa a elegir                    │
│                                     │
│ ⏱️ Tiempo: 20-25 minutos            │
│                                     │
│ 🔥 Término de cocción               │
│ ○ Rojo  ● Medio  ○ Bien Cocido     │
│                                     │
│ 🥔 Acompañamiento                   │
│ ● Papas al horno                    │
│ ○ Papas fritas                      │
│                                     │
│ 🥗 Salsa                             │
│ ○ Chimichurri                       │
│ ● Pimienta                          │
│ ○ Champiñones                       │
│                                     │
│ 📝 Instrucciones especiales         │
│ [Sin cebolla, por favor]            │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ Cantidad: [➖] 1 [➕]                │
│                                     │
│ [Agregar al Carrito - $385]         │
│                                     │
└─────────────────────────────────────┘
```

---

#### **FASE 4: AGREGAR AL CARRITO**

**Paso 4.1: Personalizar Platillo**
```
⏱️ Tiempo: 3 min 00 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Selecciona término medio
- Elige papas al horno
- Selecciona salsa de pimienta
- Agrega nota: "Sin cebolla, por favor"
- Presiona "Agregar al Carrito"

💭 Pensamiento:
"Perfecto, así es como me gusta"

📱 Acción:
- Animación: Platillo "vuela" hacia el ícono del carrito
- Contador del carrito: (0) → (1)
- Confirmación visual

📱 Toast Notification:
┌─────────────────────────────────────┐
│ ✅ Agregado al carrito              │
│ Ribeye Premium - $385               │
└─────────────────────────────────────┘

🔄 Sistema:
- Guarda en localStorage
- Actualiza estado de Redux
```

**Paso 4.2: Continuar Comprando**
```
⏱️ Tiempo: 3 min 05 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Cierra el modal
- Vuelve a la lista de platillos
- Agrega 2 platillos más:
  • Ensalada César ($145)
  • Pasta Alfredo ($195)

💭 Pensamiento:
"Vamos a compartir varios platillos"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Platos Fuertes  🛒(3)  Mesa 12   │
│                                     │
│ [Lista de platillos...]             │
│                                     │
│ ✅ Ensalada César agregada          │
│ ✅ Pasta Alfredo agregada           │
└─────────────────────────────────────┘

🛒 Carrito actual:
1. Ribeye Premium (término medio, sin cebolla) - $385
2. Ensalada César - $145
3. Pasta Alfredo - $195
TOTAL: $725
```

**Paso 4.3: Agregar Bebidas**
```
⏱️ Tiempo: 3 min 30 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Va a la categoría "Bebidas"
- Agrega:
  • 2x Limonada Natural ($45 c/u)
  • 1x Cerveza Artesanal ($65)

💭 Pensamiento:
"Y algo para tomar"

🛒 Carrito actualizado:
Subtotal: $925
```

---

#### **FASE 5: REVISAR CARRITO**

**Paso 5.1: Abrir Carrito**
```
⏱️ Tiempo: 3 min 45 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Toca el ícono del carrito 🛒(6)
- Se abre la vista del carrito

💭 Pensamiento:
"Déjame revisar que todo esté correcto"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Tu Pedido            Mesa 12     │
├─────────────────────────────────────┤
│                                     │
│ 📦 6 items en tu carrito            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🥩 Ribeye Premium           $385│ │
│ │ Término medio, sin cebolla      │ │
│ │ [➖] 1 [➕]           🗑️         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🥗 Ensalada César           $145│ │
│ │ [➖] 1 [➕]           🗑️         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🍝 Pasta Alfredo            $195│ │
│ │ [➖] 1 [➕]           🗑️         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🍋 Limonada Natural         $90 │ │
│ │ [➖] 2 [➕]           🗑️         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🍺 Cerveza Artesanal        $65 │ │
│ │ [➖] 1 [➕]           🗑️         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 💬 Comentarios para el chef         │
│ [Opcional]                          │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ Subtotal:              $925.00      │
│ IVA (16%):             $148.00      │
│ ━━━━━━━━━━━━━━━━━━━━━              │
│ Total:               $1,073.00      │
│                                     │
│ [Continuar Comprando]               │
│ [Confirmar Pedido]                  │
│                                     │
└─────────────────────────────────────┘
```

**Paso 5.2: Confirmar Pedido**
```
⏱️ Tiempo: 4 min 00 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Revisa el pedido
- Presiona "Confirmar Pedido"
- Aparece modal de confirmación

💭 Pensamiento:
"Todo está perfecto, vamos a ordenar"

📱 Modal:
┌─────────────────────────────────────┐
│ 🍽️ Confirmar Pedido                 │
├─────────────────────────────────────┤
│                                     │
│ Mesa 12 - Terraza                   │
│                                     │
│ Total: $1,073.00                    │
│ 6 items                             │
│                                     │
│ ⏱️ Tiempo estimado: 25-30 min       │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ ¿Confirmar tu pedido?               │
│                                     │
│ Tu orden será enviada directamente  │
│ a la cocina. Recibirás             │
│ notificaciones del estado.          │
│                                     │
│ [Cancelar]    [Sí, Confirmar]       │
│                                     │
└─────────────────────────────────────┘
```

---

#### **FASE 6: PROCESAMIENTO DEL PEDIDO**

**Paso 6.1: Pedido Enviado**
```
⏱️ Tiempo: 4 min 02 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Presiona "Sí, Confirmar"
- Animación de envío

💭 Pensamiento:
"Listo, ya está ordenado"

📱 Pantalla (Loading):
┌─────────────────────────────────────┐
│                                     │
│          [Animación]                │
│     Enviando tu pedido...           │
│                                     │
└─────────────────────────────────────┘

🔄 Sistema (Backend):
POST /api/orders
{
  "tableId": 12,
  "sessionId": "abc123xyz",
  "items": [...],
  "subtotal": 925.00,
  "tax": 148.00,
  "total": 1073.00
}

⚙️ Procesamiento:
1. Validar items contra menú
2. Verificar disponibilidad
3. Calcular precios
4. Crear orden en DB
5. Emitir eventos SignalR:
   - "OrderCreated" → Cocina
   - "OrderCreated" → Mesero Carlos
   - "OrderCreated" → Cliente
6. Actualizar inventario
7. Registrar analytics
```

**Paso 6.2: Confirmación Exitosa**
```
⏱️ Tiempo: 4 min 05 seg
📍 Ubicación: Mesa 12

🎬 Respuesta del Sistema:
- Orden creada exitosamente
- Order #2345
- Muestra pantalla de confirmación

💭 Pensamiento:
"¡Perfecto! Ahora a esperar"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ✅ ¡Pedido Confirmado!               │
├─────────────────────────────────────┤
│                                     │
│          [Ícono éxito]              │
│                                     │
│ Orden #2345                         │
│ Mesa 12 - Terraza                   │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ ⏱️ Tiempo estimado                  │
│ 25-30 minutos                       │
│                                     │
│ 📊 Estado actual                    │
│ ● Confirmado                        │
│ ○ En preparación                    │
│ ○ Listo                             │
│ ○ Servido                           │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ Te notificaremos cuando tu pedido   │
│ esté listo. Mientras tanto, puedes │
│ seguir navegando el menú.           │
│                                     │
│ [Ver Estado del Pedido]             │
│ [Agregar Más Items]                 │
│ [Volver al Menú]                    │
│                                     │
└─────────────────────────────────────┘

🔔 Notificación Push:
"✅ Pedido confirmado - Orden #2345"
```

---

#### **FASE 7: TRACKING EN TIEMPO REAL**

**Paso 7.1: Cocina Recibe el Pedido**
```
⏱️ Tiempo: 4 min 05 seg
📍 Ubicación: Cocina

🎬 Acción Automática:
- KDS muestra nueva orden
- Suena alerta en cocina

📱 Pantalla KDS:
┌─────────────────────────────────────┐
│ 🔔 NUEVA ORDEN #2345                │
├─────────────────────────────────────┤
│                                     │
│ Mesa 12 - Terraza                   │
│ ⏱️ 00:00:15  🟡 NORMAL              │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 1x Ribeye Premium                   │
│    • Término medio                  │
│    • Sin cebolla                    │
│    → Estación: PARRILLA             │
│                                     │
│ 1x Ensalada César                   │
│    → Estación: FRÍOS                │
│                                     │
│ 1x Pasta Alfredo                    │
│    → Estación: CALIENTES            │
│                                     │
│ 2x Limonada Natural                 │
│ 1x Cerveza Artesanal                │
│    → Estación: BAR                  │
│                                     │
│ [Aceptar Orden]   [Rechazar]        │
│                                     │
└─────────────────────────────────────┘
```

**Paso 7.2: Chef Acepta la Orden**
```
⏱️ Tiempo: 4 min 20 seg
📍 Ubicación: Cocina

🎬 Acción del Chef:
- Chef presiona "Aceptar Orden"
- Sistema marca como "EN PREPARACIÓN"

🔄 Sistema:
SignalR Event: "OrderStatusChanged"
{
  orderId: 2345,
  status: "PREPARING",
  timestamp: "2026-02-06T19:04:20Z"
}

📱 Notificación Cliente (María):
┌─────────────────────────────────────┐
│ 👨‍🍳 Tu pedido está siendo preparado  │
│ Orden #2345 • Mesa 12               │
└─────────────────────────────────────┘
```

**Paso 7.3: Cliente Monitorea el Progreso**
```
⏱️ Tiempo: 4 min 25 seg
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- María toca "Ver Estado del Pedido"
- Ve el progreso en tiempo real

💭 Pensamiento:
"Qué cool que puedo ver el progreso"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Estado del Pedido                │
├─────────────────────────────────────┤
│                                     │
│ Orden #2345 • Mesa 12               │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ ✅ Confirmado                        │
│ ⏱️ 19:04 PM                          │
│                                     │
│ 🔄 En preparación                   │
│ ⏱️ 19:04 PM  ⏱️ 00:04:25            │
│                                     │
│ ○ Listo para servir                 │
│                                     │
│ ○ Servido                           │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 👨‍🍳 Tu comida se está preparando    │
│                                     │
│ Tiempo estimado: 25 minutos         │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 📦 Items de tu orden:               │
│                                     │
│ 🥩 Ribeye Premium                   │
│    🔄 En preparación                │
│                                     │
│ 🥗 Ensalada César                   │
│    🔄 En preparación                │
│                                     │
│ 🍝 Pasta Alfredo                    │
│    🔄 En preparación                │
│                                     │
│ 🍋 Limonada x2, 🍺 Cerveza x1      │
│    ✅ Listas                         │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 💬 ¿Necesitas algo más?             │
│ [Llamar al Mesero]                  │
│                                     │
└─────────────────────────────────────┘

🔄 Actualización en tiempo real:
Cada cambio de estado se refleja automáticamente
vía SignalR
```

---

#### **FASE 8: PEDIDO LISTO**

**Paso 8.1: Cocina Marca Platillos como Listos**
```
⏱️ Tiempo: 19 min 30 seg
📍 Ubicación: Cocina

🎬 Acción del Chef:
- Todos los platillos terminados
- Chef presiona "LISTO" en el KDS

🔄 Sistema:
SignalR Event: "OrderReady"
{
  orderId: 2345,
  tableId: 12,
  items: [...]
}

📱 Notificaciones:
→ Cliente María: "¡Tu pedido está listo!"
→ Mesero Carlos: "Mesa 12 - Pedido listo para servir"
```

**Paso 8.2: Cliente Recibe Notificación**
```
⏱️ Tiempo: 19 min 31 seg
📍 Ubicación: Mesa 12

🎬 Acción del Sistema:
- Push notification
- Actualización en pantalla

💭 Pensamiento:
"¡Genial! Ya está listo"

📱 Notificación:
┌─────────────────────────────────────┐
│ 🎉 ¡Tu pedido está listo!            │
│                                     │
│ El mesero te lo traerá en breve     │
│ Orden #2345 • Mesa 12               │
└─────────────────────────────────────┘

📱 Pantalla Estado:
┌─────────────────────────────────────┐
│ ⬅️ Estado del Pedido                │
├─────────────────────────────────────┤
│                                     │
│ ✅ Confirmado                        │
│ ✅ En preparación                    │
│ 🎉 Listo para servir                │
│    ⏱️ 19:23 PM                       │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ ¡Tu comida está lista!              │
│ El mesero Carlos te la traerá pronto│
│                                     │
└─────────────────────────────────────┘
```

**Paso 8.3: Mesero Sirve el Pedido**
```
⏱️ Tiempo: 21 min 00 seg
📍 Ubicación: Mesa 12

🎬 Acción del Mesero:
- Carlos recoge los platillos
- Lleva a la mesa 12
- Sirve los alimentos

💬 Mesero Carlos:
"¡Aquí está su pedido! Ribeye término medio, 
ensalada césar y pasta alfredo. ¡Buen provecho!"

🎬 Acción del Mesero (App):
- Marca pedido como "SERVIDO"

📱 App Mesero:
[Marcar como Servido ✅]

🔄 Sistema:
SignalR Event: "OrderServed"

📱 Notificación Cliente:
┌─────────────────────────────────────┐
│ 😋 ¡Buen provecho!                   │
│                                     │
│ ¿Cómo está todo?                    │
│ [⭐⭐⭐⭐⭐]                          │
└─────────────────────────────────────┘
```

---

### **📊 MÉTRICAS DEL JOURNEY**

```
⏱️ Tiempos:
- Escanear QR → Ver menú: 15 segundos
- Navegar menú → Agregar al carrito: 2-3 minutos
- Revisar carrito → Confirmar pedido: 1 minuto
- Pedido confirmado → En preparación: 15 segundos
- Preparación → Servido: 20 minutos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ~25 minutos (desde QR hasta servido)

👤 Satisfacción:
✅ Sin esperar al mesero para ordenar
✅ Fotos HD de todos los platillos
✅ Personalización fácil
✅ Tracking en tiempo real
✅ Notificaciones proactivas

🎯 Pain Points Resueltos:
❌ Esperar al mesero para pedir el menú
❌ No saber cómo se ven los platillos
❌ No saber cuánto falta
❌ Tener que llamar al mesero constantemente
```

---

## **2. CLIENTE - REALIZA PAGO**

### **👤 Continuación del Journey de María**

**Hora:** 19:50 PM (30 minutos después)
**Contexto:** María y sus amigos terminaron de comer

---

### **📍 JOURNEY DE PAGO**

**Paso 1.1: Solicitar Cuenta**
```
⏱️ Tiempo: 19:50 PM
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- María abre la app (todavía abierta)
- Toca en "Solicitar Cuenta"

💭 Pensamiento:
"Todo estuvo delicioso. Ahora a pagar."

📱 Pantalla:
┌─────────────────────────────────────┐
│ SmartMenu              🛒  Mesa 12  │
├─────────────────────────────────────┤
│                                     │
│ Tu orden #2345                      │
│ ✅ Servido                           │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [🍽️ Agregar Más Items]              │
│                                     │
│ [💳 Solicitar Cuenta]                │
│                                     │
│ [📞 Llamar al Mesero]                │
│                                     │
└─────────────────────────────────────┘
```

**Paso 1.2: Obtener Cuenta**
```
⏱️ Tiempo: 19:50 PM
📍 Ubicación: Mesa 12

🎬 Acción del Sistema:
- Consulta todos los pedidos de la sesión
- Genera resumen completo

🔄 Backend:
GET /api/tables/12/bill?sessionId=abc123xyz

Response: {
  orders: [...],
  subtotal: 925.00,
  tax: 148.00,
  total: 1073.00,
  suggestedTips: [10%, 15%, 20%]
}

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Tu Cuenta                Mesa 12  │
├─────────────────────────────────────┤
│                                     │
│ Mesa 12 - Sesión de 50 min         │
│ Atendido por: Carlos Ruiz           │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 📦 Orden #2345                      │
│                                     │
│ 🥩 Ribeye Premium           $385.00 │
│ 🥗 Ensalada César           $145.00 │
│ 🍝 Pasta Alfredo            $195.00 │
│ 🍋 Limonada Natural x2       $90.00 │
│ 🍺 Cerveza Artesanal         $65.00 │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ Subtotal:              $925.00      │
│ IVA (16%):             $148.00      │
│ ━━━━━━━━━━━━━━━━━━━━━              │
│ Total:               $1,073.00      │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 💝 Agregar propina                  │
│                                     │
│ ○ 10% ($107.30)                     │
│ ● 15% ($160.95)  ← Sugerida        │
│ ○ 20% ($214.60)                     │
│ ○ Otro monto ___________            │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ Total + Propina:     $1,233.95      │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [Pagar Ahora]                       │
│ [Dividir Cuenta]                    │
│ [Pagar con Mesero]                  │
│                                     │
└─────────────────────────────────────┘
```

**Paso 1.3: Seleccionar Propina**
```
⏱️ Tiempo: 19:50:30 PM
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Selecciona 15% de propina
- Total actualizado: $1,233.95

💭 Pensamiento:
"El servicio estuvo excelente, 15% está bien"

📱 Pantalla (Actualizada):
Total + Propina: $1,233.95
Propina para Carlos: $160.95
```

**Paso 1.4: Método de Pago**
```
⏱️ Tiempo: 19:50:45 PM
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Presiona "Pagar Ahora"
- Selecciona método de pago

💭 Pensamiento:
"Voy a pagar con mi tarjeta"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Seleccionar Método de Pago       │
├─────────────────────────────────────┤
│                                     │
│ Total a pagar: $1,233.95            │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💳 Tarjeta de Crédito/Débito   │ │
│ │ Pago seguro con Stripe          │ │
│ │ [Seleccionar]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  Apple Pay                     │ │
│ │ Pago rápido y seguro            │ │
│ │ [Seleccionar]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🅿️ PayPal                        │ │
│ │ Usa tu cuenta PayPal            │ │
│ │ [Seleccionar]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💵 Efectivo                      │ │
│ │ Paga con el mesero              │ │
│ │ [Seleccionar]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🔒 Pago seguro y encriptado         │
│                                     │
└─────────────────────────────────────┘
```

**Paso 1.5: Ingresar Datos de Tarjeta (Stripe)**
```
⏱️ Tiempo: 19:51:00 PM
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Selecciona "Tarjeta de Crédito/Débito"
- Aparece formulario de Stripe

💭 Pensamiento:
"Se ve seguro, tiene el sello de Stripe"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ⬅️ Pago con Tarjeta                 │
├─────────────────────────────────────┤
│                                     │
│ Total: $1,233.95                    │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [Stripe Payment Element]            │
│                                     │
│ 💳 Número de tarjeta                │
│ ┌─────────────────────────────────┐ │
│ │ 1234 5678 9012 3456             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Vencimiento          CVV            │
│ ┌──────────┐      ┌──────┐         │
│ │ 12 / 25  │      │ 123  │         │
│ └──────────┘      └──────┘         │
│                                     │
│ Nombre en la tarjeta                │
│ ┌─────────────────────────────────┐ │
│ │ MARIA GONZALEZ                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ☑️ Guardar para futuros pagos       │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 📧 Recibo por email (opcional)      │
│ ┌─────────────────────────────────┐ │
│ │ maria@example.com               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [Pagar $1,233.95]                   │
│                                     │
│ 🔒 Powered by Stripe                │
│                                     │
└─────────────────────────────────────┘
```

**Paso 1.6: Procesando Pago**
```
⏱️ Tiempo: 19:51:30 PM
📍 Ubicación: Mesa 12

🎬 Acción del Usuario:
- Ingresa datos de tarjeta
- Presiona "Pagar $1,233.95"

💭 Pensamiento:
"Espero que no tarde mucho"

📱 Pantalla:
┌─────────────────────────────────────┐
│                                     │
│     [Animación de carga]            │
│                                     │
│  💳 Procesando tu pago...           │
│                                     │
│  Por favor no cierres esta ventana  │
│                                     │
└─────────────────────────────────────┘

🔄 Backend:
1. POST /api/payments/intent
2. Stripe.createPaymentIntent($1,233.95)
3. Cliente confirma con Stripe.js
4. Webhook de Stripe: payment_intent.succeeded
5. POST /api/payments/complete
6. Cerrar sesión de mesa
7. Generar factura PDF
8. Enviar email
9. Actualizar analytics
```

**Paso 1.7: Pago Exitoso**
```
⏱️ Tiempo: 19:51:35 PM
📍 Ubicación: Mesa 12

🎬 Respuesta del Sistema:
- Pago procesado exitosamente
- Pantalla de éxito

💭 Pensamiento:
"¡Listo! Qué fácil fue todo"

📱 Pantalla:
┌─────────────────────────────────────┐
│ ✅ ¡Pago Exitoso!                    │
├─────────────────────────────────────┤
│                                     │
│     [Ícono de éxito animado]        │
│                                     │
│ Gracias por tu visita               │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 💳 Tarjeta ****3456                 │
│ Monto: $1,233.95                    │
│ Fecha: 06/02/2026 19:51             │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 📧 Recibo enviado a:                │
│ maria@example.com                   │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 🌟 ¿Cómo fue tu experiencia?        │
│                                     │
│ [⭐⭐⭐⭐⭐]                          │
│                                     │
│ 💬 Comentarios (opcional)           │
│ [___________________________]       │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [Descargar Recibo PDF]              │
│ [Enviar Recibo por WhatsApp]        │
│ [Finalizar]                         │
│                                     │
└─────────────────────────────────────┘

📧 Email Automático:
✉️ Recibo SmartMenu - Orden #2345
Archivo adjunto: recibo-2345.pdf
```

---

### **📊 RESUMEN DE EXPERIENCIA**

```
⭐⭐⭐⭐⭐ Calificación de María: 5/5

💬 "Me encantó poder ver el menú completo con fotos, 
ordenar sin esperar al mesero y pagar desde mi 
teléfono. Súper conveniente!"

✅ Pain Points Resueltos:
- No tener que pedir el menú
- No esperar al mesero para ordenar
- Ver fotos HD de todos los platillos
- Saber el estado del pedido
- Pagar sin esperar la cuenta

🎯 Beneficios Clave:
✓ Tiempo total en restaurante: 60 minutos
✓ Tiempo de espera para ordenar: 0 minutos
✓ Tiempo de espera para pagar: 0 minutos
✓ Satisfacción general: 5/5 estrellas
```

---

## **3. MESERO - ATIENDE MESA**

[Continuaré con los otros user journeys si lo deseas...]

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**Autor:** Smart Menu Team
