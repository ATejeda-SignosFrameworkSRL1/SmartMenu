# 📊 RESUMEN DE COMPONENTES Y CORRELACIONES DEL SISTEMA

## **🎯 VISTA GENERAL**

Este documento proporciona un resumen visual y organizado de todos los componentes del sistema Smart Menu y sus interrelaciones.

---

## **🏗️ ARQUITECTURA EN 5 CAPAS**

### **Resumen de Capas**

| # | Capa | Componentes Principales | Tecnologías Clave |
|---|------|------------------------|-------------------|
| **1** | **Presentación** | 4 aplicaciones frontend | React, Next.js, TypeScript, Tailwind |
| **2** | **API Gateway** | Auth, Rate Limiting, Load Balancing | Nginx, Express, JWT |
| **3** | **Aplicación/Negocio** | 10 microservicios | NestJS, Node.js, TypeScript |
| **4** | **Datos** | 3 bases de datos + Storage | PostgreSQL, Redis, MongoDB, S3 |
| **5** | **Infraestructura** | Containers, Proxy, CDN, Queues | Docker, Kubernetes, AWS |

---

## **📱 CAPA 1: APLICACIONES FRONTEND**

### **1.1 Cliente Web App (PWA)**

```
PROPÓSITO: App que usan los clientes para ver menú y hacer pedidos
USUARIOS: Clientes del restaurante
ACCESO: Escaneo de QR en la mesa
```

**Módulos Principales:**
- 🏠 Home & Session Management
- 📖 Menu Browser (Categorías, Platillos, Búsqueda)
- 🛒 Shopping Cart
- 📦 Order Tracking (Tiempo real)
- 💳 Payment & Checkout
- 🧾 Receipt & Invoice

**APIs que consume:**
- `GET /api/menu` - Obtener menú
- `GET /api/tables/:id/session` - Sesión de mesa
- `POST /api/orders` - Crear pedido
- `GET /api/orders/:id/track` - Tracking
- `POST /api/payments/process` - Procesar pago

**WebSocket Events (recibe):**
- `order:status_changed` - Cambio de estado
- `order:ready` - Pedido listo
- `notification:new` - Notificaciones generales

---

### **1.2 Mesero Mobile App**

```
PROPÓSITO: App para meseros gestionar sus mesas y pedidos
USUARIOS: Meseros, Runners
ACCESO: Login con credenciales
```

**Módulos Principales:**
- 📊 Dashboard de Mesas
- 🔔 Notification Center
- 📝 Manual Order Entry (backup)
- ✅ Order Status Management
- 💰 Bill Management

**APIs que consume:**
- `GET /api/waiter/tables` - Mesas asignadas
- `GET /api/tables/:id` - Detalle de mesa
- `POST /api/orders` - Crear pedido manual
- `PUT /api/orders/:id/delivered` - Marcar entregado
- `GET /api/tables/:id/bill` - Obtener cuenta

**WebSocket Events (recibe):**
- `table:call_waiter` - Cliente llama
- `order:ready` - Pedido listo para servir
- `table:assigned` - Nueva mesa asignada

---

### **1.3 Kitchen Display System (KDS)**

```
PROPÓSITO: Sistema de pantalla para cocina y bar
USUARIOS: Chef, Cocineros, Bartenders
ACCESO: Pantalla dedicada en cocina/bar
```

**Módulos Principales:**
- 🍳 Kitchen Board (Vista principal)
- 📋 Order Queue (Cola priorizada)
- 🎯 Station View (Por estación)
- ⏱️ Timer Management
- 🚨 Allergy Alerts

**APIs que consume:**
- `GET /api/kitchen/orders` - Órdenes activas
- `PUT /api/kitchen/orders/:id/start` - Iniciar preparación
- `PUT /api/kitchen/orders/:id/ready` - Marcar listo
- `PUT /api/kitchen/orders/:id/delay` - Reportar retraso

**WebSocket Events (recibe):**
- `kitchen:order_received` - Nuevo pedido
- `order:cancelled` - Pedido cancelado

**WebSocket Events (emite):**
- `kitchen:order_ready` - Pedido listo
- `kitchen:order_delayed` - Pedido retrasado

---

### **1.4 Admin Dashboard (Web)**

```
PROPÓSITO: Panel de administración completo
USUARIOS: Administradores, Gerentes
ACCESO: Login con credenciales de admin
```

**Módulos Principales:**
- 📊 Real-time Dashboard
- 🍽️ Menu Management (CRUD)
- 🪑 Table Management
- 📦 Order History
- 📈 Analytics & Reports
- 👥 Staff Management
- 🏪 Inventory Management
- ⚙️ Settings

**APIs que consume:**
- Todos los endpoints (admin tiene acceso completo)

---

## **⚙️ CAPA 2: API GATEWAY**

### **Responsabilidades**

```
┌─────────────────────────────────────────┐
│           API GATEWAY                   │
├─────────────────────────────────────────┤
│  ✓ Autenticación (JWT)                 │
│  ✓ Rate Limiting                        │
│  ✓ Load Balancing                       │
│  ✓ Request Validation                   │
│  ✓ CORS Handling                        │
│  ✓ Request/Response Logging             │
│  ✓ Error Handling                       │
│  ✓ API Versioning                       │
└─────────────────────────────────────────┘
```

**Rutas:**
```
/api/auth/*       → Auth Service
/api/menu/*       → Menu Service
/api/orders/*     → Order Service
/api/tables/*     → Table Service
/api/payments/*   → Payment Service
/api/kitchen/*    → Kitchen Service
/api/inventory/*  → Inventory Service
/api/users/*      → User Service
/api/analytics/*  → Analytics Service
/ws/*             → WebSocket Server
```

---

## **🔧 CAPA 3: MICROSERVICIOS (10 SERVICIOS)**

### **Mapa de Microservicios**

```
                    ┌─────────────────┐
                    │   API GATEWAY   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
    │  Auth   │         │  Menu   │        │  Order  │
    │ Service │         │ Service │        │ Service │
    └─────────┘         └─────────┘        └────┬────┘
                                                 │
         ┌───────────────────┬───────────────────┼───────────────┐
         │                   │                   │               │
    ┌────▼────┐         ┌────▼────┐        ┌────▼────┐    ┌────▼────┐
    │  Table  │         │ Payment │        │ Kitchen │    │Inventory│
    │ Service │         │ Service │        │ Service │    │ Service │
    └─────────┘         └─────────┘        └─────────┘    └─────────┘
         
         ┌───────────────────┬───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
    │  User   │         │Analytics│        │  Notif  │
    │ Service │         │ Service │        │ Service │
    └─────────┘         └─────────┘        └─────────┘
```

---

### **3.1 AUTH SERVICE**

**Responsabilidad:** Autenticación y autorización

| Componente | Función |
|------------|---------|
| **Controllers** | AuthController, RoleController |
| **Services** | AuthService, TokenService, PermissionService |
| **Middleware** | authenticate, authorize, rateLimiter |
| **Models** | User, Role, Permission |

**Endpoints Clave:**
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Usuario actual

**Base de Datos:**
- PostgreSQL: users, roles, permissions, role_permissions

**Cache:**
- Redis: sessions, tokens

---

### **3.2 MENU SERVICE**

**Responsabilidad:** Gestión del menú digital

| Componente | Función |
|------------|---------|
| **Controllers** | MenuController, CategoryController, DishController, ModifierController |
| **Services** | MenuService, AvailabilityService, PricingService, RecommendationService |
| **Models** | Menu, Category, Dish, Modifier, Ingredient |

**Endpoints Clave:**
- `GET /api/menu` - Menú completo (cached)
- `GET /api/menu/dishes/:id` - Detalle de platillo
- `POST /api/menu/dishes` - Crear platillo (Admin)
- `PATCH /api/menu/dishes/:id/availability` - Actualizar disponibilidad

**Base de Datos:**
- PostgreSQL: menus, categories, dishes, modifiers, ingredients
- S3: Imágenes de platillos

**Cache:**
- Redis: Menú completo (TTL: 5min), Platillos individuales (TTL: 10min)

**Eventos Emitidos:**
- `menu:updated` - Menú actualizado
- `dish:unavailable` - Platillo no disponible

---

### **3.3 ORDER SERVICE** ⭐ (Servicio Central)

**Responsabilidad:** Gestión de pedidos de principio a fin

| Componente | Función |
|------------|---------|
| **Controllers** | OrderController, OrderStatusController |
| **Services** | OrderService, OrderValidationService, OrderRoutingService, OrderTrackingService |
| **Workers** | orderProcessor, orderNotifier |
| **Models** | Order, OrderItem, OrderStatus |

**Endpoints Clave:**
- `POST /api/orders` - Crear pedido
- `GET /api/orders/:id` - Obtener pedido
- `PUT /api/orders/:id/status` - Actualizar estado
- `GET /api/orders/:id/track` - Tracking en tiempo real

**Base de Datos:**
- PostgreSQL: orders, order_items, order_status_history

**Cache:**
- Redis: Órdenes activas para tracking rápido

**Eventos Emitidos:**
- `order:created` → Cocina, Mesero, Cliente, Inventory
- `order:status_changed` → Cliente, Mesero, Cocina
- `order:completed` → Analytics, Payment

**Eventos Escuchados:**
- `payment:completed` → Cerrar orden

**Dependencias:**
- Menu Service (validar platillos)
- Table Service (validar mesa)
- Kitchen Service (enviar a cocina)
- Inventory Service (reducir stock)

---

### **3.4 TABLE SERVICE**

**Responsabilidad:** Gestión de mesas y sesiones

| Componente | Función |
|------------|---------|
| **Controllers** | TableController, SessionController, ZoneController |
| **Services** | TableService, SessionService, QRService, TableAssignmentService |
| **Models** | Table, TableSession, Zone |

**Endpoints Clave:**
- `GET /api/tables` - Listar mesas
- `POST /api/tables/:id/session` - Iniciar sesión
- `PUT /api/tables/:id/session/close` - Cerrar sesión
- `POST /api/tables/:id/call-waiter` - Llamar mesero

**Base de Datos:**
- PostgreSQL: tables, table_sessions, zones

**Cache:**
- Redis: Sesiones activas

**Eventos Emitidos:**
- `table:session_started` → Order Service
- `table:call_waiter` → Mesero
- `table:status_changed` → Host, Admin

---

### **3.5 PAYMENT SERVICE**

**Responsabilidad:** Procesamiento de pagos y facturación

| Componente | Función |
|------------|---------|
| **Controllers** | PaymentController, InvoiceController, RefundController |
| **Services** | PaymentService, StripeService, InvoiceService, SplitBillService, TipService |
| **Models** | Payment, Invoice, Refund |

**Endpoints Clave:**
- `POST /api/payments/intent` - Crear intent (Stripe)
- `POST /api/payments/process` - Procesar pago
- `POST /api/payments/split` - Dividir cuenta
- `GET /api/invoices/:id/pdf` - Descargar factura

**Base de Datos:**
- PostgreSQL: payments, invoices, refunds

**Integraciones Externas:**
- **Stripe API:** Procesamiento de pagos con tarjeta
- **PayPal API:** Pagos con PayPal
- **AWS S3:** Almacenar PDFs de facturas
- **AWS SES:** Enviar facturas por email

**Eventos Emitidos:**
- `payment:completed` → Order Service, Table Service
- `payment:failed` → Cliente, Admin

**Eventos Escuchados:**
- `order:completed` → Generar factura

---

### **3.6 KITCHEN SERVICE**

**Responsabilidad:** Gestión de pedidos en cocina

| Componente | Función |
|------------|---------|
| **Controllers** | KitchenController, StationController |
| **Services** | KitchenService, OrderPriorityService, TimerService, StationRoutingService |
| **Models** | KitchenOrder, Station |

**Endpoints Clave:**
- `GET /api/kitchen/orders` - Órdenes activas
- `PUT /api/kitchen/orders/:id/start` - Iniciar preparación
- `PUT /api/kitchen/orders/:id/ready` - Marcar listo

**Base de Datos:**
- PostgreSQL: kitchen_orders, stations
- Redis: Cola de órdenes, Timers

**Algoritmo de Priorización:**
```
Priority Score = 
  + (Tiempo de espera * 3)
  + (Complejidad del pedido * 1)
  + (Tiempo en mesa * 2)
  + (Alergias presentes * 5)
```

**Eventos Emitidos:**
- `kitchen:order_ready` → Mesero, Cliente
- `kitchen:order_delayed` → Mesero, Gerente

**Eventos Escuchados:**
- `order:created` → Recibir nuevo pedido

---

### **3.7 INVENTORY SERVICE**

**Responsabilidad:** Control de inventario y stock

| Componente | Función |
|------------|---------|
| **Controllers** | InventoryController, StockAlertController |
| **Services** | InventoryService, StockTrackingService, PredictionService, AutoOrderService |
| **Models** | InventoryItem, StockMovement |

**Endpoints Clave:**
- `GET /api/inventory` - Listar inventario
- `POST /api/inventory/movement` - Registrar movimiento
- `GET /api/inventory/alerts` - Alertas de stock bajo

**Base de Datos:**
- PostgreSQL: inventory_items, stock_movements, suppliers

**Lógica de Alertas:**
- ⚪ **INFO:** Stock > 50%
- 🟡 **WARNING:** Stock 30-50%
- 🟠 **CRITICAL:** Stock < 30%
- 🔴 **URGENT:** Stock = 0

**Eventos Emitidos:**
- `inventory:low_stock` → Admin, Manager
- `inventory:out_of_stock` → Menu Service (deshabilitar platillo)

**Eventos Escuchados:**
- `order:created` → Reducir stock de ingredientes

---

### **3.8 USER SERVICE**

**Responsabilidad:** Gestión de usuarios y staff

| Componente | Función |
|------------|---------|
| **Controllers** | UserController, StaffController, CustomerController |
| **Services** | UserService, ProfileService, LoyaltyService |
| **Models** | User, Staff, Customer |

**Endpoints Clave:**
- `GET /api/users/:id` - Obtener usuario
- `PUT /api/users/:id` - Actualizar perfil
- `GET /api/staff` - Listar staff (Admin)
- `GET /api/customers/:id/loyalty` - Puntos de lealtad

**Base de Datos:**
- PostgreSQL: users, staff, customers, loyalty_points

---

### **3.9 ANALYTICS SERVICE**

**Responsabilidad:** Análisis de datos y reportes

| Componente | Función |
|------------|---------|
| **Controllers** | SalesAnalyticsController, DishAnalyticsController, CustomerAnalyticsController |
| **Services** | SalesReportService, DishPerformanceService, TableAnalyticsService, PredictiveAnalyticsService |
| **Models** | SalesMetrics, DishMetrics, TableMetrics |

**Endpoints Clave:**
- `GET /api/analytics/sales` - Reporte de ventas
- `GET /api/analytics/dishes/top` - Platillos más vendidos
- `GET /api/analytics/tables/turnover` - Rotación de mesas
- `GET /api/analytics/predictions` - Predicciones de demanda

**Base de Datos:**
- PostgreSQL: Consultas a todas las tablas
- MongoDB: analytics_events (event sourcing)
- Redis: Métricas en tiempo real

**Eventos Escuchados:**
- Todos los eventos del sistema para análisis

---

### **3.10 NOTIFICATION SERVICE**

**Responsabilidad:** Envío de notificaciones multicanal

| Componente | Función |
|------------|---------|
| **Controllers** | NotificationController |
| **Services** | NotificationService, WebSocketService, EmailService, SMSService, PushService |
| **Models** | Notification |

**Canales de Notificación:**
- 🔌 **WebSocket:** Tiempo real en la app
- 📧 **Email:** Facturas, confirmaciones
- 📱 **SMS:** Alertas urgentes
- 🔔 **Push:** Notificaciones móviles
- 📱 **In-App:** Notificaciones dentro de la app

**Prioridades:**
- 🔴 **URGENT (3):** Alertas críticas → Todos los canales
- 🟠 **HIGH (2):** Importante → WebSocket + Push
- 🟡 **NORMAL (1):** Normal → WebSocket
- ⚪ **LOW (0):** Info → In-App

**Integraciones Externas:**
- AWS SES (Email)
- AWS SNS (SMS)
- Firebase Cloud Messaging (Push)

---

## **💾 CAPA 4: DATOS**

### **4.1 PostgreSQL (Base de Datos Principal)**

**Uso:** Datos relacionales transaccionales

**Tablas Principales (31 tablas):**

| Categoría | Tablas |
|-----------|--------|
| **Auth** | users, roles, permissions, role_permissions |
| **Restaurant** | restaurants, zones, tables, table_sessions |
| **Menu** | menus, categories, dishes, modifiers, ingredients, dish_ingredients |
| **Orders** | orders, order_items, order_status_history |
| **Payments** | payments, invoices, refunds, split_bills |
| **Kitchen** | kitchen_orders, stations, station_staff |
| **Inventory** | inventory_items, stock_movements, suppliers |
| **Staff** | staff, work_schedules, shifts |
| **Customers** | customers, loyalty_points, favorites |
| **Notifications** | notifications |

**Optimizaciones:**
- Índices en foreign keys
- Índices en campos de búsqueda (name, email, etc.)
- Índices compuestos para queries frecuentes
- Particionamiento de tablas grandes (analytics_events)

---

### **4.2 Redis (Cache + Sessions + Queues)**

**Uso:** Cache, sesiones, rate limiting, queues

**Estructuras de Datos:**

| Tipo | Keys | TTL |
|------|------|-----|
| **String** | `menu:{restaurantId}` | 5 min |
| **Hash** | `session:{sessionId}` | 24 hrs |
| **Set** | `table:{tableId}:orders` | 4 hrs |
| **Sorted Set** | `kitchen:orders:pending` | 2 hrs |
| **List** | `queue:notifications` | - |
| **String** | `ratelimit:{userId}:{endpoint}` | 1 min |

**Patrón Pub/Sub:**
- Canal: `orders:updates`
- Canal: `kitchen:updates`
- Canal: `tables:updates`

---

### **4.3 MongoDB (Logs + Analytics Events)**

**Uso:** Logs no estructurados y eventos de analytics

**Colecciones:**
- `application_logs` - Logs de aplicación
- `analytics_events` - Eventos para análisis
- `api_requests` - Logs de requests
- `errors` - Logs de errores

**Ventaja:** Schema flexible, ideal para event sourcing

---

### **4.4 AWS S3 (File Storage)**

**Uso:** Almacenamiento de archivos

**Buckets:**
- `smartmenu-dish-images/` - Imágenes de platillos
- `smartmenu-invoices/` - PDFs de facturas
- `smartmenu-reports/` - Reportes exportados
- `smartmenu-backups/` - Backups de DB

---

## **🌐 CAPA 5: INFRAESTRUCTURA**

### **5.1 Containerización**

```
Docker Compose (Desarrollo)
├── frontend-client (React)
├── frontend-admin (React)
├── api-gateway (Express)
├── auth-service (NestJS)
├── menu-service (NestJS)
├── order-service (NestJS)
├── table-service (NestJS)
├── payment-service (NestJS)
├── kitchen-service (NestJS)
├── inventory-service (NestJS)
├── user-service (NestJS)
├── analytics-service (NestJS)
├── notification-service (NestJS)
├── postgres (PostgreSQL)
├── redis (Redis)
├── mongodb (MongoDB)
└── nginx (Reverse Proxy)
```

---

### **5.2 Kubernetes (Producción)**

```
Kubernetes Cluster
├── Namespace: smartmenu-prod
│   ├── Deployments (cada microservicio)
│   ├── Services (ClusterIP, LoadBalancer)
│   ├── Ingress (Routing externo)
│   ├── ConfigMaps (Configuración)
│   ├── Secrets (Credenciales)
│   └── HorizontalPodAutoscaler (Auto-scaling)
│
├── Namespace: smartmenu-monitoring
│   ├── Prometheus (Métricas)
│   ├── Grafana (Dashboards)
│   └── ELK Stack (Logs)
│
└── Namespace: smartmenu-queue
    └── RabbitMQ (Message Queue)
```

---

## **🔗 CORRELACIONES CRÍTICAS**

### **Flujo de Dependencias Críticas**

```
1. Cliente Hace Pedido:
   Cliente → Menu Service (validar platillos)
           → Table Service (validar mesa)
           → Order Service (crear pedido)
           → Kitchen Service (enviar a cocina)
           → Inventory Service (reducir stock)
           → Notification Service (notificar a todos)

2. Cocina Prepara:
   Kitchen Service → Order Service (actualizar estado)
                   → Notification Service (notificar mesero y cliente)

3. Cliente Paga:
   Payment Service → Stripe API (procesar pago)
                   → Order Service (cerrar orden)
                   → Table Service (cerrar sesión)
                   → Invoice Service (generar factura)
                   → S3 (guardar PDF)
                   → SES (enviar email)
                   → Analytics Service (registrar venta)
```

---

## **⚡ EVENTOS DEL SISTEMA (Event-Driven)**

### **Mapa de Eventos**

| Evento | Emisor | Receptores |
|--------|--------|------------|
| `order:created` | Order Service | Kitchen, Mesero, Cliente, Inventory, Analytics |
| `order:status_changed` | Order/Kitchen Service | Cliente, Mesero |
| `order:ready` | Kitchen Service | Mesero, Cliente |
| `payment:completed` | Payment Service | Order, Table, Analytics |
| `table:call_waiter` | Table Service | Mesero |
| `inventory:low_stock` | Inventory Service | Admin, Manager |
| `kitchen:order_delayed` | Kitchen Service | Mesero, Manager |

---

## **🔒 SEGURIDAD**

### **Capas de Seguridad**

1. **API Gateway:**
   - JWT Validation
   - Rate Limiting
   - CORS
   - Request Sanitization

2. **Service Level:**
   - Role-Based Access Control (RBAC)
   - Input Validation (Joi/Zod)
   - SQL Injection Prevention (ORM)
   - XSS Prevention

3. **Infrastructure:**
   - HTTPS/TLS
   - VPC (Virtual Private Cloud)
   - Security Groups
   - Secrets Management (AWS Secrets Manager)

4. **Database:**
   - Encrypted at rest
   - Encrypted in transit
   - Regular backups
   - Point-in-time recovery

---

## **📈 ESCALABILIDAD**

### **Estrategias de Escalabilidad**

| Componente | Estrategia | Escala |
|------------|-----------|--------|
| **Frontend** | CDN + Edge Caching | Global |
| **API Gateway** | Horizontal Scaling + Load Balancer | 10-100 instancias |
| **Microservicios** | Horizontal Scaling + Auto-scaling | Por demanda |
| **PostgreSQL** | Read Replicas + Connection Pooling | 1 Master + N Replicas |
| **Redis** | Redis Cluster | 3-6 nodos |
| **WebSocket** | Sticky Sessions + Redis Pub/Sub | Por demanda |

---

## **🎯 MÉTRICAS DE RENDIMIENTO**

### **SLAs Objetivo**

| Métrica | Objetivo | Crítico |
|---------|----------|---------|
| **Uptime** | 99.9% | 99.5% |
| **Response Time (API)** | < 200ms | < 500ms |
| **Response Time (WS)** | < 50ms | < 100ms |
| **Order Processing** | < 2s | < 5s |
| **Payment Processing** | < 3s | < 10s |
| **Cache Hit Ratio** | > 80% | > 60% |
| **Error Rate** | < 0.1% | < 1% |

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**Autor:** Smart Menu Team
