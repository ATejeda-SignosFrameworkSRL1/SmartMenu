# 10 - API Documentation - SmartMenu

**Base URL:** `http://localhost:5041/api`  
**Version:** 1.0  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 ÍNDICE

1. [Autenticación](#autenticación)
2. [Categorías](#categorías)
3. [Platillos](#platillos)
4. [Órdenes](#órdenes)
5. [Mesas (Pendiente)](#mesas-pendiente)
6. [Pagos (Pendiente)](#pagos-pendiente)
7. [SignalR Hubs](#signalr-hubs)
8. [Códigos de Estado](#códigos-de-estado)

---

## 🔐 AUTENTICACIÓN

Todos los endpoints requieren autenticación excepto `/auth/login` y `/auth/register`.

### Bearer Token
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 1. AUTH CONTROLLER

### POST `/auth/register`
Registrar nuevo usuario del sistema.

**Request:**
```json
{
  "email": "admin@smartmenu.com",
  "password": "Admin123!",
  "firstName": "Admin",
  "lastName": "System",
  "phone": "809-555-0100",
  "role": "Admin",
  "restaurantId": 1
}
```

**Response:** `201 Created`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "f239eb722dd1434a83f7c8c8beada66f...",
  "user": {
    "id": 1,
    "email": "admin@smartmenu.com",
    "firstName": "Admin",
    "lastName": "System",
    "phone": "809-555-0100",
    "role": "Admin",
    "isActive": true
  }
}
```

**Roles Válidos:**
- `Admin`
- `Manager`
- `Chef`
- `KitchenStaff`
- `Waiter`
- `Hostess`
- `Bartender`
- `Cashier`

**Errores:**
- `400 Bad Request`: Email ya existe o datos inválidos

---

### POST `/auth/login`
Iniciar sesión.

**Request:**
```json
{
  "email": "admin@smartmenu.com",
  "password": "Admin123!"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "f239eb722dd1434a83f7c8c8beada66f...",
  "user": {
    "id": 1,
    "email": "admin@smartmenu.com",
    "firstName": "Admin",
    "lastName": "System",
    "phone": "809-555-0100",
    "role": "Admin",
    "isActive": true
  }
}
```

**Errores:**
- `401 Unauthorized`: Credenciales inválidas
- `400 Bad Request`: Usuario inactivo

**Ejemplos de Usuarios:**
```json
// Admin
{
  "email": "admin@smartmenu.com",
  "password": "Admin123!"
}

// Chef
{
  "email": "chef@smartmenu.com",
  "password": "Chef123!"
}

// Waiter
{
  "email": "waiter@smartmenu.com",
  "password": "Waiter123!"
}

// Cashier
{
  "email": "cashier@smartmenu.com",
  "password": "Cash123!"
}
```

---

### GET `/auth/health`
Health check del servicio de autenticación.

**Response:** `200 OK`
```json
{
  "status": "Auth service is running",
  "timestamp": "2026-02-07T10:30:00Z"
}
```

---

## 2. CATEGORY CONTROLLER

### GET `/category`
Obtener todas las categorías activas.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Entradas",
    "description": "Deliciosas entradas para comenzar",
    "sortOrder": 1,
    "dishCount": 5
  },
  {
    "id": 2,
    "name": "Platos Fuertes",
    "description": "Nuestros platos principales",
    "sortOrder": 2,
    "dishCount": 12
  },
  {
    "id": 3,
    "name": "Postres",
    "description": "Dulces tentaciones",
    "sortOrder": 3,
    "dishCount": 6
  }
]
```

---

### GET `/category/{id}`
Obtener categoría por ID con sus platillos.

**Request:**
```http
GET /api/category/1
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Entradas",
  "description": "Deliciosas entradas para comenzar",
  "sortOrder": 1,
  "dishes": [
    {
      "id": 1,
      "name": "Ensalada César",
      "price": 350.00,
      "imageUrl": "https://example.com/caesar-salad.jpg"
    },
    {
      "id": 2,
      "name": "Sopa del Día",
      "price": 280.00,
      "imageUrl": null
    }
  ]
}
```

**Errores:**
- `404 Not Found`: Categoría no existe

---

## 3. DISH CONTROLLER

### GET `/dish`
Obtener platillos disponibles.

**Query Params:**
- `categoryId` (opcional): Filtrar por categoría

**Request:**
```http
GET /api/dish?categoryId=1
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Ensalada César",
    "description": "Lechuga romana, crotones, parmesano y aderezo césar",
    "price": 350.00,
    "categoryId": 1,
    "categoryName": "Entradas",
    "imageUrl": "https://example.com/caesar-salad.jpg",
    "isAvailable": true,
    "isVegetarian": true,
    "isVegan": false,
    "isGlutenFree": false,
    "preparationTimeMinutes": 10
  },
  {
    "id": 2,
    "name": "Sopa del Día",
    "description": "Pregunta a tu mesero por la sopa del día",
    "price": 280.00,
    "categoryId": 1,
    "categoryName": "Entradas",
    "imageUrl": null,
    "isAvailable": true,
    "isVegetarian": false,
    "isVegan": false,
    "isGlutenFree": true,
    "preparationTimeMinutes": 5
  }
]
```

---

### GET `/dish/{id}`
Obtener platillo específico.

**Request:**
```http
GET /api/dish/1
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Ensalada César",
  "description": "Lechuga romana, crotones, parmesano y aderezo césar",
  "price": 350.00,
  "categoryId": 1,
  "categoryName": "Entradas",
  "imageUrl": "https://example.com/caesar-salad.jpg",
  "isAvailable": true,
  "isVegetarian": true,
  "isVegan": false,
  "isGlutenFree": false,
  "preparationTimeMinutes": 10
}
```

**Errores:**
- `404 Not Found`: Platillo no existe

---

### POST `/dish`
Crear nuevo platillo (Requiere rol: Admin).

**Request:**
```json
{
  "name": "Filet Mignon",
  "description": "Filete de res premium con vegetales asados",
  "price": 1250.00,
  "categoryId": 2,
  "imageUrl": "https://example.com/filet-mignon.jpg",
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": true,
  "preparationTimeMinutes": 25
}
```

**Response:** `201 Created`
```json
{
  "id": 15,
  "name": "Filet Mignon",
  "description": "Filete de res premium con vegetales asados",
  "price": 1250.00,
  "categoryId": 2,
  "categoryName": "",
  "imageUrl": "https://example.com/filet-mignon.jpg",
  "isAvailable": true,
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": true,
  "preparationTimeMinutes": 25
}
```

---

### PUT `/dish/{id}`
Actualizar platillo (Requiere rol: Admin).

**Request:**
```http
PUT /api/dish/15
```

```json
{
  "name": "Filet Mignon Premium",
  "description": "Filete de res premium con vegetales asados y papas",
  "price": 1350.00,
  "categoryId": 2,
  "imageUrl": "https://example.com/filet-mignon-premium.jpg",
  "isVegetarian": false,
  "isVegan": false,
  "isGlutenFree": true,
  "preparationTimeMinutes": 30
}
```

**Response:** `204 No Content`

**Errores:**
- `404 Not Found`: Platillo no existe

---

### DELETE `/dish/{id}`
Eliminar platillo (Requiere rol: Admin).

**Request:**
```http
DELETE /api/dish/15
```

**Response:** `204 No Content`

**Errores:**
- `404 Not Found`: Platillo no existe

---

### PATCH `/dish/{id}/toggle-availability`
Cambiar disponibilidad de platillo.

**Request:**
```http
PATCH /api/dish/1/toggle-availability
```

**Response:** `200 OK`
```json
{
  "isAvailable": false
}
```

**Errores:**
- `404 Not Found`: Platillo no existe

---

## 4. ORDER CONTROLLER

### POST `/order`
Crear nueva orden.

**Request:**
```json
{
  "tableId": 1,
  "sessionId": "session-1707300000000-xyz123",
  "specialInstructions": "Sin sal",
  "items": [
    {
      "dishId": 1,
      "quantity": 2,
      "unitPrice": 350.00,
      "notes": "Extra aderezo"
    },
    {
      "dishId": 3,
      "quantity": 1,
      "unitPrice": 850.00,
      "notes": "Término medio"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": 42,
  "orderNumber": "ORD-20260207-00042",
  "tableId": 1,
  "sessionId": "session-1707300000000-xyz123",
  "waiterId": null,
  "status": "Pending",
  "subTotal": 1550.00,
  "taxAmount": 279.00,
  "tipAmount": 0.00,
  "discountAmount": 0.00,
  "totalAmount": 1829.00,
  "specialInstructions": "Sin sal",
  "createdAt": "2026-02-07T14:30:00Z",
  "items": [
    {
      "id": 85,
      "dishId": 1,
      "dishName": "Ensalada César",
      "quantity": 2,
      "unitPrice": 350.00,
      "subtotal": 700.00,
      "notes": "Extra aderezo",
      "status": "Pending"
    },
    {
      "id": 86,
      "dishId": 3,
      "dishName": "Churrasco",
      "quantity": 1,
      "unitPrice": 850.00,
      "subtotal": 850.00,
      "notes": "Término medio",
      "status": "Pending"
    }
  ]
}
```

**Cálculos:**
- SubTotal = Suma de (quantity * unitPrice) de todos los items
- TaxAmount = SubTotal * 0.18 (ITBIS 18%)
- TotalAmount = SubTotal + TaxAmount + TipAmount - DiscountAmount

**Errores:**
- `400 Bad Request`: Datos inválidos, mesa no existe, platillos no disponibles

---

### GET `/order/{id}`
Obtener orden por ID.

**Request:**
```http
GET /api/order/42
```

**Response:** `200 OK`
```json
{
  "id": 42,
  "orderNumber": "ORD-20260207-00042",
  "tableId": 1,
  "sessionId": "session-1707300000000-xyz123",
  "waiterId": 3,
  "status": "Preparing",
  "subTotal": 1550.00,
  "taxAmount": 279.00,
  "tipAmount": 0.00,
  "discountAmount": 0.00,
  "totalAmount": 1829.00,
  "specialInstructions": "Sin sal",
  "createdAt": "2026-02-07T14:30:00Z",
  "updatedAt": "2026-02-07T14:35:00Z",
  "items": [
    {
      "id": 85,
      "dishId": 1,
      "dishName": "Ensalada César",
      "quantity": 2,
      "unitPrice": 350.00,
      "subtotal": 700.00,
      "notes": "Extra aderezo",
      "status": "Ready"
    },
    {
      "id": 86,
      "dishId": 3,
      "dishName": "Churrasco",
      "quantity": 1,
      "unitPrice": 850.00,
      "subtotal": 850.00,
      "notes": "Término medio",
      "status": "Preparing"
    }
  ]
}
```

**Errores:**
- `404 Not Found`: Orden no existe

---

### GET `/order/active`
Obtener órdenes activas.

**Response:** `200 OK`
```json
[
  {
    "id": 42,
    "orderNumber": "ORD-20260207-00042",
    "tableId": 1,
    "status": "Preparing",
    "totalAmount": 1829.00,
    "createdAt": "2026-02-07T14:30:00Z",
    "items": [
      {
        "dishName": "Ensalada César",
        "quantity": 2,
        "status": "Ready"
      },
      {
        "dishName": "Churrasco",
        "quantity": 1,
        "status": "Preparing"
      }
    ]
  },
  {
    "id": 43,
    "orderNumber": "ORD-20260207-00043",
    "tableId": 5,
    "status": "Confirmed",
    "totalAmount": 2150.00,
    "createdAt": "2026-02-07T14:40:00Z",
    "items": [...]
  }
]
```

**Estados de Orden:**
- `Pending`: Recién creada
- `Confirmed`: Confirmada por mesero/cocina
- `Preparing`: En preparación
- `Ready`: Lista para servir
- `Served`: Servida al cliente
- `Completed`: Completada y pagada
- `Cancelled`: Cancelada

---

### PUT `/order/{id}/status`
Actualizar estado de orden.

**Request:**
```http
PUT /api/order/42/status
```

```json
{
  "newStatus": "Ready"
}
```

**Response:** `200 OK`
```json
{
  "message": "Estado actualizado correctamente",
  "order": {
    "id": 42,
    "status": "Ready",
    "updatedAt": "2026-02-07T14:50:00Z"
  }
}
```

**Errores:**
- `404 Not Found`: Orden no existe
- `400 Bad Request`: Estado inválido

---

## 5. MESAS (PENDIENTE)

### GET `/table`
Obtener todas las mesas.

**Endpoint:** `GET /api/table`  
**Estado:** ⚠️ Por implementar

**Response Esperado:**
```json
[
  {
    "id": 1,
    "tableNumber": 1,
    "capacity": 4,
    "zoneName": "Terraza",
    "status": "Available",
    "qrCode": "9fbdc804d9a541f18a0c81833e28bb5e"
  },
  {
    "id": 2,
    "tableNumber": 2,
    "capacity": 4,
    "zoneName": "Salón Principal",
    "status": "Occupied",
    "qrCode": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
]
```

---

### GET `/table/{id}`
Obtener mesa específica.

**Endpoint:** `GET /api/table/1`  
**Estado:** ⚠️ Por implementar

**Response Esperado:**
```json
{
  "id": 1,
  "tableNumber": 1,
  "capacity": 4,
  "zoneName": "Terraza",
  "status": "Available",
  "qrCode": "9fbdc804d9a541f18a0c81833e28bb5e"
}
```

---

### PUT `/table/{id}/status`
Actualizar estado de mesa.

**Endpoint:** `PUT /api/table/1/status`  
**Estado:** ⚠️ Por implementar

**Request:**
```json
{
  "newStatus": "Occupied"
}
```

**Estados Válidos:**
- `Available`
- `Occupied`
- `Reserved`
- `OutOfService`

---

## 6. PAGOS (PENDIENTE)

### POST `/payment`
Crear pago.

**Endpoint:** `POST /api/payment`  
**Estado:** ⚠️ Por implementar

**Request:**
```json
{
  "orderId": 42,
  "paymentMethod": "Card",
  "amount": 1829.00
}
```

**Métodos de Pago:**
- `Cash`: Efectivo
- `Card`: Tarjeta
- `Transfer`: Transferencia
- `Digital`: Pago digital (Stripe)

---

### GET `/payment/{id}`
Obtener información de pago.

**Endpoint:** `GET /api/payment/1`  
**Estado:** ⚠️ Por implementar

---

## 7. SIGNALR HUBS

### OrderHub
**Endpoint:** `ws://localhost:5041/hubs/orders`

**Eventos del Cliente:**
```javascript
// Notificar nueva orden
connection.invoke("NotifyNewOrder", orderId, tableId);
```

**Eventos del Servidor:**
```javascript
// Nueva orden creada
connection.on("NewOrderCreated", (data) => {
  console.log(`Nueva orden: ${data.orderId} en mesa ${data.tableId}`);
});
```

---

### KitchenHub
**Endpoint:** `ws://localhost:5041/hubs/kitchen`

**Eventos:**
- `OrderStatusChanged`: Cuando cambia el estado de una orden
- `NewOrder`: Nueva orden para cocina
- `OrderReady`: Orden lista para servir

---

### TableHub
**Endpoint:** `ws://localhost:5041/hubs/tables`

**Eventos del Cliente:**
```javascript
// Unirse al grupo de una mesa
connection.invoke("JoinTableGroup", tableId);

// Salir del grupo
connection.invoke("LeaveTableGroup", tableId);

// Notificar cambio de estado
connection.invoke("NotifyTableStatusChanged", tableId, status);
```

**Eventos del Servidor:**
```javascript
// Cambio de estado de mesa
connection.on("TableStatusChanged", (data) => {
  console.log(`Mesa ${data.tableId}: ${data.status}`);
});
```

---

## 8. CÓDIGOS DE ESTADO

### 2xx - Éxito
- `200 OK`: Solicitud exitosa
- `201 Created`: Recurso creado exitosamente
- `204 No Content`: Exitoso sin contenido de respuesta

### 4xx - Errores del Cliente
- `400 Bad Request`: Datos inválidos
- `401 Unauthorized`: No autenticado
- `403 Forbidden`: No autorizado (sin permisos)
- `404 Not Found`: Recurso no encontrado

### 5xx - Errores del Servidor
- `500 Internal Server Error`: Error interno del servidor

---

## 🧪 EJEMPLOS DE USO

### JavaScript/TypeScript (Axios)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5041/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login
const login = async () => {
  const response = await api.post('/auth/login', {
    email: 'admin@smartmenu.com',
    password: 'Admin123!'
  });
  localStorage.setItem('admin_token', response.data.accessToken);
};

// Obtener categorías
const getCategories = async () => {
  const response = await api.get('/category');
  return response.data;
};

// Crear orden
const createOrder = async (orderData) => {
  const response = await api.post('/order', orderData);
  return response.data;
};
```

---

### C# (.NET Client)

```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;

public class SmartMenuClient
{
    private readonly HttpClient _httpClient;
    
    public SmartMenuClient()
    {
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri("http://localhost:5041/api")
        };
    }
    
    public void SetToken(string token)
    {
        _httpClient.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);
    }
    
    public async Task<AuthResultDto> LoginAsync(string email, string password)
    {
        var response = await _httpClient.PostAsJsonAsync("/auth/login", new
        {
            email,
            password
        });
        
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AuthResultDto>();
    }
}
```

---

### cURL

```bash
# Login
curl -X POST http://localhost:5041/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@smartmenu.com",
    "password": "Admin123!"
  }'

# Obtener categorías (con token)
curl -X GET http://localhost:5041/api/category \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Crear orden
curl -X POST http://localhost:5041/api/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{
    "tableId": 1,
    "sessionId": "session-123",
    "items": [
      {
        "dishId": 1,
        "quantity": 2,
        "unitPrice": 350.00
      }
    ]
  }'
```

---

## ✅ TESTING

### Swagger UI
Disponible en: `http://localhost:5041/swagger`

### Postman Collection
Importar desde: `SmartMenu.postman_collection.json`

---

**Estado de Implementación:**
- ✅ Auth Controller: 100%
- ✅ Category Controller: 100%
- ✅ Dish Controller: 100%
- ✅ Order Controller: 100%
- ⚠️ Table Controller: 0% (Por implementar)
- ⚠️ Payment Controller: 0% (Por implementar)
- ✅ SignalR Hubs: 100%

---

**Última Actualización:** 7 de Febrero de 2026  
**Estado:** ✅ Documentación Completa (Controllers existentes)
