# 10 - Estándares de Código

**Proyecto:** SmartMenu  
**Última Actualización:** 7 de Febrero de 2026

---

## 🎯 PRINCIPIOS GENERALES

### SOLID Principles
- **S**ingle Responsibility: Una clase, una responsabilidad
- **O**pen/Closed: Abierto para extensión, cerrado para modificación
- **L**iskov Substitution: Subtipos deben ser sustituibles
- **I**nterface Segregation: Interfaces específicas mejor que generales
- **D**ependency Inversion: Depender de abstracciones, no de concreciones

### DRY (Don't Repeat Yourself)
```csharp
// ❌ MAL
public decimal CalculateTotal1(Order order)
{
    decimal total = order.SubTotal;
    total += total * 0.18m; // ITBIS
    return total;
}

public decimal CalculateTotal2(Order order)
{
    decimal total = order.SubTotal;
    total += total * 0.18m; // ITBIS - Duplicado!
    return total;
}

// ✅ BIEN
public class TaxCalculator
{
    private const decimal ITBIS_RATE = 0.18m;
    
    public decimal CalculateITBIS(decimal amount)
    {
        return amount * ITBIS_RATE;
    }
}
```

---

## 📐 BACKEND (.NET)

### Convenciones de Nombres

#### Clases y Métodos
```csharp
// PascalCase para clases, interfaces, métodos, propiedades
public class OrderService // ✅
public class orderservice // ❌

public interface IOrderRepository // ✅ (I prefijo para interfaces)
public interface OrderRepository // ❌

public async Task<Order> CreateOrderAsync() // ✅
public async Task<Order> createOrder() // ❌
```

#### Variables y Parámetros
```csharp
// camelCase para variables locales y parámetros
public void ProcessOrder(Order customerOrder) // ✅
{
    var totalAmount = customerOrder.Total; // ✅
    var TotalAmount = customerOrder.Total; // ❌
}
```

#### Campos Privados
```csharp
public class OrderService
{
    private readonly IOrderRepository _orderRepository; // ✅ (prefijo _)
    private readonly IOrderRepository orderRepository; // ❌
    
    public OrderService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }
}
```

### Estructura de Archivos

```
src/backend/
├── SmartMenu.Domain/
│   ├── Entities/
│   │   ├── Order.cs          # Entidad de dominio
│   │   ├── Dish.cs
│   │   └── ...
│   ├── Enums/
│   │   ├── OrderStatus.cs    # Enumeraciones
│   │   └── ...
│   └── Interfaces/           # Interfaces de dominio
│
├── SmartMenu.Application/
│   ├── DTOs/                 # Data Transfer Objects
│   │   ├── OrderDto.cs
│   │   ├── CreateOrderDto.cs
│   │   └── ...
│   ├── Services/             # Interfaces de servicios
│   │   └── IOrderService.cs
│   └── Repositories/         # Interfaces de repositorios
│       └── IOrderRepository.cs
│
├── SmartMenu.Infrastructure/
│   ├── Data/
│   │   ├── ApplicationDbContext.cs
│   │   └── DbInitializer.cs
│   ├── Repositories/
│   │   └── OrderRepository.cs
│   └── Services/
│       └── OrderService.cs
│
└── SmartMenu.API/
    ├── Controllers/
    │   └── OrderController.cs
    ├── Hubs/
    │   └── OrderHub.cs
    └── Program.cs
```

### Async/Await

```csharp
// ✅ BIEN - Async todo el camino
public async Task<Order> CreateOrderAsync(CreateOrderDto dto)
{
    var order = new Order { /* ... */ };
    await _repository.AddAsync(order);
    await _repository.SaveChangesAsync();
    return order;
}

// ❌ MAL - Bloqueando con .Result
public Order CreateOrder(CreateOrderDto dto)
{
    var order = new Order { /* ... */ };
    _repository.AddAsync(order).Result; // ❌ Puede causar deadlock
    return order;
}
```

### Manejo de Errores

```csharp
// ✅ BIEN - Excepciones específicas
public async Task<Order> GetOrderAsync(int id)
{
    var order = await _repository.GetByIdAsync(id);
    
    if (order == null)
        throw new KeyNotFoundException($"Order {id} not found");
    
    if (!order.IsActive)
        throw new InvalidOperationException($"Order {id} is not active");
    
    return order;
}

// Controller maneja excepciones
[HttpGet("{id}")]
public async Task<ActionResult<OrderDto>> GetOrder(int id)
{
    try
    {
        var order = await _orderService.GetOrderAsync(id);
        return Ok(order);
    }
    catch (KeyNotFoundException ex)
    {
        return NotFound(new { error = ex.Message });
    }
    catch (InvalidOperationException ex)
    {
        return BadRequest(new { error = ex.Message });
    }
}
```

### DTOs vs Entities

```csharp
// ❌ MAL - Retornar entidades directamente
[HttpGet]
public async Task<List<Order>> GetOrders() // Expone estructura interna
{
    return await _context.Orders.ToListAsync();
}

// ✅ BIEN - Usar DTOs
[HttpGet]
public async Task<List<OrderDto>> GetOrders()
{
    var orders = await _context.Orders.ToListAsync();
    return orders.Select(o => new OrderDto
    {
        Id = o.Id,
        OrderNumber = o.OrderNumber,
        TotalAmount = o.TotalAmount
        // Solo campos necesarios
    }).ToList();
}
```

### Dependency Injection

```csharp
// ✅ BIEN - Inyección por constructor
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrderController> _logger;
    
    public OrderController(
        IOrderService orderService,
        ILogger<OrderController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }
}

// ❌ MAL - Service Locator pattern
public class OrderController : ControllerBase
{
    public OrderController(IServiceProvider serviceProvider)
    {
        var service = serviceProvider.GetService<IOrderService>(); // ❌
    }
}
```

---

## ⚛️ FRONTEND (React/TypeScript)

### Convenciones de Nombres

```typescript
// PascalCase para componentes
export function OrderCard() {} // ✅
export function orderCard() {} // ❌

// camelCase para funciones, variables
const handleSubmit = () => {} // ✅
const HandleSubmit = () => {} // ❌

// UPPER_SNAKE_CASE para constantes
const API_URL = 'http://localhost:5041'; // ✅
const apiUrl = 'http://localhost:5041'; // ❌
```

### Estructura de Componentes

```typescript
// ✅ BIEN - Componente organizado
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Order } from '@/types';

// 1. Interfaces/Types
interface OrderCardProps {
  orderId: number;
  onUpdate?: () => void;
}

// 2. Componente principal
export function OrderCard({ orderId, onUpdate }: OrderCardProps) {
  // 3. State
  const [isLoading, setIsLoading] = useState(false);
  
  // 4. Queries/Mutations
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiClient.getOrder(orderId)
  });
  
  // 5. Effects
  useEffect(() => {
    // ...
  }, [orderId]);
  
  // 6. Event handlers
  const handleClick = () => {
    // ...
  };
  
  // 7. Early returns
  if (!order) return <div>Loading...</div>;
  
  // 8. Render
  return (
    <div className="order-card">
      {/* JSX */}
    </div>
  );
}
```

### TypeScript Types

```typescript
// ✅ BIEN - Tipos explícitos
interface Order {
  id: number;
  orderNumber: string;
  totalAmount: number;
  status: OrderStatus;
  items: OrderItem[];
}

type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Ready';

// ❌ MAL - any type
const order: any = await fetchOrder(); // ❌

// ✅ BIEN - Tipos específicos
const order: Order = await fetchOrder();
```

### Hooks Customizados

```typescript
// ✅ BIEN - Hook reutilizable
export function useOrder(orderId: number) {
  return useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: () => apiClient.getOrder(orderId),
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
}

// Uso
function OrderDetails({ orderId }: Props) {
  const { data: order, isLoading } = useOrder(orderId);
  // ...
}
```

### Manejo de Estado

```typescript
// ✅ BIEN - Zustand para estado global
import { create } from 'zustand';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter(i => i.id !== itemId)
  })),
  clearCart: () => set({ items: [] })
}));

// ❌ MAL - Prop drilling excesivo
// Pasar state por 5 niveles de componentes
```

### API Calls

```typescript
// ✅ BIEN - Cliente API centralizado
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000
});

export const apiClient = {
  getOrders: () => api.get<Order[]>('/order'),
  getOrder: (id: number) => api.get<Order>(`/order/${id}`),
  createOrder: (data: CreateOrderDto) => api.post<Order>('/order', data)
};

// ❌ MAL - fetch directo en componentes
function MyComponent() {
  const data = await fetch('http://localhost:5041/api/order'); // ❌
}
```

### Estilos con Tailwind

```typescript
// ✅ BIEN - Clases condicionales limpias
import { cn } from '@/lib/utils';

function Button({ variant }: Props) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg",
        variant === "primary" && "bg-blue-600 text-white",
        variant === "secondary" && "bg-gray-200 text-gray-800"
      )}
    >
      Click me
    </button>
  );
}

// ❌ MAL - Strings concatenados manualmente
function Button({ variant }: Props) {
  return (
    <button
      className={
        "px-4 py-2 rounded-lg " +
        (variant === "primary" ? "bg-blue-600 text-white " : "") +
        (variant === "secondary" ? "bg-gray-200 text-gray-800" : "")
      }
    >
    </button>
  );
}
```

---

## 📁 GIT WORKFLOW

### Branch Naming

```bash
feature/add-payment-integration   # Nueva funcionalidad
bugfix/fix-order-calculation      # Corrección de bug
hotfix/security-patch             # Parche urgente
refactor/improve-api-structure    # Refactorización
docs/update-api-documentation     # Documentación
```

### Commit Messages

```bash
# ✅ BIEN - Mensajes descriptivos
feat: Add payment processing with Stripe
fix: Correct order total calculation for discounts
docs: Update API documentation for orders endpoint
refactor: Extract order validation to separate service
test: Add unit tests for OrderService

# ❌ MAL - Mensajes vagos
fixed stuff
update
changes
wip
```

### Formato de Commits (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Formato (no afecta código)
- `refactor`: Refactorización
- `test`: Agregar/modificar tests
- `chore`: Mantenimiento

**Ejemplo:**
```
feat(orders): Add payment processing with Stripe

- Integrate Stripe SDK
- Add payment intent creation
- Handle webhook events
- Update order status after payment

Closes #123
```

---

## 🧪 TESTING

### Nomenclatura de Tests

```csharp
// Patrón: MethodName_Scenario_ExpectedBehavior
public class OrderServiceTests
{
    [Fact]
    public async Task CreateOrder_ValidData_ReturnsOrder() // ✅
    
    [Fact]
    public async Task CreateOrder_InvalidData_ThrowsException() // ✅
    
    [Fact]
    public async Task Test1() // ❌
}
```

### Arrange, Act, Assert

```csharp
[Fact]
public async Task CreateOrder_ValidData_ReturnsOrder()
{
    // Arrange
    var dto = new CreateOrderDto
    {
        TableId = 1,
        Items = new[] { /* ... */ }
    };
    var service = new OrderService(_mockRepository.Object);
    
    // Act
    var result = await service.CreateOrderAsync(dto);
    
    // Assert
    Assert.NotNull(result);
    Assert.Equal("Pending", result.Status);
}
```

---

## 📊 CODE REVIEW CHECKLIST

### Backend
- [ ] Sigue Clean Architecture
- [ ] Usa async/await correctamente
- [ ] DTOs en lugar de entidades
- [ ] Manejo de errores apropiado
- [ ] Tests unitarios incluidos
- [ ] Documentación XML en métodos públicos
- [ ] Sin hardcoded values
- [ ] Validaciones implementadas

### Frontend
- [ ] TypeScript types explícitos
- [ ] Componentes desacoplados
- [ ] No hay console.logs en producción
- [ ] Manejo de loading/error states
- [ ] Accesibilidad (a11y) considerada
- [ ] Responsive design
- [ ] Optimización de renders
- [ ] API calls centralizados

---

## 🔐 SEGURIDAD

### Never Commit
```
❌ Passwords
❌ API Keys
❌ JWT Secrets
❌ Connection Strings con credenciales
❌ Archivos .env
```

### Use Environment Variables
```csharp
// ✅ BIEN
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY");

// ❌ MAL
var jwtKey = "mi-clave-super-secreta"; // Hardcoded
```

---

**Estado:** ✅ Estándares Definidos  
**Última Actualización:** 7 de Febrero de 2026
