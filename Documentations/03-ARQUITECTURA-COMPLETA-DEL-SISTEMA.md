# 🏗️ ARQUITECTURA COMPLETA DEL SISTEMA - SMART MENU

## **📋 ÍNDICE**
1. [Arquitectura General en Capas](#arquitectura-general-en-capas)
2. [Capa de Presentación](#capa-de-presentación)
3. [Capa de Aplicación/Negocio](#capa-de-aplicaciónnegocio)
4. [Capa de Datos](#capa-de-datos)
5. [Capa de Infraestructura](#capa-de-infraestructura)
6. [Componentes Transversales](#componentes-transversales)
7. [Flujos Operacionales Completos](#flujos-operacionales-completos)
8. [Correlaciones y Dependencias](#correlaciones-y-dependencias)
9. [Stack Tecnológico Detallado](#stack-tecnológico-detallado)

---

## **🎯 ARQUITECTURA GENERAL EN CAPAS**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Cliente  │  │ Mesero   │  │  Cocina  │  │  Admin   │       │
│  │   Web    │  │   App    │  │   KDS    │  │  Panel   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↕️ HTTP/REST + WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA API GATEWAY                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Auth Service │  │ Rate Limiter │  │ Load Balance │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            ↕️ Internal APIs
┌─────────────────────────────────────────────────────────────────┐
│                  CAPA DE APLICACIÓN/NEGOCIO                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Menu    │  │  Order   │  │  Table   │  │ Payment  │       │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  User    │  │  Kitchen │  │ Inventory│  │ Analytics│       │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↕️ Data Access Layer
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE DATOS                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   SQL    │  │  Redis   │  │  Azure   │  │  Azure   │       │
│  │  Server  │  │ (Cache)  │  │  Blob    │  │  Service │       │
│  │  (Main)  │  │          │  │ (Files)  │  │   Bus    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↕️ Infrastructure
┌─────────────────────────────────────────────────────────────────┐
│                  CAPA DE INFRAESTRUCTURA                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Docker  │  │   IIS/   │  │  Azure   │  │  Azure   │       │
│  │Container │  │  Kestrel │  │   CDN    │  │ Service  │       │
│  │          │  │  (Proxy) │  │          │  │   Bus    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## **📱 CAPA DE PRESENTACIÓN**

### **1. APLICACIÓN CLIENTE (PWA)**

#### **A. Módulos Frontend**

```
src/
├── pages/
│   ├── home/
│   │   ├── HomePage.tsx              # Página inicial al escanear QR
│   │   └── TableSession.tsx          # Gestión de sesión de mesa
│   ├── menu/
│   │   ├── MenuPage.tsx              # Listado de categorías
│   │   ├── CategoryView.tsx          # Platillos por categoría
│   │   ├── DishDetail.tsx            # Detalle del platillo
│   │   └── DishCustomizer.tsx        # Personalización (sin cebolla, etc.)
│   ├── cart/
│   │   ├── CartPage.tsx              # Carrito de compras
│   │   ├── CartItem.tsx              # Item en el carrito
│   │   └── CartSummary.tsx           # Resumen y totales
│   ├── order/
│   │   ├── OrderConfirmation.tsx     # Confirmación del pedido
│   │   ├── OrderTracking.tsx         # Seguimiento en tiempo real
│   │   └── OrderHistory.tsx          # Historial de pedidos de la mesa
│   └── payment/
│       ├── PaymentPage.tsx           # Página de pago
│       ├── PaymentMethods.tsx        # Selección de método
│       ├── TipSelector.tsx           # Selección de propina
│       └── Receipt.tsx               # Recibo digital
├── components/
│   ├── common/
│   │   ├── Header.tsx                # Header con mesa y tiempo
│   │   ├── Footer.tsx                # Footer con acciones
│   │   ├── LoadingSpinner.tsx        # Indicadores de carga
│   │   ├── ErrorBoundary.tsx         # Manejo de errores
│   │   └── Notification.tsx          # Toast notifications
│   ├── menu/
│   │   ├── DishCard.tsx              # Tarjeta de platillo
│   │   ├── CategoryFilter.tsx        # Filtros (vegetariano, etc.)
│   │   ├── SearchBar.tsx             # Búsqueda de platillos
│   │   └── DishBadges.tsx            # Badges (nuevo, popular, spicy)
│   └── payment/
│       └── SplitBillModal.tsx        # Modal para dividir cuenta
├── services/
│   ├── api/
│   │   ├── menuService.ts            # API calls para menú
│   │   ├── orderService.ts           # API calls para pedidos
│   │   ├── paymentService.ts         # API calls para pagos
│   │   └── tableService.ts           # API calls para mesas
│   ├── signalr/
│   │   ├── orderHub.ts               # SignalR Hub para pedidos
│   │   └── notificationHub.ts        # SignalR Hub para notificaciones
│   └── storage/
│       └── localStorage.ts           # Gestión de almacenamiento local
├── store/
│   ├── slices/
│   │   ├── cartSlice.ts              # Redux slice del carrito
│   │   ├── menuSlice.ts              # Redux slice del menú
│   │   ├── orderSlice.ts             # Redux slice de pedidos
│   │   └── tableSlice.ts             # Redux slice de mesa
│   └── store.ts                      # Configuración de Redux
└── utils/
    ├── formatters.ts                 # Formateo de precios, fechas, etc.
    ├── validators.ts                 # Validaciones
    └── constants.ts                  # Constantes globales
```

#### **B. Componentes Clave Cliente**

| Componente | Responsabilidad | Comunicación |
|------------|----------------|--------------|
| **QR Scanner Handler** | Captura QR y extrae tableId + sessionId | → Table Service API |
| **Menu Catalog** | Muestra menú con filtros y búsqueda | → Menu Service API |
| **Cart Manager** | Gestiona carrito local y sincronización | → Local Storage + Order Service |
| **Order Tracker** | Tracking en tiempo real del pedido | ← SignalR Order Updates |
| **Payment Processor** | Procesa pagos y muestra recibo | → Payment Service API |
| **Notification Handler** | Muestra notificaciones push | ← SignalR Notifications |

---

### **2. APLICACIÓN MESERO (Mobile App)**

#### **A. Módulos Mesero**

```
src/
├── screens/
│   ├── login/
│   │   └── LoginScreen.tsx           # Login con PIN o biometría
│   ├── dashboard/
│   │   ├── DashboardScreen.tsx       # Vista general de sus mesas
│   │   └── TableList.tsx             # Lista de mesas asignadas
│   ├── table/
│   │   ├── TableDetail.tsx           # Detalle de mesa específica
│   │   ├── OrderList.tsx             # Pedidos de la mesa
│   │   └── CallWaiterAlert.tsx       # Alertas de llamado
│   ├── menu/
│   │   ├── ManualOrderScreen.tsx     # Tomar pedido manual
│   │   └── MenuSearch.tsx            # Búsqueda rápida de platillos
│   └── notifications/
│       └── NotificationCenter.tsx    # Centro de notificaciones
├── components/
│   ├── TableCard.tsx                 # Tarjeta de mesa
│   ├── OrderStatusBadge.tsx          # Estado del pedido
│   ├── QuickActions.tsx              # Acciones rápidas
│   └── TimeTracker.tsx               # Timer de la mesa
└── services/
    ├── waiterApi.ts                  # API específica para meseros
    └── notificationService.ts        # Servicio de notificaciones
```

#### **B. Funcionalidades Mesero**

| Funcionalidad | API Endpoint | WebSocket Event |
|---------------|--------------|-----------------|
| Ver mesas asignadas | `GET /api/waiter/tables` | `OnTableAssigned` |
| Ver detalle de mesa | `GET /api/tables/{id}` | `OnTableUpdated` |
| Tomar pedido manual | `POST /api/orders` | - |
| Llamado de cliente | - | `OnWaiterCalled` |
| Marcar pedido entregado | `PUT /api/orders/{id}/delivered` | `OnOrderDelivered` |
| Solicitar cuenta | `GET /api/tables/{id}/bill` | - |

---

### **3. SISTEMA KDS (KITCHEN DISPLAY SYSTEM)**

#### **A. Módulos KDS**

```
src/
├── screens/
│   ├── kitchen/
│   │   ├── KitchenBoard.tsx          # Tablero principal de cocina
│   │   ├── OrderCard.tsx             # Tarjeta de pedido
│   │   ├── OrderQueue.tsx            # Cola de pedidos
│   │   └── StationView.tsx           # Vista por estación
│   ├── expeditor/
│   │   ├── ExpeditorView.tsx         # Vista del chef expeditor
│   │   └── OrderCoordinator.tsx      # Coordinación de platillos
│   └── bar/
│       └── BarDisplay.tsx            # Display específico del bar
├── components/
│   ├── OrderTimer.tsx                # Timer con alertas visuales
│   ├── AllergyAlert.tsx              # Alertas de alergias
│   ├── SpecialInstructions.tsx       # Notas especiales grandes
│   └── PriorityIndicator.tsx         # Indicador de prioridad
└── services/
    └── kitchenHub.ts                 # SignalR Hub para cocina
```

#### **B. Estados de Pedido en KDS**

| Estado | Color | Timer | Acción |
|--------|-------|-------|--------|
| **NEW** | 🟦 Azul | 00:00 | Aparece en cola |
| **PREPARING** | 🟡 Amarillo | 00:00-10:00 | Cocinero acepta |
| **ALMOST_READY** | 🟠 Naranja | 10:00-15:00 | Alerta pre-retraso |
| **READY** | 🟢 Verde | - | Listo para servir |
| **DELAYED** | 🔴 Rojo | >15:00 | Alerta crítica |

---

### **4. PANEL DE ADMINISTRACIÓN (Web Dashboard)**

#### **A. Módulos Admin**

```
src/
├── pages/
│   ├── dashboard/
│   │   ├── Overview.tsx              # Vista general del restaurante
│   │   ├── RealtimeMetrics.tsx       # Métricas en tiempo real
│   │   └── Alerts.tsx                # Sistema de alertas
│   ├── menu/
│   │   ├── MenuManagement.tsx        # CRUD de menú
│   │   ├── CategoryManager.tsx       # Gestión de categorías
│   │   ├── DishForm.tsx              # Formulario de platillo
│   │   └── BulkUpload.tsx            # Carga masiva
│   ├── tables/
│   │   ├── TableLayout.tsx           # Diseño visual del restaurante
│   │   ├── TableManager.tsx          # Gestión de mesas
│   │   └── QRGenerator.tsx           # Generador de QR
│   ├── orders/
│   │   ├── OrderHistory.tsx          # Historial de pedidos
│   │   └── OrderDetails.tsx          # Detalle de pedido
│   ├── inventory/
│   │   ├── InventoryList.tsx         # Lista de inventario
│   │   ├── StockAlerts.tsx           # Alertas de stock bajo
│   │   └── IngredientManager.tsx     # Gestión de ingredientes
│   ├── analytics/
│   │   ├── SalesReport.tsx           # Reporte de ventas
│   │   ├── DishPerformance.tsx       # Performance de platillos
│   │   ├── TableTurnover.tsx         # Rotación de mesas
│   │   └── CustomerInsights.tsx      # Insights de clientes
│   ├── staff/
│   │   ├── StaffList.tsx             # Lista de personal
│   │   ├── ShiftManager.tsx          # Gestión de turnos
│   │   └── TipsDistribution.tsx      # Distribución de propinas
│   └── settings/
│       ├── RestaurantSettings.tsx    # Configuración general
│       ├── PaymentSettings.tsx       # Configuración de pagos
│       └── NotificationSettings.tsx  # Configuración de notificaciones
└── components/
    ├── charts/
    │   ├── LineChart.tsx             # Gráfico de líneas
    │   ├── BarChart.tsx              # Gráfico de barras
    │   ├── PieChart.tsx              # Gráfico circular
    │   └── HeatMap.tsx               # Mapa de calor
    └── tables/
        ├── DataTable.tsx             # Tabla de datos reutilizable
        └── ExportButton.tsx          # Exportar a CSV/PDF
```

---

## **⚙️ CAPA DE APLICACIÓN/NEGOCIO**

### **MICROSERVICIOS PRINCIPALES (.NET 9)**

```
backend/
├── src/
│   ├── Services/
│   │   ├── SmartMenu.AuthService/
│   │   ├── SmartMenu.MenuService/
│   │   ├── SmartMenu.OrderService/
│   │   ├── SmartMenu.TableService/
│   │   ├── SmartMenu.PaymentService/
│   │   ├── SmartMenu.KitchenService/
│   │   ├── SmartMenu.InventoryService/
│   │   ├── SmartMenu.UserService/
│   │   ├── SmartMenu.AnalyticsService/
│   │   └── SmartMenu.NotificationService/
│   ├── Shared/
│   │   ├── SmartMenu.Domain/          # Entities
│   │   ├── SmartMenu.Application/     # Interfaces, DTOs
│   │   ├── SmartMenu.Infrastructure/  # Common infrastructure
│   │   └── SmartMenu.Contracts/       # Shared contracts
│   └── ApiGateway/
│       └── SmartMenu.Gateway/
└── tests/
    ├── UnitTests/
    └── IntegrationTests/
```

---

### **1. AUTH SERVICE (Autenticación y Autorización)**

#### **A. Estructura .NET 9**

```
SmartMenu.AuthService/
├── Controllers/
│   ├── AuthController.cs             # Login, logout, refresh
│   └── RoleController.cs             # Gestión de roles
├── Services/
│   ├── IAuthService.cs               # Interface
│   ├── AuthService.cs                # Lógica de autenticación
│   ├── ITokenService.cs              # Interface
│   ├── TokenService.cs               # Generación de JWT
│   └── PermissionService.cs          # Verificación de permisos
├── Middleware/
│   ├── JwtAuthenticationMiddleware.cs # Verificar JWT
│   ├── AuthorizationMiddleware.cs    # Verificar permisos
│   └── RateLimitingMiddleware.cs     # Rate limiting
├── Data/
│   ├── AuthDbContext.cs              # EF Core DbContext
│   ├── Entities/
│   │   ├── User.cs                   # Entidad Usuario
│   │   ├── Role.cs                   # Entidad Rol
│   │   └── Permission.cs             # Entidad Permiso
│   └── Repositories/
│       ├── IUserRepository.cs
│       └── UserRepository.cs         # Repository implementation
├── DTOs/
│   ├── LoginRequest.cs
│   ├── LoginResponse.cs
│   └── RefreshTokenRequest.cs
├── Hubs/
│   └── AuthHub.cs                    # SignalR Hub
├── Program.cs                        # Entry point
└── appsettings.json
```

#### **B. Endpoints**

| Método | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/auth/login` | Login de usuario | Public |
| POST | `/api/auth/logout` | Logout de usuario | Authenticated |
| POST | `/api/auth/refresh` | Refresh token | Authenticated |
| POST | `/api/auth/register` | Registro (staff) | Admin |
| GET | `/api/auth/me` | Info del usuario actual | Authenticated |
| PUT | `/api/auth/password` | Cambiar contraseña | Authenticated |

#### **C. Roles y Permisos (C#)**

```csharp
// Enums
public enum Role
{
    SuperAdmin,
    Admin,
    Manager,
    Waiter,
    KitchenStaff,
    BarStaff,
    Host,
    Cashier,
    Customer
}

public enum PermissionAction
{
    Create,
    Read,
    Update,
    Delete
}

// Entities
public class Permission
{
    public int Id { get; set; }
    public string Resource { get; set; }  // 'menu', 'orders', 'tables'
    public PermissionAction Action { get; set; }
    public ICollection<RolePermission> RolePermissions { get; set; }
}

public class RolePermission
{
    public int RoleId { get; set; }
    public Role Role { get; set; }
    public int PermissionId { get; set; }
    public Permission Permission { get; set; }
}

// Service para verificar permisos
public class PermissionService : IPermissionService
{
    private readonly AuthDbContext _context;
    
    public async Task<bool> HasPermissionAsync(int userId, string resource, PermissionAction action)
    {
        // Verificación con EF Core optimizada
        var hasPermission = await _context.Users
            .Where(u => u.Id == userId)
            .SelectMany(u => u.Role.RolePermissions)
            .AnyAsync(rp => rp.Permission.Resource == resource && 
                           rp.Permission.Action == action);
        
        var sql = @"
            SELECT COUNT(1)
            FROM Users u
            INNER JOIN RolePermissions rp ON u.RoleId = rp.RoleId
            INNER JOIN Permissions p ON rp.PermissionId = p.Id
            WHERE u.Id = @UserId 
              AND p.Resource = @Resource 
              AND p.Action = @Action";
              
        var hasPermission = await connection.ExecuteScalarAsync<int>(
            sql, 
            new { UserId = userId, Resource = resource, Action = action }
        ) > 0;
        
        return hasPermission;
    }
}
```

---

### **2. MENU SERVICE (Gestión de Menú)**

#### **A. Estructura**

```
menu-service/
├── src/
│   ├── controllers/
│   │   ├── MenuController.ts         # CRUD de menú
│   │   ├── CategoryController.ts     # CRUD de categorías
│   │   ├── DishController.ts         # CRUD de platillos
│   │   └── ModifierController.ts     # CRUD de modificadores
│   ├── services/
│   │   ├── MenuService.ts            # Lógica de menú
│   │   ├── AvailabilityService.ts    # Disponibilidad de platillos
│   │   ├── PricingService.ts         # Lógica de precios dinámicos
│   │   └── RecommendationService.ts  # Sistema de recomendaciones
│   ├── models/
│   │   ├── Menu.model.ts             # Modelo de menú
│   │   ├── Category.model.ts         # Modelo de categoría
│   │   ├── Dish.model.ts             # Modelo de platillo
│   │   ├── Modifier.model.ts         # Modelo de modificador
│   │   └── Ingredient.model.ts       # Modelo de ingrediente
│   └── routes/
│       └── menu.routes.ts            # Rutas de menú
└── tests/
```

#### **B. Modelos de Datos**

```typescript
// Menu
interface Menu {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  isActive: boolean;
  startTime?: Date;      // Menú de desayuno, almuerzo, etc.
  endTime?: Date;
  categories: Category[];
  createdAt: Date;
  updatedAt: Date;
}

// Category
interface Category {
  id: string;
  menuId: string;
  name: string;
  description: string;
  icon: string;
  order: number;         // Orden de visualización
  dishes: Dish[];
}

// Dish
interface Dish {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  preparationTime: number;  // En minutos
  calories?: number;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isSpicy: boolean;
  spicyLevel?: number;   // 1-5
  allergens: Allergen[];
  tags: string[];        // ['popular', 'new', 'chef_special']
  modifiers: Modifier[];
  ingredients: Ingredient[];
}

// Modifier
interface Modifier {
  id: string;
  name: string;
  type: 'ADD' | 'REMOVE' | 'SUBSTITUTE';
  price: number;         // 0 si es remover
  options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

// Ingredient
interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  inventoryId?: string;  // Referencia al inventario
}

enum Allergen {
  GLUTEN = 'gluten',
  DAIRY = 'dairy',
  NUTS = 'nuts',
  SHELLFISH = 'shellfish',
  EGGS = 'eggs',
  SOY = 'soy',
  FISH = 'fish',
  SESAME = 'sesame'
}
```

#### **C. Endpoints**

| Método | Endpoint | Descripción | Cache |
|--------|----------|-------------|-------|
| GET | `/api/menu` | Obtener menú completo | ✅ Redis 5min |
| GET | `/api/menu/categories` | Listar categorías | ✅ Redis 5min |
| GET | `/api/menu/dishes` | Listar platillos | ✅ Redis 5min |
| GET | `/api/menu/dishes/:id` | Detalle de platillo | ✅ Redis 10min |
| GET | `/api/menu/search` | Buscar platillos | ❌ |
| POST | `/api/menu/dishes` | Crear platillo | Admin |
| PUT | `/api/menu/dishes/:id` | Actualizar platillo | Admin |
| DELETE | `/api/menu/dishes/:id` | Eliminar platillo | Admin |
| PATCH | `/api/menu/dishes/:id/availability` | Cambiar disponibilidad | Manager |

---

### **3. ORDER SERVICE (Gestión de Pedidos)**

#### **A. Estructura**

```
order-service/
├── src/
│   ├── controllers/
│   │   ├── OrderController.ts        # CRUD de pedidos
│   │   └── OrderStatusController.ts  # Actualización de estados
│   ├── services/
│   │   ├── OrderService.ts           # Lógica de pedidos
│   │   ├── OrderValidationService.ts # Validaciones
│   │   ├── OrderRoutingService.ts    # Routing a cocina/bar
│   │   ├── OrderTrackingService.ts   # Tracking en tiempo real
│   │   └── OrderHistoryService.ts    # Historial
│   ├── models/
│   │   ├── Order.model.ts            # Modelo de pedido
│   │   ├── OrderItem.model.ts        # Modelo de item
│   │   └── OrderStatus.model.ts      # Modelo de estado
│   ├── workers/
│   │   ├── orderProcessor.ts         # Procesamiento asíncrono
│   │   └── orderNotifier.ts          # Notificaciones
│   └── routes/
│       └── order.routes.ts           # Rutas de pedidos
└── tests/
```

#### **B. Modelo de Pedido**

```typescript
interface Order {
  id: string;
  orderNumber: string;     // Ej: "ORD-2026-001234"
  tableId: string;
  sessionId: string;
  customerId?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  tip?: number;
  discount?: number;
  total: number;
  status: OrderStatus;
  statusHistory: OrderStatusChange[];
  specialInstructions?: string;
  estimatedTime: number;   // Minutos estimados
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface OrderItem {
  id: string;
  orderId: string;
  dishId: string;
  dish: Dish;              // Snapshot del platillo
  quantity: number;
  unitPrice: number;
  modifiers: AppliedModifier[];
  specialInstructions?: string;
  status: ItemStatus;
  destination: 'KITCHEN' | 'BAR' | 'COLD_STATION';
  preparedBy?: string;     // Staff ID
  preparedAt?: Date;
}

interface AppliedModifier {
  modifierId: string;
  name: string;
  type: 'ADD' | 'REMOVE' | 'SUBSTITUTE';
  price: number;
}

enum OrderStatus {
  DRAFT = 'draft',              // En el carrito
  PENDING = 'pending',          // Enviado pero no confirmado
  CONFIRMED = 'confirmed',      // Confirmado por el sistema
  PREPARING = 'preparing',      // En preparación
  READY = 'ready',              // Listo para servir
  SERVED = 'served',            // Servido en la mesa
  CANCELLED = 'cancelled',      // Cancelado
  COMPLETED = 'completed'       // Completado y pagado
}

enum ItemStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  SERVED = 'served',
  CANCELLED = 'cancelled'
}

interface OrderStatusChange {
  status: OrderStatus;
  timestamp: Date;
  changedBy: string;       // User ID
  reason?: string;
}
```

#### **C. Endpoints**

| Método | Endpoint | Descripción | WebSocket Event |
|--------|----------|-------------|-----------------|
| POST | `/api/orders` | Crear pedido | `order:created` |
| GET | `/api/orders/:id` | Obtener pedido | - |
| GET | `/api/orders/table/:tableId` | Pedidos de mesa | - |
| PUT | `/api/orders/:id/status` | Actualizar estado | `order:status_changed` |
| PUT | `/api/orders/:id/items/:itemId/status` | Actualizar item | `order:item_updated` |
| DELETE | `/api/orders/:id` | Cancelar pedido | `order:cancelled` |
| GET | `/api/orders/:id/track` | Tracking detallado | - |

#### **D. Flujo de Estados**

```
DRAFT → PENDING → CONFIRMED → PREPARING → READY → SERVED → COMPLETED
           ↓          ↓           ↓          ↓       ↓
       CANCELLED  CANCELLED   CANCELLED  CANCELLED (parcial)
```

---

### **4. TABLE SERVICE (Gestión de Mesas)**

#### **A. Estructura**

```
table-service/
├── src/
│   ├── controllers/
│   │   ├── TableController.ts        # CRUD de mesas
│   │   ├── SessionController.ts      # Gestión de sesiones
│   │   └── ZoneController.ts         # Gestión de zonas
│   ├── services/
│   │   ├── TableService.ts           # Lógica de mesas
│   │   ├── SessionService.ts         # Lógica de sesiones
│   │   ├── QRService.ts              # Generación de QR
│   │   └── TableAssignmentService.ts # Asignación de meseros
│   ├── models/
│   │   ├── Table.model.ts            # Modelo de mesa
│   │   ├── TableSession.model.ts     # Modelo de sesión
│   │   └── Zone.model.ts             # Modelo de zona
│   └── routes/
│       └── table.routes.ts           # Rutas de mesas
└── tests/
```

#### **B. Modelo de Mesa**

```typescript
interface Table {
  id: string;
  restaurantId: string;
  tableNumber: string;     // "12", "A5", etc.
  capacity: number;        // Número de personas
  zoneId: string;
  qrCode: string;          // URL o código único
  status: TableStatus;
  currentSessionId?: string;
  assignedWaiterId?: string;
  position: Position;      // Para mapa visual
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Position {
  x: number;
  y: number;
}

enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  CLEANING = 'cleaning',
  OUT_OF_SERVICE = 'out_of_service'
}

interface TableSession {
  id: string;
  tableId: string;
  customerCount: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;       // Minutos
  ordersIds: string[];
  totalAmount: number;
  status: SessionStatus;
  waiterIds: string[];     // Puede tener múltiples meseros
}

enum SessionStatus {
  ACTIVE = 'active',
  WAITING_PAYMENT = 'waiting_payment',
  PAID = 'paid',
  CLOSED = 'closed'
}

interface Zone {
  id: string;
  restaurantId: string;
  name: string;            // "Terraza", "Interior", "VIP"
  tables: Table[];
  assignedWaiters: string[];
}
```

#### **C. Endpoints**

| Método | Endpoint | Descripción | Real-time |
|--------|----------|-------------|-----------|
| GET | `/api/tables` | Listar todas las mesas | ✅ |
| GET | `/api/tables/:id` | Detalle de mesa | ✅ |
| POST | `/api/tables` | Crear mesa | Admin |
| PUT | `/api/tables/:id` | Actualizar mesa | Admin |
| DELETE | `/api/tables/:id` | Eliminar mesa | Admin |
| POST | `/api/tables/:id/session` | Iniciar sesión | ✅ |
| PUT | `/api/tables/:id/session/close` | Cerrar sesión | ✅ |
| GET | `/api/tables/:id/session` | Sesión actual | ✅ |
| POST | `/api/tables/:id/call-waiter` | Llamar mesero | ✅ WebSocket |

---

### **5. PAYMENT SERVICE (Gestión de Pagos)**

#### **A. Estructura**

```
payment-service/
├── src/
│   ├── controllers/
│   │   ├── PaymentController.ts      # Procesamiento de pagos
│   │   ├── InvoiceController.ts      # Generación de facturas
│   │   └── RefundController.ts       # Reembolsos
│   ├── services/
│   │   ├── PaymentService.ts         # Lógica de pagos
│   │   ├── StripeService.ts          # Integración Stripe
│   │   ├── PayPalService.ts          # Integración PayPal
│   │   ├── InvoiceService.ts         # Generación de invoices
│   │   ├── SplitBillService.ts       # División de cuenta
│   │   └── TipService.ts             # Gestión de propinas
│   ├── models/
│   │   ├── Payment.model.ts          # Modelo de pago
│   │   ├── Invoice.model.ts          # Modelo de factura
│   │   └── Refund.model.ts           # Modelo de reembolso
│   └── routes/
│       └── payment.routes.ts         # Rutas de pagos
└── tests/
```

#### **B. Modelo de Pago**

```typescript
interface Payment {
  id: string;
  orderId: string;
  sessionId: string;
  tableId: string;
  amount: number;
  tip: number;
  totalAmount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;  // ID de Stripe/PayPal
  metadata: PaymentMetadata;
  createdAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
}

enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  CRYPTO = 'crypto'
}

enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

interface PaymentMetadata {
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentIntentId?: string;  // Stripe
  last4?: string;            // Últimos 4 dígitos de tarjeta
  brand?: string;            // Visa, Mastercard, etc.
}

interface SplitBill {
  id: string;
  sessionId: string;
  totalAmount: number;
  splits: BillSplit[];
  status: 'pending' | 'partial' | 'completed';
}

interface BillSplit {
  id: string;
  customerId?: string;
  amount: number;
  items: string[];         // IDs de los items
  paymentId?: string;
  status: 'pending' | 'paid';
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  sessionId: string;
  restaurantInfo: RestaurantInfo;
  customerInfo?: CustomerInfo;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  pdfUrl?: string;
  emailedAt?: Date;
  createdAt: Date;
}
```

#### **C. Endpoints**

| Método | Endpoint | Descripción | Integración |
|--------|----------|-------------|-------------|
| POST | `/api/payments/intent` | Crear intent de pago | Stripe |
| POST | `/api/payments/process` | Procesar pago | Stripe/PayPal |
| GET | `/api/payments/:id` | Obtener pago | - |
| POST | `/api/payments/:id/refund` | Reembolsar | Stripe/PayPal |
| POST | `/api/payments/split` | Dividir cuenta | - |
| GET | `/api/payments/session/:sessionId` | Pagos de sesión | - |
| POST | `/api/invoices` | Generar factura | - |
| GET | `/api/invoices/:id/pdf` | Descargar PDF | S3 |
| POST | `/api/invoices/:id/email` | Enviar por email | SES |

---

### **6. KITCHEN SERVICE (Gestión de Cocina)**

#### **A. Estructura**

```
kitchen-service/
├── src/
│   ├── controllers/
│   │   ├── KitchenController.ts      # Gestión de pedidos en cocina
│   │   └── StationController.ts      # Gestión de estaciones
│   ├── services/
│   │   ├── KitchenService.ts         # Lógica de cocina
│   │   ├── OrderPriorityService.ts   # Priorización de pedidos
│   │   ├── TimerService.ts           # Gestión de timers
│   │   └── StationRoutingService.ts  # Routing por estación
│   ├── models/
│   │   ├── KitchenOrder.model.ts     # Modelo de pedido cocina
│   │   └── Station.model.ts          # Modelo de estación
│   └── routes/
│       └── kitchen.routes.ts         # Rutas de cocina
└── tests/
```

#### **B. Modelo de Cocina**

```typescript
interface KitchenOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  items: KitchenOrderItem[];
  priority: Priority;
  status: KitchenStatus;
  station: Station;
  startedAt?: Date;
  estimatedCompletionTime?: Date;
  completedAt?: Date;
  delayReason?: string;
}

interface KitchenOrderItem {
  id: string;
  dishName: string;
  quantity: number;
  modifiers: string[];
  specialInstructions?: string;
  allergyWarnings: Allergen[];
  status: ItemStatus;
  station: StationType;
  prepTime: number;        // Minutos
}

enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

enum KitchenStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  DELAYED = 'delayed'
}

enum StationType {
  GRILL = 'grill',
  FRY = 'fry',
  SAUTE = 'saute',
  SALAD = 'salad',
  DESSERT = 'dessert',
  BAR = 'bar',
  COLD_STATION = 'cold_station'
}

interface Station {
  id: string;
  name: string;
  type: StationType;
  activeOrders: string[];  // IDs de pedidos
  capacity: number;        // Pedidos simultáneos
  currentLoad: number;
  staff: string[];         // IDs de staff asignado
}
```

#### **C. Algoritmo de Priorización**

```typescript
function calculatePriority(order: KitchenOrder): Priority {
  let score = 0;
  
  // Tiempo de espera (más importante)
  const waitTime = Date.now() - order.createdAt.getTime();
  if (waitTime > 20 * 60 * 1000) score += 30;      // >20 min
  else if (waitTime > 15 * 60 * 1000) score += 20; // >15 min
  else if (waitTime > 10 * 60 * 1000) score += 10; // >10 min
  
  // Complejidad del pedido
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (itemCount > 5) score += 5;
  
  // Mesa con clientes esperando hace tiempo
  const tableWaitTime = getTableWaitTime(order.tableId);
  if (tableWaitTime > 45 * 60 * 1000) score += 15;
  
  // Pedidos con alergias (atención especial)
  const hasAllergies = order.items.some(item => item.allergyWarnings.length > 0);
  if (hasAllergies) score += 5;
  
  if (score >= 30) return Priority.URGENT;
  if (score >= 15) return Priority.HIGH;
  if (score >= 5) return Priority.NORMAL;
  return Priority.LOW;
}
```

---

### **7. INVENTORY SERVICE (Gestión de Inventario)**

#### **A. Estructura**

```
inventory-service/
├── src/
│   ├── controllers/
│   │   ├── InventoryController.ts    # CRUD de inventario
│   │   └── StockAlertController.ts   # Alertas de stock
│   ├── services/
│   │   ├── InventoryService.ts       # Lógica de inventario
│   │   ├── StockTrackingService.ts   # Tracking de stock
│   │   ├── PredictionService.ts      # Predicción de demanda
│   │   └── AutoOrderService.ts       # Pedidos automáticos
│   ├── models/
│   │   ├── InventoryItem.model.ts    # Modelo de item
│   │   └── StockMovement.model.ts    # Modelo de movimiento
│   └── routes/
│       └── inventory.routes.ts       # Rutas de inventario
└── tests/
```

#### **B. Modelo de Inventario**

```typescript
interface InventoryItem {
  id: string;
  restaurantId: string;
  name: string;
  sku: string;
  category: InventoryCategory;
  currentStock: number;
  unit: Unit;
  minStock: number;        // Alerta de bajo stock
  maxStock: number;
  reorderPoint: number;    // Punto de reorden automático
  cost: number;            // Costo por unidad
  supplier: Supplier;
  lastRestocked: Date;
  expiryDate?: Date;
  location: string;        // "Refrigerador 1", "Almacén"
}

enum InventoryCategory {
  PRODUCE = 'produce',
  MEAT = 'meat',
  SEAFOOD = 'seafood',
  DAIRY = 'dairy',
  DRY_GOODS = 'dry_goods',
  BEVERAGES = 'beverages',
  CONDIMENTS = 'condiments',
  PACKAGING = 'packaging'
}

enum Unit {
  KG = 'kg',
  G = 'g',
  L = 'l',
  ML = 'ml',
  UNITS = 'units',
  BOXES = 'boxes'
}

interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  unit: Unit;
  reason: string;
  performedBy: string;     // User ID
  orderId?: string;        // Si es por un pedido
  cost?: number;
  timestamp: Date;
}

enum MovementType {
  PURCHASE = 'purchase',   // Compra a proveedor
  USAGE = 'usage',         // Uso en pedido
  WASTE = 'waste',         // Desperdicio
  ADJUSTMENT = 'adjustment', // Ajuste manual
  RETURN = 'return'        // Devolución
}

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  deliveryDays: number;    // Días de entrega
}
```

#### **C. Sistema de Alertas**

```typescript
interface StockAlert {
  id: string;
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  severity: AlertSeverity;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
}

enum AlertSeverity {
  INFO = 'info',           // Stock normal
  WARNING = 'warning',     // Cerca del mínimo
  CRITICAL = 'critical',   // Por debajo del mínimo
  URGENT = 'urgent'        // Stock agotado
}

// Lógica de alertas
function checkStockLevel(item: InventoryItem): StockAlert | null {
  const stockPercentage = (item.currentStock / item.maxStock) * 100;
  
  if (item.currentStock === 0) {
    return createAlert(item, AlertSeverity.URGENT, 
      `¡URGENTE! ${item.name} agotado. Desactivar platillos relacionados.`);
  }
  
  if (item.currentStock < item.minStock) {
    return createAlert(item, AlertSeverity.CRITICAL,
      `Stock crítico de ${item.name}. Ordenar inmediatamente.`);
  }
  
  if (stockPercentage < 30) {
    return createAlert(item, AlertSeverity.WARNING,
      `Stock bajo de ${item.name}. Considerar reorden.`);
  }
  
  return null;
}
```

---

### **8. USER SERVICE (Gestión de Usuarios)**

#### **A. Estructura**

```
user-service/
├── src/
│   ├── controllers/
│   │   ├── UserController.ts         # CRUD de usuarios
│   │   ├── StaffController.ts        # Gestión de staff
│   │   └── CustomerController.ts     # Gestión de clientes
│   ├── services/
│   │   ├── UserService.ts            # Lógica de usuarios
│   │   ├── ProfileService.ts         # Gestión de perfiles
│   │   └── LoyaltyService.ts         # Programa de lealtad
│   ├── models/
│   │   ├── User.model.ts             # Modelo de usuario
│   │   ├── Staff.model.ts            # Modelo de staff
│   │   └── Customer.model.ts         # Modelo de cliente
│   └── routes/
│       └── user.routes.ts            # Rutas de usuarios
└── tests/
```

#### **B. Modelo de Usuario**

```typescript
interface User {
  id: string;
  email: string;
  phone?: string;
  password: string;        // Hashed
  firstName: string;
  lastName: string;
  avatar?: string;
  role: Role;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Staff extends User {
  employeeId: string;
  position: string;
  departmentrestaurantId: string;
  hireDate: Date;
  salary?: number;
  schedule: WorkSchedule;
  permissions: Permission[];
  assignedZones?: string[];  // Para meseros
  totalTips?: number;
}

interface Customer extends User {
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: number;
  favoriteDiszes: string[];
  dietaryPreferences: DietaryPreference[];
  allergens: Allergen[];
  preferredPaymentMethod?: PaymentMethod;
  tier: CustomerTier;
}

enum CustomerTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum'
}

interface WorkSchedule {
  monday?: Shift;
  tuesday?: Shift;
  wednesday?: Shift;
  thursday?: Shift;
  friday?: Shift;
  saturday?: Shift;
  sunday?: Shift;
}

interface Shift {
  start: string;           // "09:00"
  end: string;             // "17:00"
  break?: number;          // Minutos de break
}
```

---

### **9. ANALYTICS SERVICE (Análisis y Reportes)**

#### **A. Estructura**

```
analytics-service/
├── src/
│   ├── controllers/
│   │   ├── SalesAnalyticsController.ts
│   │   ├── DishAnalyticsController.ts
│   │   └── CustomerAnalyticsController.ts
│   ├── services/
│   │   ├── SalesReportService.ts     # Reportes de ventas
│   │   ├── DishPerformanceService.ts # Performance de platillos
│   │   ├── TableAnalyticsService.ts  # Analytics de mesas
│   │   └── PredictiveAnalyticsService.ts # Predicciones
│   ├── models/
│   │   └── Analytics.model.ts        # Modelos de analytics
│   └── routes/
│       └── analytics.routes.ts       # Rutas de analytics
└── tests/
```

#### **B. Métricas Clave**

```typescript
interface SalesMetrics {
  period: DateRange;
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  topSellingDishes: DishMetric[];
  revenueByCategory: CategoryRevenue[];
  revenueByHour: HourlyRevenue[];
  revenueByDayOfWeek: DailyRevenue[];
  paymentMethodBreakdown: PaymentMethodStats[];
}

interface DishMetric {
  dishId: string;
  dishName: string;
  quantitySold: number;
  revenue: number;
  averageRating: number;
  profit: number;
  profitMargin: number;
}

interface TableMetrics {
  period: DateRange;
  averageTurnover: number;  // Mesas por día
  averageDuration: number;  // Minutos por mesa
  peakHours: PeakHour[];
  occupancyRate: number;    // %
  tableUtilization: TableUtilization[];
}

interface CustomerMetrics {
  period: DateRange;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageVisitFrequency: number;
  customerLifetimeValue: number;
  churnRate: number;
}
```

---

### **10. NOTIFICATION SERVICE (Sistema de Notificaciones)**

#### **A. Estructura**

```
notification-service/
├── src/
│   ├── controllers/
│   │   └── NotificationController.ts  # Envío de notificaciones
│   ├── services/
│   │   ├── NotificationService.ts     # Lógica de notificaciones
│   │   ├── WebSocketService.ts        # WebSocket server
│   │   ├── EmailService.ts            # Envío de emails
│   │   ├── SMSService.ts              # Envío de SMS
│   │   └── PushService.ts             # Push notifications
│   ├── models/
│   │   └── Notification.model.ts      # Modelo de notificación
│   └── routes/
│       └── notification.routes.ts     # Rutas de notificaciones
└── tests/
```

#### **B. Tipos de Notificaciones**

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  recipient: Recipient;
  title: string;
  message: string;
  data?: any;              // Data adicional
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: NotificationStatus;
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

enum NotificationType {
  // Para clientes
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_PREPARING = 'order_preparing',
  ORDER_READY = 'order_ready',
  ORDER_SERVED = 'order_served',
  PAYMENT_RECEIVED = 'payment_received',
  
  // Para meseros
  TABLE_ASSIGNED = 'table_assigned',
  CUSTOMER_CALLING = 'customer_calling',
  ORDER_READY_TO_SERVE = 'order_ready_to_serve',
  PAYMENT_REQUESTED = 'payment_requested',
  
  // Para cocina
  NEW_ORDER = 'new_order',
  ORDER_DELAYED = 'order_delayed',
  ORDER_CANCELLED = 'order_cancelled',
  
  // Para gerentes
  LOW_STOCK = 'low_stock',
  HIGH_WAIT_TIME = 'high_wait_time',
  SHIFT_ENDING = 'shift_ending',
  SYSTEM_ALERT = 'system_alert'
}

enum NotificationChannel {
  WEBSOCKET = 'websocket',   // Tiempo real en la app
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',             // Push notification
  IN_APP = 'in_app'          // Notificación in-app
}

enum NotificationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3
}

interface Recipient {
  userId?: string;
  role?: Role;
  email?: string;
  phone?: string;
  deviceTokens?: string[];   // Para push notifications
}
```

#### **C. WebSocket Events**

```typescript
// Events del servidor hacia cliente
enum ServerEvent {
  // Órdenes
  'order:created',
  'order:updated',
  'order:status_changed',
  'order:cancelled',
  
  // Mesas
  'table:updated',
  'table:call_waiter',
  'table:session_started',
  'table:session_closed',
  
  // Cocina
  'kitchen:order_received',
  'kitchen:order_ready',
  'kitchen:order_delayed',
  
  // Pagos
  'payment:processing',
  'payment:completed',
  'payment:failed',
  
  // Generales
  'notification:new',
  'system:alert'
}

// Events del cliente hacia servidor
enum ClientEvent {
  'order:place',
  'order:track',
  'table:call_waiter',
  'payment:initiate',
  'kitchen:update_status'
}
```

---

## **💾 CAPA DE DATOS**

### **MODELO DE BASE DE DATOS RELACIONAL (PostgreSQL)**

#### **Diagrama ER Simplificado**

```
restaurants
├── id (PK)
├── name
├── address
└── settings (JSONB)

users
├── id (PK)
├── email (UNIQUE)
├── password_hash
├── role
└── restaurant_id (FK)

tables
├── id (PK)
├── restaurant_id (FK)
├── table_number
├── capacity
├── zone_id (FK)
├── qr_code
└── status

table_sessions
├── id (PK)
├── table_id (FK)
├── customer_count
├── start_time
├── end_time
└── status

orders
├── id (PK)
├── order_number
├── table_id (FK)
├── session_id (FK)
├── subtotal
├── tax
├── tip
├── total
├── status
└── created_at

order_items
├── id (PK)
├── order_id (FK)
├── dish_id (FK)
├── quantity
├── unit_price
├── modifiers (JSONB)
├── status
└── destination

menus
├── id (PK)
├── restaurant_id (FK)
├── name
├── is_active
└── schedule (JSONB)

categories
├── id (PK)
├── menu_id (FK)
├── name
├── icon
└── order

dishes
├── id (PK)
├── category_id (FK)
├── name
├── description
├── price
├── images (JSONB)
├── preparation_time
├── nutritional_info (JSONB)
├── tags (JSONB)
└── is_available

modifiers
├── id (PK)
├── dish_id (FK)
├── name
├── type
└── options (JSONB)

ingredients
├── id (PK)
├── name
├── inventory_id (FK)

dish_ingredients
├── dish_id (FK)
├── ingredient_id (FK)
├── quantity
└── unit

inventory_items
├── id (PK)
├── restaurant_id (FK)
├── name
├── sku
├── current_stock
├── unit
├── min_stock
├── cost
└── supplier (JSONB)

stock_movements
├── id (PK)
├── item_id (FK)
├── type
├── quantity
├── reason
├── performed_by (FK)
└── timestamp

payments
├── id (PK)
├── order_id (FK)
├── session_id (FK)
├── amount
├── tip
├── method
├── status
├── transaction_id
└── metadata (JSONB)

invoices
├── id (PK)
├── invoice_number
├── payment_id (FK)
├── pdf_url
└── created_at

notifications
├── id (PK)
├── type
├── recipient_id (FK)
├── title
├── message
├── data (JSONB)
├── channels (ARRAY)
├── status
└── created_at

analytics_events
├── id (PK)
├── event_type
├── entity_id
├── data (JSONB)
└── timestamp
```

---

### **ESQUEMA REDIS (Caché)**

```typescript
// Estructura de keys en Redis

// 1. Caché de menú (TTL: 5 minutos)
`menu:${restaurantId}` → Menu completo (JSON)
`menu:${restaurantId}:dishes` → Lista de platillos (JSON)
`dish:${dishId}` → Detalle de platillo (JSON)

// 2. Sesiones activas de mesas (TTL: 24 horas)
`table:${tableId}:session` → Session actual (JSON)
`table:${tableId}:orders` → Lista de order IDs (SET)

// 3. Órdenes en tiempo real (TTL: 2 horas)
`order:${orderId}` → Order completa (JSON)
`kitchen:orders:pending` → Cola de órdenes pendientes (SORTED SET por timestamp)
`kitchen:orders:preparing` → Órdenes en preparación (SORTED SET)

// 4. Rate limiting
`ratelimit:${userId}:${endpoint}` → Contador de requests (TTL: 1 minuto)

// 5. WebSocket connections
`ws:connections:${userId}` → Lista de socket IDs (SET)
`ws:room:table:${tableId}` → Usuarios conectados a mesa (SET)
`ws:room:kitchen` → Usuarios conectados a cocina (SET)

// 6. Disponibilidad de platillos (TTL: 1 hora)
`dish:${dishId}:available` → Boolean
`inventory:low_stock` → Set de item IDs con stock bajo

// 7. Analytics en tiempo real (TTL: 5 minutos)
`analytics:${restaurantId}:today` → Métricas del día (HASH)
`analytics:${restaurantId}:active_tables` → Contador (STRING)
```

---

## **🔄 FLUJOS OPERACIONALES COMPLETOS**

### **FLUJO 1: Cliente Escanea QR y Hace Pedido**

```
┌──────────────┐
│   CLIENTE    │
└──────┬───────┘
       │ 1. Escanea QR
       ↓
┌──────────────────────────────────────────┐
│  QR Code: https://menu.app/t/12/s/abc123 │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         FRONTEND (Cliente App)           │
├──────────────────────────────────────────┤
│ 2. Extrae: tableId=12, sessionId=abc123 │
│ 3. GET /api/tables/12/session           │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        TABLE SERVICE (Backend)           │
├──────────────────────────────────────────┤
│ 4. Valida sesión activa                 │
│ 5. Retorna: { table: 12, session: {...}}│
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         FRONTEND (Cliente App)           │
├──────────────────────────────────────────┤
│ 6. GET /api/menu                         │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         MENU SERVICE (Backend)           │
├──────────────────────────────────────────┤
│ 7. Cache hit en Redis? → Return          │
│ 8. Cache miss? → Query PostgreSQL        │
│ 9. Store en Redis (TTL: 5min)           │
│ 10. Return menú completo                 │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         FRONTEND (Cliente App)           │
├──────────────────────────────────────────┤
│ 11. Cliente navega menú                  │
│ 12. Agrega items al carrito (local)     │
│ 13. Confirma pedido                      │
│ 14. POST /api/orders                     │
│     Body: {                              │
│       tableId: 12,                       │
│       sessionId: "abc123",               │
│       items: [...],                      │
│       specialInstructions: "..."         │
│     }                                    │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        ORDER SERVICE (Backend)           │
├──────────────────────────────────────────┤
│ 15. Valida items contra menú            │
│ 16. Calcula precios                      │
│ 17. Verifica disponibilidad              │
│ 18. Crea order en PostgreSQL             │
│ 19. Store en Redis para tracking        │
│ 20. Emite evento: 'order:created'       │
└──────────────────────────────────────────┘
       │
       ├──────────────────┬────────────────┬──────────────────┐
       ↓                  ↓                ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   CLIENTE    │  │    MESERO    │  │    COCINA    │  │  INVENTORY   │
│   WebSocket  │  │   WebSocket  │  │   WebSocket  │  │   SERVICE    │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│ Notif:       │  │ Notif:       │  │ Orden        │  │ Reduce stock │
│ "Pedido      │  │ "Mesa 12     │  │ aparece en   │  │ de           │
│ confirmado"  │  │ nuevo pedido"│  │ KDS          │  │ ingredientes │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

### **FLUJO 2: Cocina Prepara y Sirve Pedido**

```
┌──────────────────────────────────────────┐
│          KDS (Kitchen Display)           │
├──────────────────────────────────────────┤
│ 1. Orden aparece en cola                 │
│ 2. Chef acepta orden                     │
│ 3. PUT /api/kitchen/orders/:id/start     │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        KITCHEN SERVICE (Backend)         │
├──────────────────────────────────────────┤
│ 4. Actualiza status: PREPARING           │
│ 5. Inicia timer                          │
│ 6. Emite: 'order:status_changed'         │
└──────────────────────────────────────────┘
       │
       ├──────────────────┬─────────────────┐
       ↓                  ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   CLIENTE    │  │    MESERO    │  │  ORDER SVC   │
│   WebSocket  │  │   WebSocket  │  ├──────────────┤
├──────────────┤  ├──────────────┤  │ Actualiza DB │
│ "Tu pedido   │  │ "Mesa 12     │  │ y Redis      │
│ está siendo  │  │ en prepara   │  └──────────────┘
│ preparado"   │  │ ción"        │
└──────────────┘  └──────────────┘
       
       ... Chef cocina ...
       
┌──────────────────────────────────────────┐
│          KDS (Kitchen Display)           │
├──────────────────────────────────────────┤
│ 7. Chef termina platillo                 │
│ 8. Presiona "LISTO"                      │
│ 9. PUT /api/kitchen/orders/:id/ready     │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        KITCHEN SERVICE (Backend)         │
├──────────────────────────────────────────┤
│ 10. Actualiza status: READY              │
│ 11. Calcula tiempo real de prep         │
│ 12. Emite: 'kitchen:order_ready'        │
└──────────────────────────────────────────┘
       │
       ├──────────────────┬─────────────────┐
       ↓                  ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   CLIENTE    │  │  MESERO/     │  │   METRICS    │
│   WebSocket  │  │   RUNNER     │  ├──────────────┤
├──────────────┤  ├──────────────┤  │ Registra     │
│ "Tu pedido   │  │ 🔔 ALERTA:   │  │ tiempo de    │
│ está listo,  │  │ "Mesa 12     │  │ preparación  │
│ el mesero lo │  │ pedido listo │  │ para         │
│ traerá pronto│  │ para servir" │  │ analytics    │
└──────────────┘  └──────────────┘  └──────────────┘
       
┌──────────────────────────────────────────┐
│        MESERO APP (Smartphone)           │
├──────────────────────────────────────────┤
│ 13. Mesero va a cocina                   │
│ 14. Recoge platillos                     │
│ 15. Lleva a mesa 12                      │
│ 16. PUT /api/orders/:id/items/:itemId/   │
│         served                           │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        ORDER SERVICE (Backend)           │
├──────────────────────────────────────────┤
│ 17. Actualiza item status: SERVED        │
│ 18. Si todos served → Order: SERVED      │
│ 19. Emite: 'order:served'                │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         CLIENTE (WebSocket)              │
├──────────────────────────────────────────┤
│ 20. "¡Buen provecho! ¿Cómo está todo?" │
│ 21. [Botón: Llamar mesero]              │
│ 22. [Botón: Pedir más]                  │
└──────────────────────────────────────────┘
```

---

### **FLUJO 3: Cliente Paga la Cuenta**

```
┌──────────────────────────────────────────┐
│         CLIENTE APP (Frontend)           │
├──────────────────────────────────────────┤
│ 1. Cliente presiona "Solicitar cuenta"   │
│ 2. GET /api/tables/:tableId/bill         │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│        TABLE SERVICE (Backend)           │
├──────────────────────────────────────────┤
│ 3. Obtiene sesión actual                 │
│ 4. Obtiene todas las órdenes             │
│ 5. Calcula total                         │
│ 6. Return resumen detallado              │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         CLIENTE APP (Frontend)           │
├──────────────────────────────────────────┤
│ 7. Muestra resumen:                      │
│    - Subtotal: $250                      │
│    - Tax (16%): $40                      │
│    - Propina: [10% | 15% | 20% | Custom]│
│ 8. Cliente selecciona propina: 15% ($37.50)│
│ 9. Total: $327.50                        │
│ 10. Selecciona método: Tarjeta          │
│ 11. POST /api/payments/intent            │
│     Body: {                              │
│       sessionId: "abc123",               │
│       amount: 327.50,                    │
│       method: "card"                     │
│     }                                    │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│       PAYMENT SERVICE (Backend)          │
├──────────────────────────────────────────┤
│ 12. Crea Payment Intent en Stripe       │
│ 13. Return client_secret                │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│         CLIENTE APP (Frontend)           │
├──────────────────────────────────────────┤
│ 14. Muestra Stripe Payment Element       │
│ 15. Cliente ingresa datos de tarjeta    │
│ 16. stripe.confirmPayment()              │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│            STRIPE (External)             │
├──────────────────────────────────────────┤
│ 17. Procesa pago                         │
│ 18. Webhook: payment_intent.succeeded    │
└──────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│       PAYMENT SERVICE (Backend)          │
├──────────────────────────────────────────┤
│ 19. Recibe webhook de Stripe            │
│ 20. Verifica signature                   │
│ 21. Actualiza Payment: COMPLETED         │
│ 22. Emite: 'payment:completed'           │
└──────────────────────────────────────────┘
       │
       ├──────────────────┬─────────────────┬──────────────────┐
       ↓                  ↓                 ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  TABLE SVC   │  │   INVOICE    │  │    MESERO    │  │  ANALYTICS   │
├──────────────┤  │   SERVICE    │  │   WebSocket  │  ├──────────────┤
│ Cierra       │  ├──────────────┤  ├──────────────┤  │ Registra     │
│ sesión de    │  │ Genera       │  │ "Mesa 12     │  │ venta para   │
│ mesa         │  │ factura PDF  │  │ pagó, lista  │  │ reportes     │
│              │  │              │  │ para limpiar"│  │              │
│ Status:      │  │ POST email   │  └──────────────┘  └──────────────┘
│ AVAILABLE    │  │ al cliente   │
└──────────────┘  └──────────────┘
       │                  │
       ↓                  ↓
┌──────────────┐  ┌──────────────┐
│   CLIENTE    │  │    S3 + SES  │
│   WebSocket  │  ├──────────────┤
├──────────────┤  │ PDF → S3     │
│ "¡Gracias!   │  │ Email enviado│
│ Recibo       │  │ con PDF      │
│ enviado por  │  └──────────────┘
│ email"       │
│              │
│ [Descargar   │
│  Recibo]     │
└──────────────┘
```

---

## **🔗 CORRELACIONES Y DEPENDENCIAS**

### **Matriz de Dependencias entre Servicios**

| Servicio | Depende de | Es usado por |
|----------|-----------|--------------|
| **Auth Service** | - PostgreSQL<br>- Redis (sessions) | Todos los servicios |
| **Menu Service** | - PostgreSQL<br>- Redis (cache)<br>- S3 (images) | - Order Service<br>- Analytics Service |
| **Order Service** | - Menu Service<br>- Table Service<br>- Kitchen Service<br>- Inventory Service<br>- PostgreSQL<br>- Redis | - Payment Service<br>- Analytics Service<br>- Notification Service |
| **Table Service** | - PostgreSQL<br>- Redis | - Order Service<br>- Payment Service |
| **Payment Service** | - Order Service<br>- Table Service<br>- Stripe API<br>- PostgreSQL | - Invoice Service<br>- Analytics Service |
| **Kitchen Service** | - Order Service<br>- PostgreSQL<br>- Redis<br>- WebSocket | - Notification Service<br>- Analytics Service |
| **Inventory Service** | - Order Service<br>- Menu Service<br>- PostgreSQL | - Analytics Service<br>- Notification Service |
| **User Service** | - Auth Service<br>- PostgreSQL | Todos los servicios |
| **Analytics Service** | Todos los servicios | - Admin Panel |
| **Notification Service** | - WebSocket Server<br>- SES (email)<br>- SNS (SMS)<br>- FCM (push) | Todos los servicios |

---

### **Flujo de Datos entre Capas**

```
PRESENTACIÓN
    ↓ HTTP Request (JSON)
API GATEWAY
    ↓ Validación + Auth
    ↓ Route a servicio específico
APLICACIÓN/NEGOCIO
    ↓ Business Logic
    ↓ Data Access Layer
DATOS
    ↓ Query/Update
    ↓ Return data
APLICACIÓN/NEGOCIO
    ↓ Transform + Serialize
API GATEWAY
    ↓ HTTP Response (JSON)
PRESENTACIÓN
```

---

## **🛠️ STACK TECNOLÓGICO DETALLADO**

### **Frontend**

| Tecnología | Uso | Versión |
|------------|-----|---------|
| **React.js** | Framework principal | 18.x |
| **Next.js** | SSR + Routing | 14.x |
| **TypeScript** | Type safety | 5.x |
| **Tailwind CSS** | Styling | 3.x |
| **Redux Toolkit** | State management | 2.x |
| **React Query** | Data fetching + cache | 5.x |
| **Socket.IO Client** | WebSocket | 4.x |
| **Stripe Elements** | Payment UI | Latest |
| **Framer Motion** | Animations | 11.x |
| **React Hook Form** | Forms | 7.x |
| **Zod** | Validation | 3.x |
| **Recharts** | Charts (Admin) | 2.x |

### **Backend**

| Tecnología | Uso | Versión |
|------------|-----|---------|
| **Node.js** | Runtime | 20.x LTS |
| **NestJS** | Framework | 10.x |
| **TypeScript** | Type safety | 5.x |
| **Express** | HTTP server | 4.x |
| **Socket.IO** | WebSocket server | 4.x |
| **TypeORM** | ORM | 0.3.x |
| **Bull** | Job queues | 4.x |
| **Joi** | Validation | 17.x |

### **Base de Datos**

| Tecnología | Uso | Versión |
|------------|-----|---------|
| **PostgreSQL** | Base de datos principal | 16.x |
| **Redis** | Cache + Sessions + Queues | 7.x |
| **MongoDB** | Logs + Analytics events | 7.x |

### **Infraestructura**

| Tecnología | Uso |
|------------|-----|
| **Docker** | Containerización |
| **Docker Compose** | Orquestación local |
| **Kubernetes** | Orquestación producción |
| **Nginx** | Reverse proxy + Load balancer |
| **AWS S3** | Almacenamiento de archivos |
| **AWS CloudFront** | CDN |
| **AWS RDS** | PostgreSQL managed |
| **AWS ElastiCache** | Redis managed |
| **AWS SES** | Email service |
| **AWS SNS** | SMS + Push notifications |

### **Servicios Externos**

| Servicio | Uso |
|----------|-----|
| **Stripe** | Procesamiento de pagos |
| **Twilio** | SMS (alternativa a SNS) |
| **SendGrid** | Email (alternativa a SES) |
| **Firebase Cloud Messaging** | Push notifications |
| **Cloudinary** | Image optimization |

### **Desarrollo y DevOps**

| Tecnología | Uso |
|------------|-----|
| **Git** | Control de versiones |
| **GitHub Actions** | CI/CD |
| **ESLint** | Linting |
| **Prettier** | Code formatting |
| **Jest** | Unit testing |
| **Cypress** | E2E testing |
| **Swagger** | API documentation |
| **Postman** | API testing |
| **DataDog** | Monitoring |
| **Sentry** | Error tracking |

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**Autor:** Smart Menu Team
