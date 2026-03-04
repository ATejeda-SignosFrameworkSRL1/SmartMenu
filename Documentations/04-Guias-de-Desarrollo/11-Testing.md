# 11 - Testing

**Proyecto:** SmartMenu  
**Última Actualización:** 7 de Febrero de 2026

---

## 📋 ESTRATEGIA DE TESTING

### Pirámide de Tests

```
        /\
       /  \      E2E Tests (10%)
      /────\     
     /      \    Integration Tests (20%)
    /────────\   
   /          \  Unit Tests (70%)
  /────────────\
```

**Distribución Recomendada:**
- **70% Unit Tests**: Lógica de negocio, servicios, utilidades
- **20% Integration Tests**: APIs, Base de datos, servicios externos
- **10% E2E Tests**: Flujos críticos del usuario

---

## 🧪 UNIT TESTING

### Framework: xUnit

#### Setup del Proyecto

```bash
# Crear proyecto de tests
dotnet new xunit -n SmartMenu.Tests
cd SmartMenu.Tests

# Agregar paquetes
dotnet add package Moq
dotnet add package FluentAssertions
dotnet add package Microsoft.EntityFrameworkCore.InMemory

# Referencia al proyecto principal
dotnet add reference ../SmartMenu.Domain/SmartMenu.Domain.csproj
dotnet add reference ../SmartMenu.Application/SmartMenu.Application.csproj
```

### Ejemplo: Testing de Entidad de Dominio

```csharp
using Xunit;
using FluentAssertions;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Tests.Domain;

public class OrderTests
{
    [Fact]
    public void Order_Creation_Should_SetDefaultValues()
    {
        // Arrange & Act
        var order = new Order
        {
            TableId = 1,
            SessionId = "session-123"
        };
        
        // Assert
        order.Status.Should().Be("Pending");
        order.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        order.SubTotal.Should().Be(0);
    }
    
    [Fact]
    public void Order_CalculateTotal_Should_IncludeTaxAndTip()
    {
        // Arrange
        var order = new Order
        {
            SubTotal = 1000m,
            TaxAmount = 180m,  // 18%
            TipAmount = 100m
        };
        
        // Act
        var total = order.SubTotal + order.TaxAmount + order.TipAmount;
        
        // Assert
        total.Should().Be(1280m);
    }
    
    [Theory]
    [InlineData(100, 18)]
    [InlineData(500, 90)]
    [InlineData(1000, 180)]
    public void Order_CalculateTax_Should_ApplyCorrectITBIS(decimal subtotal, decimal expectedTax)
    {
        // Arrange
        const decimal ITBIS_RATE = 0.18m;
        
        // Act
        var tax = subtotal * ITBIS_RATE;
        
        // Assert
        tax.Should().Be(expectedTax);
    }
}
```

### Ejemplo: Testing de Servicio con Mocks

```csharp
using Moq;
using Xunit;
using FluentAssertions;
using SmartMenu.Application.Services;
using SmartMenu.Application.Repositories;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Tests.Application;

public class OrderServiceTests
{
    private readonly Mock<IOrderRepository> _mockRepository;
    private readonly Mock<ILogger<OrderService>> _mockLogger;
    private readonly OrderService _sut; // System Under Test
    
    public OrderServiceTests()
    {
        _mockRepository = new Mock<IOrderRepository>();
        _mockLogger = new Mock<ILogger<OrderService>>();
        _sut = new OrderService(_mockRepository.Object, _mockLogger.Object);
    }
    
    [Fact]
    public async Task CreateOrderAsync_ValidData_Should_ReturnOrder()
    {
        // Arrange
        var createDto = new CreateOrderDto
        {
            TableId = 1,
            SessionId = "session-123",
            Items = new[]
            {
                new CreateOrderItemDto
                {
                    DishId = 1,
                    Quantity = 2,
                    UnitPrice = 350m
                }
            }
        };
        
        var expectedOrder = new Order
        {
            Id = 1,
            TableId = 1,
            Status = "Pending"
        };
        
        _mockRepository
            .Setup(r => r.AddAsync(It.IsAny<Order>()))
            .Returns(Task.CompletedTask);
            
        _mockRepository
            .Setup(r => r.SaveChangesAsync())
            .Returns(Task.FromResult(1));
        
        // Act
        var result = await _sut.CreateOrderAsync(createDto);
        
        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be("Pending");
        result.TableId.Should().Be(1);
        
        _mockRepository.Verify(
            r => r.AddAsync(It.IsAny<Order>()),
            Times.Once
        );
    }
    
    [Fact]
    public async Task GetOrderByIdAsync_NonExistentOrder_Should_ThrowException()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.GetByIdAsync(999))
            .ReturnsAsync((Order)null);
        
        // Act
        Func<Task> act = async () => await _sut.GetOrderByIdAsync(999);
        
        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Order*not found*");
    }
}
```

### Ejecutar Tests

```bash
# Todos los tests
dotnet test

# Con detalles
dotnet test --logger "console;verbosity=detailed"

# Con coverage
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover

# Filtrar por categoría
dotnet test --filter "Category=Unit"
```

---

## 🔗 INTEGRATION TESTING

### Testing de API Controllers

```csharp
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;
using Xunit;
using FluentAssertions;

namespace SmartMenu.Tests.Integration;

public class OrderControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    
    public OrderControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }
    
    [Fact]
    public async Task CreateOrder_ValidData_Returns201Created()
    {
        // Arrange
        var createDto = new CreateOrderDto
        {
            TableId = 1,
            SessionId = "test-session",
            Items = new[]
            {
                new CreateOrderItemDto
                {
                    DishId = 1,
                    Quantity = 1,
                    UnitPrice = 350m
                }
            }
        };
        
        // Act
        var response = await _client.PostAsJsonAsync("/api/order", createDto);
        
        // Assert
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Created);
        
        var order = await response.Content.ReadFromJsonAsync<OrderDto>();
        order.Should().NotBeNull();
        order.Status.Should().Be("Pending");
    }
    
    [Fact]
    public async Task GetOrder_NonExistent_Returns404()
    {
        // Act
        var response = await _client.GetAsync("/api/order/999999");
        
        // Assert
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.NotFound);
    }
}
```

### Testing de Database

```csharp
public class OrderRepositoryTests
{
    private readonly ApplicationDbContext _context;
    private readonly OrderRepository _repository;
    
    public OrderRepositoryTests()
    {
        // Usar InMemory Database
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
            
        _context = new ApplicationDbContext(options);
        _repository = new OrderRepository(_context);
        
        // Seed data
        SeedDatabase();
    }
    
    private void SeedDatabase()
    {
        _context.Orders.AddRange(
            new Order { Id = 1, TableId = 1, Status = "Pending" },
            new Order { Id = 2, TableId = 2, Status = "Confirmed" }
        );
        _context.SaveChanges();
    }
    
    [Fact]
    public async Task GetByIdAsync_ExistingOrder_ReturnsOrder()
    {
        // Act
        var order = await _repository.GetByIdAsync(1);
        
        // Assert
        order.Should().NotBeNull();
        order.Id.Should().Be(1);
        order.Status.Should().Be("Pending");
    }
    
    [Fact]
    public async Task GetActiveOrdersAsync_ReturnsOnlyActiveOrders()
    {
        // Act
        var orders = await _repository.GetActiveOrdersAsync();
        
        // Assert
        orders.Should().HaveCount(2);
        orders.Should().AllSatisfy(o => 
            o.Status.Should().NotBe("Completed"));
    }
}
```

---

## 🎭 E2E TESTING

### Framework: Playwright (Recomendado)

#### Setup

```bash
npm install -D @playwright/test
npx playwright install
```

#### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Ejemplo E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cliente - Flujo de Orden Completo', () => {
  test('Escanear QR, agregar items y confirmar orden', async ({ page }) => {
    // 1. Escanear QR (simular)
    await page.goto('/table/table-1');
    
    // Verificar información de mesa
    await expect(page.getByText('Mesa 1')).toBeVisible();
    await expect(page.getByText('Terraza')).toBeVisible();
    
    // Esperar redirección automática al menú
    await page.waitForURL('/menu', { timeout: 3000 });
    
    // 2. Explorar menú
    await expect(page.getByRole('heading', { name: 'Entradas' })).toBeVisible();
    
    // 3. Buscar platillo
    const searchInput = page.getByPlaceholder('Buscar platillos');
    await searchInput.fill('Ensalada');
    
    // Verificar resultados de búsqueda
    await expect(page.getByText('Ensalada César')).toBeVisible();
    
    // 4. Agregar al carrito
    await page.getByRole('button', { name: 'Agregar' }).first().click();
    
    // Verificar notificación
    await expect(page.getByText('Agregado al carrito')).toBeVisible();
    
    // Verificar contador del carrito
    await expect(page.getByText('1')).toBeVisible(); // Badge del carrito
    
    // 5. Ir al carrito
    await page.getByRole('link', { name: 'Carrito' }).click();
    
    // Verificar items en carrito
    await expect(page.getByText('Ensalada César')).toBeVisible();
    await expect(page.getByText('RD$ 350.00')).toBeVisible();
    
    // 6. Confirmar orden
    await page.getByRole('button', { name: 'Confirmar Orden' }).click();
    
    // 7. Verificar confirmación
    await expect(page.getByText('¡Orden Enviada!')).toBeVisible();
    await expect(page.getByText(/ORD-\d+-\d+/)).toBeVisible();
  });
  
  test('Aplicar filtros dietéticos', async ({ page }) => {
    await page.goto('/menu');
    
    // Activar filtro vegetariano
    await page.getByRole('button', { name: 'Vegetariano' }).click();
    
    // Verificar que solo muestra platillos vegetarianos
    const dishes = page.locator('[data-testid="dish-card"]');
    const count = await dishes.count();
    
    for (let i = 0; i < count; i++) {
      const dish = dishes.nth(i);
      await expect(dish.getByTestId('vegetarian-icon')).toBeVisible();
    }
  });
});

test.describe('Mesero - Gestión de Mesas', () => {
  test.beforeEach(async ({ page }) => {
    // Login como mesero
    await page.goto('/login');
    await page.getByLabel('Email').fill('waiter@smartmenu.com');
    await page.getByLabel('Password').fill('Waiter123!');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    
    // Verificar redirección a Waiter App
    await page.waitForURL('http://localhost:3003');
  });
  
  test('Ver grid de mesas y estados', async ({ page }) => {
    // Verificar que carga el dashboard
    await expect(page.getByText('SmartMenu Waiter')).toBeVisible();
    
    // Verificar estadísticas
    await expect(page.getByText('Total:')).toBeVisible();
    await expect(page.getByText('Disponibles:')).toBeVisible();
    
    // Verificar que se muestran mesas
    const tables = page.locator('[data-testid="table-card"]');
    await expect(tables).toHaveCountGreaterThan(0);
  });
});

test.describe('Chef - KDS', () => {
  test('Ver órdenes activas', async ({ page }) => {
    // Login como chef
    await page.goto('/login');
    await page.getByLabel('Email').fill('chef@smartmenu.com');
    await page.getByLabel('Password').fill('Chef123!');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    
    // Verificar redirección a KDS
    await page.waitForURL('http://localhost:3002');
    
    // Verificar interfaz KDS
    await expect(page.getByText('Kitchen Display System')).toBeVisible();
    await expect(page.getByText('Juan Pérez')).toBeVisible();
  });
});
```

#### Ejecutar E2E Tests

```bash
# Todos los tests
npx playwright test

# Modo UI (interactivo)
npx playwright test --ui

# Solo un archivo
npx playwright test e2e/order-flow.spec.ts

# Con navegador visible
npx playwright test --headed

# Ver reporte
npx playwright show-report
```

---

## 📊 CODE COVERAGE

### Backend

```bash
# Instalar coverlet
dotnet add package coverlet.collector

# Ejecutar con coverage
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover

# Generar reporte HTML
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:"coverage.opencover.xml" -targetdir:"coverage-report" -reporttypes:Html

# Abrir reporte
start coverage-report/index.html
```

### Frontend

```bash
# Instalar c8
npm install -D c8

# package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}

# Ejecutar
npm run test:coverage
```

### Metas de Coverage

```
Statements:   > 80%
Branches:     > 75%
Functions:    > 80%
Lines:        > 80%
```

---

## 🎯 TEST DATA BUILDERS

### Pattern: Builder para Tests

```csharp
public class OrderTestBuilder
{
    private int _tableId = 1;
    private string _sessionId = "test-session";
    private string _status = "Pending";
    private List<OrderItem> _items = new();
    
    public OrderTestBuilder WithTableId(int tableId)
    {
        _tableId = tableId;
        return this;
    }
    
    public OrderTestBuilder WithStatus(string status)
    {
        _status = status;
        return this;
    }
    
    public OrderTestBuilder WithItem(OrderItem item)
    {
        _items.Add(item);
        return this;
    }
    
    public Order Build()
    {
        return new Order
        {
            TableId = _tableId,
            SessionId = _sessionId,
            Status = _status,
            Items = _items
        };
    }
}

// Uso en tests
[Fact]
public void Test_OrderWithMultipleItems()
{
    // Arrange
    var order = new OrderTestBuilder()
        .WithTableId(5)
        .WithStatus("Confirmed")
        .WithItem(new OrderItem { DishId = 1, Quantity = 2 })
        .WithItem(new OrderItem { DishId = 3, Quantity = 1 })
        .Build();
    
    // Act & Assert
    order.Items.Should().HaveCount(2);
}
```

---

## ✅ CHECKLIST DE TESTING

### Antes de Commit
- [ ] Todos los tests pasan
- [ ] No hay tests ignorados ([Fact(Skip = "...")])
- [ ] Coverage mínimo 80%
- [ ] No hay console.log() en producción

### Antes de PR
- [ ] Tests de integración pasan
- [ ] E2E de flujos críticos pasan
- [ ] Performance tests pasan
- [ ] Tests en CI/CD pasan

### Antes de Release
- [ ] Regression testing completo
- [ ] Load testing ejecutado
- [ ] Security testing ejecutado
- [ ] UAT (User Acceptance Testing) completado

---

## 🚀 CI/CD TESTING

### GitHub Actions Ejemplo

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '9.0.x'
    
    - name: Restore dependencies
      run: dotnet restore
    
    - name: Build
      run: dotnet build --no-restore
    
    - name: Test
      run: dotnet test --no-build --verbosity normal /p:CollectCoverage=true
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## 📝 DOCUMENTACIÓN DE TESTS

```csharp
/// <summary>
/// Tests para OrderService - Gestión de órdenes del sistema
/// </summary>
/// <remarks>
/// Casos cubiertos:
/// - Creación de órdenes con datos válidos
/// - Validación de datos inválidos
/// - Cálculo de totales con impuestos
/// - Manejo de excepciones
/// </remarks>
public class OrderServiceTests
{
    // Tests aquí
}
```

---

**Estado Actual:**
- ✅ Unit Tests: 10 tests implementados
- ⚠️ Integration Tests: Pendiente
- ⚠️ E2E Tests: Pendiente
- 📊 Coverage: ~60%
- 🎯 Meta: 80%

**Última Actualización:** 7 de Febrero de 2026
