# 13 - Manual para Personal del Restaurante

**SmartMenu - Sistema de Gestión**  
**Roles:** Mesero, Chef, Hostess, Cajero  
**Última Actualización:** 7 de Febrero de 2026

---

## 🔐 INICIO DE SESIÓN

### Acceder al Sistema

1. Abre tu navegador web
2. Ve a: `http://localhost:3000`
3. Se abre automáticamente la página de login

### Ingresa tus Credenciales

```
Email: tu-email@smartmenu.com
Password: tu-contraseña
```

4. Click en "Iniciar Sesión"
5. El sistema te redirige según tu rol

### Roles y Aplicaciones

| Rol | Aplicación | Puerto |
|-----|------------|--------|
| Admin/Manager | Admin Panel | 3001 |
| Chef | KDS (Cocina) | 3002 |
| Mesero/Hostess | Waiter App | 3003 |
| Cajero | Admin Panel/Cashier | 3001 |

---

## 👔 MANUAL DEL MESERO

### Tu Dashboard

Cuando inicies sesión verás:

```
┌────────────────────────────┐
│ SmartMenu Waiter           │
│ [Tu Nombre]       [Salir]  │
├────────────────────────────┤
│ Estadísticas:              │
│ Total: 20  Disponibles: 8  │
│ Ocupadas: 10  Reservadas: 2│
│                            │
│ [Todas] [Terraza] [Salón]  │
│                            │
│ [Grid de Mesas]            │
└────────────────────────────┘
```

### Estados de Mesas

- 🟢 **Verde = Disponible**: Lista para asignar
- 🔴 **Rojo = Ocupada**: Con clientes
- 🟡 **Amarillo = Reservada**: Reservación confirmada
- ⚫ **Gris = Fuera de Servicio**: No usar

### Asignar Mesa a Clientes

1. Cliente llega al restaurante
2. Tú consultas mesas disponibles (🟢 verdes)
3. Seleccionas mesa adecuada por:
   - Número de personas (capacidad)
   - Zona preferida
4. Tocas la mesa en tu app
5. Presionas "Asignar Mesa"
6. Ingresas:
   - Número de personas
   - Nombre (opcional)
7. Mesa cambia a 🔴 Ocupada
8. Acompañas clientes a la mesa
9. Les explicas el código QR

### Ayudar con Pedidos

**Si cliente tiene dudas:**
- Explica cómo escanear QR
- Muestra cómo navegar el menú
- Ayuda con recomendaciones

**Si cliente prefiere orden manual:**
- Toma nota en papel (respaldo)
- Ingresa en el sistema después
- Confirma orden con cliente

### Recibir Notificaciones

Recibirás alertas cuando:
- ✅ Orden lista en cocina
- 🔔 Cliente solicita atención
- 💰 Cliente listo para pagar

### Servir Platillos

1. Recibes notificación: "Orden X lista"
2. Vas a ventanilla de cocina
3. Verificas platillos contra orden
4. Llevas platillos a la mesa
5. Confirmas con cliente:
   - "¿Todo está correcto?"
   - "¿Necesitan algo más?"
6. Actualizas estado a "Servido" en tu app

### Procesar Pago

1. Cliente solicita cuenta
2. Abres la orden en tu app
3. Sistema muestra resumen:
   ```
   Subtotal:    RD$ 1,550.00
   ITBIS (18%): RD$ 279.00
   Propina:     RD$ 155.00
   ─────────────────────────
   Total:       RD$ 1,984.00
   ```
4. Preguntas método de pago:
   - Efectivo
   - Tarjeta
   - Transferencia
5. Procesas según método
6. Sistema genera factura
7. Entregas recibo al cliente
8. Mesa vuelve a 🟢 Disponible

### Tips del Mesero

- ✓ Siempre sonríe
- ✓ Sé amable y paciente
- ✓ Conoce el menú
- ✓ Recomienda platillos populares
- ✓ Verifica órdenes antes de confirmar
- ✓ Mantén mesas limpias
- ✓ Responde rápido a notificaciones

---

## 👨‍🍳 MANUAL DEL CHEF

### Tu KDS (Kitchen Display System)

Pantalla oscura optimizada para cocina:

```
┌────────────────────────────┐
│ Kitchen Display System     │
│ Chef Juan        [Salir]   │
│ Órdenes Activas: 3    🔴   │
├────────────────────────────┤
│ ┌──────────────────────┐   │
│ │ ORD-00042  Mesa 1    │   │
│ │ 🟢 8 min              │   │
│ │ ─────────────────    │   │
│ │ 2x Ensalada César    │   │
│ │   Extra aderezo      │   │
│ │ 1x Churrasco         │   │
│ │   Término medio      │   │
│ │                      │   │
│ │ [Confirmar] [Listo]  │   │
│ └──────────────────────┘   │
└────────────────────────────┘
```

### Colores de Alerta

- 🟢 **Verde**: < 15 minutos (OK)
- 🟡 **Amarillo**: 15-25 minutos (Apurarse)
- 🔴 **Rojo**: > 25 minutos (¡Urgente!)

### Flujo de Trabajo

#### 1. Orden Nueva Llega

- Aparece automáticamente en tu KDS
- Escuchas sonido de notificación
- Orden muestra:
  - Número de orden
  - Mesa
  - Items a preparar
  - Notas especiales (importante)

#### 2. Confirmar Orden

- Toca "Confirmar"
- Estado cambia a "Confirmada"
- Mesero recibe notificación
- Tiempo empieza a correr

#### 3. Preparar Platillos

Para cada item:
- Lee cuidadosamente las notas
- Prepara según estándares
- Marca "Preparando" (opcional)
- Cuida presentación
- Marca "Listo" cuando terminas

#### 4. Orden Completa

Cuando todos los items están listos:
- Toca "Orden Lista"
- Mesero recibe notificación inmediata
- Sonido de alerta
- Colocas platillos en ventanilla

#### 5. Orden Servida

- Mesero recoge platillos
- Confirma en su app
- Orden sale de tu KDS

### Gestionar Múltiples Órdenes

**Priorización:**
1. Órdenes rojas (> 25 min) primero
2. Órdenes amarillas después
3. Órdenes verdes cuando puedas

**Cocina Eficiente:**
- Agrupa items similares
- Usa todos los fuegos
- Prepara guarniciones en batch
- Coordina con ayudantes

### Casos Especiales

**Si falta ingrediente:**
1. Notifica al manager inmediatamente
2. No confirmes la orden
3. Manager informa al mesero
4. Mesero ofrece alternativa al cliente

**Si orden toma mucho tiempo:**
- Sistema te alerta (🔴 rojo)
- Comunica al mesero
- Mesero informa al cliente
- Ofrece cortesía si es apropiado

### Tips del Chef

- ✓ Lee TODAS las notas especiales
- ✓ Mantén estándares de calidad
- ✓ Confirma órdenes rápidamente
- ✓ Comunica problemas al instante
- ✓ Mantén área limpia
- ✓ Prioriza órdenes antiguas

---

## 🏠 MANUAL DE LA HOSTESS

### Tus Responsabilidades

- Recibir clientes
- Asignar mesas apropiadas
- Gestionar reservaciones
- Mantener lista de espera

### Asignar Mesas

1. Cliente llega sin reserva
2. Preguntas:
   - "¿Cuántas personas?"
   - "¿Prefieren alguna zona?"
3. Consultas disponibilidad en tu app
4. Seleccionas mejor mesa
5. Asignas y acompañas

### Gestionar Reservaciones

- Marca mesas como "Reservadas" (🟡)
- Anota hora de reservación
- Prepara mesa antes de que lleguen
- Cuando llegan, confirmas identidad
- Cambias estado a "Ocupada" (🔴)

### Lista de Espera

Si no hay mesas:
1. Ofreces esperar
2. Tomas datos: nombre, personas
3. Das tiempo estimado
4. Cuando mesa se libera, llamas

---

## 💰 MANUAL DEL CAJERO

### Procesar Pagos

1. Mesero informa que mesa X quiere pagar
2. Abres orden en sistema
3. Verificas items y total
4. Cliente elige método de pago

### Métodos de Pago

**Efectivo:**
1. Recibes dinero
2. Ingresas monto en sistema
3. Sistema calcula cambio
4. Entregas cambio

**Tarjeta:**
1. Procesas en terminal
2. Cliente ingresa PIN/firma
3. Ingresas código de autorización en sistema
4. Entregas voucher

**Transferencia:**
1. Das datos bancarios
2. Cliente transfiere
3. Verificas recepción
4. Confirmas en sistema

### Generar Factura

- Sistema genera automáticamente
- Incluye ITBIS (18%)
- Con o sin RNC según cliente
- Imprime o envía por email

### Cierre de Caja

Al final del turno:
1. Sistema calcula totales
2. Verificas efectivo en caja
3. Cuadras diferencias
4. Firmas reporte de cierre

---

## 🆘 PROBLEMAS COMUNES

### "No puedo iniciar sesión"
- Verifica tu email y contraseña
- Pregunta al admin si tu cuenta está activa

### "No veo órdenes nuevas"
- Verifica conexión a Internet
- Refresca la página (F5)
- Pregunta al soporte técnico

### "Cliente no puede escanear QR"
- Ayúdale con la cámara
- Limpia el código QR
- Si persiste, toma orden manualmente

### "Sistema está lento"
- Verifica tu WiFi
- Cierra otras apps
- Notifica al soporte

---

## 📱 SOPORTE

**IT Support:**
- Email: support@smartmenu.com
- Tel: 809-555-0199
- Ext: 123 (interno)

**Manager de Turno:**
- Siempre disponible en piso

---

¡Gracias por tu trabajo! Tu eficiencia hace la diferencia. 💪
