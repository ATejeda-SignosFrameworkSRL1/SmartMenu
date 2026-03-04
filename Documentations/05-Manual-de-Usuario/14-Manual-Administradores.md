# 14 - Manual para Administradores

**SmartMenu - Panel de Administración**  
**Roles:** Admin, Manager  
**Última Actualización:** 7 de Febrero de 2026

---

## 🔐 ACCESO AL SISTEMA

### Login

1. URL: `http://localhost:3000`
2. Email: `admin@smartmenu.com`
3. Password: `Admin123!`
4. El sistema te redirige a `http://localhost:3001`

---

## 📊 DASHBOARD PRINCIPAL

### Vista General

```
┌─────────────────────────────────────┐
│ SmartMenu Admin                     │
│ [Dashboard] [Menú] [Usuarios] [...]│
├─────────────────────────────────────┤
│                                     │
│ Hoy:                                │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ 45  │ │67.5K│ │1.5K │ │12/20│   │
│ │Órdns│ │ RD$ │ │ RD$ │ │Mesas│   │
│ └─────┘ └─────┘ └─────┘ └─────┘   │
│                                     │
│ [Gráfica de Ingresos]              │
│ [Top Platillos]                     │
│ [Últimas Órdenes]                   │
└─────────────────────────────────────┘
```

### Métricas Clave

**Hoy:**
- Total de órdenes
- Ingresos del día
- Ticket promedio
- Mesas activas

**Esta Semana:**
- Comparativa con semana anterior
- Tendencias
- Crecimiento porcentual

---

## 🍽️ GESTIÓN DE MENÚ

### Ver Menú Actual

1. Click en "Menú" en navegación
2. Verás lista de categorías
3. Cada categoría muestra sus platillos

### Agregar Nuevo Platillo

1. Click "+ Agregar Platillo"
2. Completa formulario:

```
Nombre: _________________ *
Descripción: ____________ *
Precio (RD$): ___________ *
Categoría: [Dropdown] *
Imagen URL: _____________

Tiempo de Preparación (min): ___
Calorías: ___
Alérgenos: _____________

☐ Vegetariano
☐ Vegano
☐ Sin Gluten

[Cancelar] [Guardar]
```

3. Click "Guardar"
4. Platillo aparece en el menú inmediatamente

### Modificar Platillo

1. Busca el platillo
2. Click en ✏️ (Editar)
3. Modifica campos necesarios
4. Click "Guardar Cambios"

**Importante:** Si cambias el precio, las órdenes activas mantienen el precio anterior.

### Eliminar Platillo

1. Click en 🗑️ (Eliminar)
2. Sistema pregunta: "¿Estás seguro?"
3. Confirma eliminación

**Nota:** No puedes eliminar platillos en órdenes activas. Mejor márcalo como "No disponible".

### Toggle Disponibilidad

Para marcar platillo como no disponible temporalmente:

1. Click en el ícono 👁️
2. Cambia entre:
   - 👁️ Visible (Disponible)
   - 👁️‍🗨️ Oculto (No disponible)

Útil cuando:
- Se agotó ingrediente
- Temporalmente fuera del menú
- Testing de nuevo platillo

---

## 📂 GESTIÓN DE CATEGORÍAS

### Ver Categorías

```
┌──────────────────────────────┐
│ Categorías                   │
├──────────────────────────────┤
│ [+ Nueva Categoría]          │
│                              │
│ 1. Entradas (5 platillos)    │
│    [↑] [↓] [✏️] [🗑️]         │
│                              │
│ 2. Platos Fuertes (12)       │
│    [↑] [↓] [✏️] [🗑️]         │
│                              │
│ 3. Postres (6)               │
│    [↑] [↓] [✏️] [🗑️]         │
└──────────────────────────────┘
```

### Crear Categoría

1. Click "+ Nueva Categoría"
2. Ingresa:
   - Nombre
   - Descripción
   - Orden de visualización
3. Guarda

### Reordenar Categorías

- Click [↑] para mover arriba
- Click [↓] para mover abajo
- O arrastra y suelta (drag & drop)

El orden se refleja inmediatamente en el menú del cliente.

---

## 👥 GESTIÓN DE USUARIOS

### Roles Disponibles

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo |
| **Manager** | Menú, reportes |
| **Chef** | Solo KDS |
| **KitchenStaff** | Solo KDS |
| **Waiter** | App mesero |
| **Hostess** | Asignar mesas |
| **Bartender** | Bar y bebidas |
| **Cashier** | Pagos |

### Crear Usuario

1. Accede a "Usuarios"
2. Click "+ Nuevo Usuario"
3. Completa:

```
Email: ______________ *
Nombre: _____________ *
Apellido: ___________ *
Teléfono: ___________
Rol: [Dropdown] *
Password: ___________ *

☐ Usuario Activo

[Cancelar] [Crear]
```

4. Sistema crea usuario
5. Opcionalmente envía credenciales por email

### Desactivar Usuario

1. Busca usuario en lista
2. Click en switch "Activo/Inactivo"
3. Usuario no puede entrar al sistema

**No elimines usuarios** - mejor desactívalos para mantener historial.

### Resetear Contraseña

1. Click en usuario
2. Click "Resetear Password"
3. Sistema genera password temporal
4. Envía por email o dale personalmente

---

## 🏢 CONFIGURACIÓN DEL RESTAURANTE

### Información General

```
Nombre: ___________________________
Dirección: ________________________
Teléfono: _________________________
Email: ____________________________
RNC: ______________________________
Logo: [Subir imagen]
```

### Zonas y Mesas

#### Crear Zona

1. Accede a "Configuración" > "Zonas"
2. Click "+ Nueva Zona"
3. Ingresa nombre: "Terraza", "Salón", etc.
4. Guarda

#### Agregar Mesas

1. Selecciona zona
2. Click "+ Agregar Mesa"
3. Ingresa:
   - Número de mesa
   - Capacidad (personas)
4. Sistema genera QR automáticamente
5. Guarda

#### Imprimir Códigos QR

1. Accede a "Mesas"
2. Selecciona mesa(s)
3. Click "Imprimir QRs"
4. Sistema genera PDF
5. Imprime en papel adhesivo o acrílico

---

## 📈 REPORTES Y ANALYTICS

### Reportes Disponibles

#### 1. Ventas por Período

```
Rango: [01/02/2026] - [07/02/2026]

Total Órdenes: 312
Total Ingresos: RD$ 468,000
Ticket Promedio: RD$ 1,500

Gráfica:
┌────────────────────────┐
│    Ingresos Diarios    │
│  (Últimos 7 días)      │
│                        │
│  [Gráfica de barras]   │
│                        │
└────────────────────────┘

[Exportar PDF] [Exportar Excel]
```

#### 2. Platillos Más Vendidos

```
Top 10 - Esta Semana

1. Churrasco
   Vendidos: 89
   Ingresos: RD$ 75,650
   % del total: 16.2%

2. Ensalada César
   Vendidos: 67
   Ingresos: RD$ 23,450
   % del total: 5.0%

[Ver Top 20] [Exportar]
```

#### 3. Rendimiento de Meseros

```
Mesero: María González

Esta Semana:
- Órdenes servidas: 78
- Ingresos generados: RD$ 117,000
- Ticket promedio: RD$ 1,500
- Propinas: RD$ 11,700
- Rating promedio: 4.8/5 ⭐

[Detalles] [Comparar]
```

#### 4. Utilización de Mesas

```
Análisis - Esta Semana

Mesa 1 (Terraza):
- Sesiones: 45
- Ingresos: RD$ 67,500
- Tiempo promedio: 1h 15min
- Tasa de rotación: 6.4/día

[Ver todas las mesas]
```

### Exportar Reportes

- **PDF**: Para imprimir o enviar
- **Excel**: Para análisis detallado
- **Email**: Enviar directamente a gerencia

---

## ⚙️ CONFIGURACIÓN AVANZADA

### Impuestos

```
ITBIS (Impuesto):
Tasa actual: [18]%

Propina Sugerida:
☑ Mostrar sugerencia
Porcentaje: [10]%

[Guardar]
```

### Horarios de Operación

```
┌──────────┬─────────┬─────────┐
│ Día      │ Apertura│ Cierre  │
├──────────┼─────────┼─────────┤
│ Lunes    │ 11:00   │ 22:00   │
│ Martes   │ 11:00   │ 22:00   │
│ ...      │ ...     │ ...     │
│ Domingo  │ 12:00   │ 20:00   │
└──────────┴─────────┴─────────┘

Días Cerrados:
☑ 1 de Enero (Año Nuevo)
☑ 25 de Diciembre (Navidad)
```

### Notificaciones

```
☑ Email cuando orden nueva
☑ SMS al gerente (emergencias)
☑ Alerta si orden > 30 min
☑ Resumen diario de ventas

[Configurar]
```

---

## 🛡️ SEGURIDAD Y RESPALDO

### Backup de Base de Datos

**Automático:**
- Diario a las 2:00 AM
- Se guarda en servidor
- Retención: 30 días

**Manual:**
1. Accede a "Configuración" > "Backup"
2. Click "Crear Backup Ahora"
3. Sistema genera archivo .bak
4. Descarga si deseas copia local

### Logs del Sistema

Ver actividad reciente:
```
[2026-02-07 14:30:15] Admin: Login exitoso
[2026-02-07 14:31:22] Admin: Platillo "Filet Mignon" creado
[2026-02-07 14:35:10] Chef: Orden #42 confirmada
[2026-02-07 14:40:55] Waiter: Orden #42 servida
```

Útil para:
- Auditoría
- Troubleshooting
- Seguridad

---

## 📱 MANTENIMIENTO

### Tareas Diarias

- [ ] Revisar órdenes completadas
- [ ] Verificar cierre de caja
- [ ] Revisar quejas o comentarios
- [ ] Backup automático funcionando

### Tareas Semanales

- [ ] Revisar reporte de ventas
- [ ] Analizar platillos más vendidos
- [ ] Revisar disponibilidad de ingredientes
- [ ] Actualizar precios si necesario

### Tareas Mensuales

- [ ] Generar reporte mensual completo
- [ ] Revisar rendimiento de personal
- [ ] Actualizar menú (platillos de temporada)
- [ ] Verificar backup y recuperación

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Sistema Lento

1. Verifica conexión a Internet
2. Revisa servidor: `http://localhost:5041/health`
3. Reinicia servicios si necesario
4. Contacta soporte técnico

### Base de Datos No Responde

1. Verifica SQL Server está corriendo
2. Revisa connection string
3. Verifica credenciales
4. Contacta IT

### Usuarios No Pueden Login

1. Verifica usuario está activo
2. Resetea password
3. Verifica rol asignado
4. Revisa logs de errores

---

## 📞 SOPORTE TÉCNICO

**Soporte IT:**
- Email: support@smartmenu.com
- Tel: 809-555-0199
- Horario: 24/7

**Documentación:**
- GitHub: github.com/smartmenu/docs
- Wiki: wiki.smartmenu.com

---

## 🎓 RECURSOS ADICIONALES

### Tutoriales en Video

- Configuración inicial (10 min)
- Gestión de menú (15 min)
- Reportes avanzados (20 min)
- Troubleshooting (25 min)

### Actualizaciones

Sistema se actualiza automáticamente.
Revisa cambios en: `CHANGELOG.md`

---

**¡Éxito en tu gestión!** 🚀

Para cualquier duda, consulta esta documentación o contacta soporte.
