# 08 - Casos de Uso del Administrador

**Proyecto:** SmartMenu  
**Actor:** Admin, Manager  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 CASOS DE USO

1. [Login Administrador](#cu-01-login-administrador)
2. [Gestionar Menú](#cu-02-gestionar-menú)
3. [Agregar Platillo](#cu-03-agregar-platillo)
4. [Modificar Platillo](#cu-04-modificar-platillo)
5. [Eliminar Platillo](#cu-05-eliminar-platillo)
6. [Gestionar Categorías](#cu-06-gestionar-categorías)
7. [Ver Dashboard Analytics](#cu-07-ver-dashboard-analytics)
8. [Gestionar Usuarios](#cu-08-gestionar-usuarios)
9. [Configurar Restaurante](#cu-09-configurar-restaurante)
10. [Ver Reportes](#cu-10-ver-reportes)

---

## CU-01: Login Administrador

### Descripción
El administrador accede al panel de administración.

### Actor
Admin, Manager

### Precondiciones
- Administrador tiene credenciales válidas

### Flujo Principal

1. Administrador abre `http://localhost:3000`
2. Sistema redirige a `/login`
3. Administrador ingresa credenciales:
   ```
   Email: admin@smartmenu.com
   Password: Admin123!
   ```
4. Administrador presiona "Iniciar Sesión"
5. Sistema valida credenciales
6. Sistema detecta rol "Admin" o "Manager"
7. Sistema redirige a `http://localhost:3001` (Admin Panel)
8. Sistema muestra Dashboard con:
   - Estadísticas generales
   - Órdenes recientes
   - Ingresos del día
   - Gráficas de rendimiento

### Postcondiciones
- Administrador está autenticado
- Admin Panel cargado
- Todas las funcionalidades administrativas disponibles

---

## CU-02: Gestionar Menú

### Descripción
El administrador visualiza y administra el menú completo.

### Actor
Admin, Manager

### Precondiciones
- Administrador ha iniciado sesión

### Flujo Principal

1. Administrador accede a "Menú" en Admin Panel
2. Sistema muestra menú organizado por:
   - Categorías
   - Platillos por categoría
   - Estado (disponible/no disponible)
3. Sistema muestra para cada platillo:
   - Nombre
   - Descripción
   - Precio
   - Imagen
   - Categoría
   - Estado
   - Acciones (Editar, Eliminar, Toggle Disponibilidad)
4. Administrador puede:
   - Buscar platillos
   - Filtrar por categoría
   - Ordenar por nombre/precio
   - Ver estadísticas de ventas

### UI/UX
```
┌────────────────────────────┐
│ Admin Panel - Gestión Menú │
├────────────────────────────┤
│ [+ Agregar Platillo]       │
│ [🔍 Buscar...]  [Filtros▼] │
│                            │
│ === Entradas (5) ===       │
│                            │
│ ┌──────────────────────┐   │
│ │ [📷]                 │   │
│ │ Ensalada César       │   │
│ │ RD$ 350.00           │   │
│ │ 🟢 Disponible        │   │
│ │ Vendidos: 45 esta sem│   │
│ │ [✏️] [🗑️] [👁️/👁️‍🗨️]  │   │
│ └──────────────────────┘   │
│                            │
│ === Platos Fuertes (12) ===│
│ ...                        │
└────────────────────────────┘
```

---

## CU-03: Agregar Platillo

### Descripción
El administrador agrega un nuevo platillo al menú.

### Actor
Admin, Manager

### Precondiciones
- Existen categorías creadas

### Flujo Principal

1. Administrador presiona "+ Agregar Platillo"
2. Sistema muestra formulario:
   - Nombre *
   - Descripción *
   - Precio *
   - Categoría *
   - Imagen (URL o subir)
   - Tiempo de preparación
   - Calorías
   - Alérgenos
   - Opciones dietéticas:
     - ☐ Vegetariano
     - ☐ Vegano
     - ☐ Sin Gluten
3. Administrador completa campos
4. Administrador sube imagen (opcional)
5. Administrador presiona "Guardar"
6. Sistema valida datos:
   - Campos requeridos completos
   - Precio válido (> 0)
   - Categoría existe
7. Sistema guarda platillo en BD
8. Sistema muestra confirmación
9. Nuevo platillo aparece en el menú

### Postcondiciones
- Platillo creado en BD
- Disponible en menú del cliente
- Visible en Admin Panel

### Validaciones
- Nombre: 3-200 caracteres
- Precio: Decimal positivo
- Descripción: Máximo 1000 caracteres
- Tiempo preparación: 1-180 minutos

### Ejemplo de Datos
```json
{
  "name": "Filet Mignon",
  "description": "Filete de res premium con vegetales",
  "price": 1250.00,
  "categoryId": 2,
  "imageUrl": "https://example.com/filet.jpg",
  "preparationTimeMinutes": 25,
  "calories": 650,
  "allergens": "Ninguno",
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": true
}
```

---

## CU-04: Modificar Platillo

### Descripción
El administrador edita información de un platillo existente.

### Actor
Admin, Manager

### Precondiciones
- Platillo existe en el sistema

### Flujo Principal

1. Administrador busca platillo en gestión de menú
2. Administrador presiona "Editar" (✏️)
3. Sistema carga datos actuales en formulario
4. Administrador modifica campos deseados:
   - Precio
   - Descripción
   - Disponibilidad
   - Imagen
   - Etc.
5. Administrador presiona "Guardar Cambios"
6. Sistema valida nueva información
7. Sistema actualiza platillo en BD
8. Sistema muestra confirmación
9. Cambios reflejan inmediatamente en menú del cliente

### Postcondiciones
- Platillo actualizado
- Cambios visibles en todos los clientes (vía SignalR)
- Historial de cambios registrado

### Flujos Alternativos

**FA1: Cambio de Precio Durante Órdenes Activas**
- Sistema detecta órdenes activas con este platillo
- Sistema muestra advertencia
- Administrador confirma cambio
- Órdenes activas mantienen precio anterior
- Nuevas órdenes usan precio nuevo

---

## CU-05: Eliminar Platillo

### Descripción
El administrador elimina un platillo del menú.

### Actor
Admin

### Precondiciones
- Administrador tiene rol "Admin" (no Manager)

### Flujo Principal

1. Administrador presiona "Eliminar" (🗑️)
2. Sistema muestra confirmación:
   ```
   ⚠️ ¿Eliminar "Ensalada César"?
   Esta acción no se puede deshacer.
   ```
3. Administrador confirma eliminación
4. Sistema verifica:
   - No hay órdenes activas con este platillo
   - No hay reservas con este platillo
5. Sistema elimina platillo de BD
6. Sistema muestra confirmación
7. Platillo desaparece del menú

### Flujos Alternativos

**FA1: Platillo en Órdenes Activas**
- Sistema detecta órdenes activas
- Sistema muestra error:
   ```
   ❌ No se puede eliminar
   Hay 3 órdenes activas con este platillo
   ```
- Sistema sugiere: "Marcar como no disponible"
- Administrador puede desactivar en lugar de eliminar

---

## CU-06: Gestionar Categorías

### Descripción
El administrador administra las categorías del menú.

### Actor
Admin, Manager

### Precondiciones
- Administrador ha iniciado sesión

### Flujo Principal

1. Administrador accede a "Categorías"
2. Sistema muestra lista de categorías:
   - Nombre
   - Descripción
   - Orden de visualización
   - Cantidad de platillos
3. Administrador puede:
   - Agregar nueva categoría
   - Editar categoría existente
   - Eliminar categoría (si está vacía)
   - Reordenar categorías (drag & drop)
4. Para agregar categoría:
   - Presiona "+ Nueva Categoría"
   - Ingresa nombre y descripción
   - Define orden
   - Guarda
5. Sistema actualiza menú del cliente

### Reglas
- Categoría no puede eliminarse si tiene platillos
- Orden determina visualización en menú del cliente
- Nombre debe ser único

---

## CU-07: Ver Dashboard Analytics

### Descripción
El administrador visualiza métricas y estadísticas del restaurante.

### Actor
Admin, Manager

### Precondiciones
- Hay datos históricos disponibles

### Flujo Principal

1. Administrador accede a Dashboard principal
2. Sistema muestra métricas en tiempo real:
   - **Hoy:**
     - Órdenes: 45
     - Ingresos: RD$ 67,500
     - Ticket promedio: RD$ 1,500
     - Mesas activas: 12/20
   - **Esta Semana:**
     - Total órdenes: 312
     - Ingresos: RD$ 468,000
     - Crecimiento: +15%
   - **Este Mes:**
     - Total órdenes: 1,245
     - Ingresos: RD$ 1,867,500
     - Ticket promedio: RD$ 1,500
3. Sistema muestra gráficas:
   - Ingresos por día (última semana)
   - Órdenes por hora
   - Platillos más vendidos
   - Categorías más populares
4. Administrador puede filtrar por:
   - Rango de fechas
   - Tipo de métrica
   - Zona del restaurante

### UI/UX
```
┌────────────────────────────┐
│ Dashboard - SmartMenu      │
├────────────────────────────┤
│ [Filtros: Hoy ▼] [Refrescar]
│                            │
│ ┌──────┐ ┌──────┐ ┌──────┐│
│ │  45  │ │67.5K │ │ 1.5K ││
│ │Órdenes│ │ RD$ │ │ RD$ ││
│ └──────┘ └──────┘ └──────┘│
│                            │
│ Ingresos (Última Semana)   │
│ ┌────────────────────┐    │
│ │    /\    /\        │    │
│ │   /  \  /  \   /\  │    │
│ │  /    \/    \_/  \ │    │
│ └────────────────────┘    │
│                            │
│ Top 5 Platillos:           │
│ 1. Churrasco (89 vendidos) │
│ 2. Ensalada César (67)     │
│ 3. Filet Mignon (45)       │
│ 4. Pasta Carbonara (42)    │
│ 5. Salmón Grillado (38)    │
└────────────────────────────┘
```

---

## CU-08: Gestionar Usuarios

### Descripción
El administrador gestiona cuentas de usuarios del sistema.

### Actor
Admin

### Precondiciones
- Administrador tiene rol "Admin"

### Flujo Principal

1. Administrador accede a "Usuarios"
2. Sistema muestra lista de usuarios:
   - Nombre completo
   - Email
   - Rol
   - Estado (Activo/Inactivo)
   - Último login
3. Administrador puede:
   - Crear nuevo usuario
   - Editar usuario existente
   - Desactivar/Activar usuario
   - Cambiar rol
   - Resetear contraseña
4. Para crear usuario:
   - Presiona "+ Nuevo Usuario"
   - Completa formulario:
     - Email
     - Nombre
     - Apellido
     - Rol
     - Teléfono
     - Contraseña inicial
   - Sistema valida email único
   - Sistema crea usuario
   - Sistema envía credenciales (opcional)

### Roles Disponibles
- Admin: Acceso completo
- Manager: Gestión de menú y reportes
- Chef: Solo KDS
- KitchenStaff: Solo KDS
- Waiter: App de mesero
- Hostess: Asignación de mesas
- Bartender: Bar y bebidas
- Cashier: Pagos y facturación

---

## CU-09: Configurar Restaurante

### Descripción
El administrador configura información general del restaurante.

### Actor
Admin

### Precondiciones
- Administrador tiene rol "Admin"

### Flujo Principal

1. Administrador accede a "Configuración"
2. Sistema muestra secciones:
   
   **Información General:**
   - Nombre del restaurante
   - Dirección
   - Teléfono
   - Email
   - RNC
   - Logo
   
   **Configuración de Impuestos:**
   - ITBIS (18%)
   - Ley de propina (10%)
   
   **Zonas:**
   - Agregar/Editar zonas
   - Asignar mesas a zonas
   
   **Horarios:**
   - Horario de operación
   - Días cerrados
   
3. Administrador modifica campos
4. Administrador presiona "Guardar Configuración"
5. Sistema valida datos
6. Sistema actualiza configuración
7. Cambios aplican inmediatamente

---

## CU-10: Ver Reportes

### Descripción
El administrador genera y visualiza reportes detallados.

### Actor
Admin, Manager

### Precondiciones
- Hay datos históricos

### Flujo Principal

1. Administrador accede a "Reportes"
2. Sistema muestra tipos de reportes disponibles:
   - Ventas por período
   - Platillos más vendidos
   - Rendimiento de meseros
   - Utilización de mesas
   - Ingresos por zona
   - Análisis de propinas
3. Administrador selecciona tipo de reporte
4. Administrador define parámetros:
   - Rango de fechas
   - Filtros (zona, mesero, categoría)
   - Formato (PDF, Excel, Vista web)
5. Administrador genera reporte
6. Sistema procesa datos
7. Sistema muestra/descarga reporte

### Tipos de Reportes

**Reporte de Ventas:**
```
Período: 01/02/2026 - 07/02/2026

Total Órdenes: 312
Total Ingresos: RD$ 468,000
Ticket Promedio: RD$ 1,500

Desglose por Día:
Lunes:    42 órdenes - RD$ 63,000
Martes:   38 órdenes - RD$ 57,000
...
```

**Top Platillos:**
```
1. Churrasco
   Vendidos: 89
   Ingresos: RD$ 75,650
   % del total: 16.2%

2. Ensalada César
   Vendidos: 67
   Ingresos: RD$ 23,450
   % del total: 5.0%
```

---

## ✅ RESUMEN DE CASOS DE USO - ADMIN

| ID | Caso de Uso | Estado | Prioridad |
|----|-------------|--------|-----------|
| CU-01 | Login Admin | ✅ Implementado | Alta |
| CU-02 | Gestionar Menú | ⚠️ Parcial | Alta |
| CU-03 | Agregar Platillo | ✅ Implementado | Alta |
| CU-04 | Modificar Platillo | ✅ Implementado | Alta |
| CU-05 | Eliminar Platillo | ✅ Implementado | Media |
| CU-06 | Gestionar Categorías | ⚠️ Parcial | Media |
| CU-07 | Dashboard Analytics | ⚠️ Básico | Alta |
| CU-08 | Gestionar Usuarios | ❌ Pendiente | Media |
| CU-09 | Configurar Restaurante | ❌ Pendiente | Media |
| CU-10 | Ver Reportes | ❌ Pendiente | Media |

---

**Última Actualización:** 7 de Febrero de 2026  
**Estado:** ✅ Documentación Completa
