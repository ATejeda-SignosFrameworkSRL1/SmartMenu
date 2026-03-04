# 🧪 ESTRATEGIA DE UNIT TESTING - SMART MENU

## **📋 ÍNDICE**

1. [Filosofía de Testing](#filosofía-de-testing)
2. [Estructura del Proyecto de Tests](#estructura-del-proyecto-de-tests)
3. [Backend .NET - Unit Tests](#backend-net---unit-tests)
4. [Frontend React - Unit Tests](#frontend-react---unit-tests)
5. [Integration Tests](#integration-tests)
6. [E2E Tests](#e2e-tests)
7. [Coverage Goals](#coverage-goals)
8. [CI/CD Integration](#cicd-integration)

---

## **📖 FILOSOFÍA DE TESTING**

### **Principios**

```
1. Write Tests FIRST (TDD)
   - Red → Green → Refactor

2. Test Behavior, Not Implementation
   - Focus on what the code does
   - Not how it does it

3. AAA Pattern
   - Arrange → Act → Assert

4. FIRST Principles
   - Fast
   - Independent
   - Repeatable
   - Self-Validating
   - Timely

5. Coverage != Quality
   - Aim for 80%+ but focus on critical paths
```

### **Testing Pyramid**

```
           /\
          /  \
         / E2E\ (10%)
        /______\
       /        \
      /Integration\ (20%)
     /____________\
    /              \
   /   Unit Tests   \ (70%)
  /__________________\
```

---

## **📁 ESTRUCTURA DEL PROYECTO DE TESTS**

### **.NET Solution Structure**

```
SmartMenu.Tests/
├── UnitTests/
│   ├── SmartMenu.Domain.UnitTests/
│   │   ├── Entities/
│   │   │   ├── DishTests.cs
│   │   │   ├── OrderTests.cs
│   │   │   └── TableTests.cs
│   │   └── ValueObjects/
│   │       └── PriceTests.cs
│   │
│   ├── SmartMenu.Application.UnitTests/
│   │   ├── Services/
│   │   │   ├── OrderServiceTests.cs
│   │   │   ├── MenuServiceTests.cs
│   │   │   ├── PaymentServiceTests.cs
│   │   │   └── NotificationServiceTests.cs
│   │   ├── Validators/
│   │   │   ├── CreateOrderValidatorTests.cs
│   │   │   └── CreateDishValidatorTests.cs
│   │   └── Queries/
│   │       └── GetMenuQueryTests.cs
│   │
│   └── SmartMenu.API.UnitTests/
│       ├── Controllers/
│       │   ├── OrdersControllerTests.cs
│       │   ├── MenuControllerTests.cs
│       │   └── TablesControllerTests.cs
│       └── Middleware/
│           └── ExceptionHandlingMiddlewareTests.cs
│
├── IntegrationTests/
│   ├── SmartMenu.IntegrationTests/
│   │   ├── Controllers/
│   │   ├── Database/
│   │   ├── SignalR/
│   │   └── Fixtures/
│   │       └── WebApplicationFactory.cs
│   │
│   └── SmartMenu.Persistence.IntegrationTests/
│       ├── Repositories/
│       └── Queries/
│
├── E2ETests/
│   └── SmartMenu.E2ETests/
│       ├── CustomerJourney/
│       ├── WaiterJourney/
│       └── AdminJourney/
│
└── TestUtilities/
    ├── Builders/
    │   ├── OrderBuilder.cs
    │   ├── DishBuilder.cs
    │   └── UserBuilder.cs
    ├── Fixtures/
    │   └── DatabaseFixture.cs
    ├── Mocks/
    │   └── MockData.cs
    └── Extensions/
        └── AssertExtensions.cs
```

### **React Tests Structure**

```
src/
├── components/
│   ├── Menu/
│   │   ├── DishCard.tsx
│   │   ├── DishCard.test.tsx           # Unit test
│   │   ├── CategoryFilter.tsx
│   │   └── CategoryFilter.test.tsx
│   └── Cart/
│       ├── CartItem.tsx
│       ├── CartItem.test.tsx
│       └── __mocks__/
│           └── cartData.ts
│
├── services/
│   ├── api/
│   │   ├── orderService.ts
│   │   └── orderService.test.ts
│   └── signalr/
│       ├── SignalRService.ts
│       └── SignalRService.test.ts
│
├── hooks/
│   ├── useCart.ts
│   ├── useCart.test.ts
│   ├── useSignalR.ts
│   └── useSignalR.test.ts
│
├── store/
│   ├── slices/
│   │   ├── cartSlice.ts
│   │   ├── cartSlice.test.ts
│   │   ├── menuSlice.ts
│   │   └── menuSlice.test.ts
│   └── store.test.ts
│
├── utils/
│   ├── formatters.ts
│   ├── formatters.test.ts
│   ├── validators.ts
│   └── validators.test.ts
│
└── __tests__/
    ├── integration/
    │   ├── OrderFlow.test.tsx
    │   └── PaymentFlow.test.tsx
    └── e2e/
        └── CustomerJourney.spec.ts
```

---

## **🔧 BACKEND .NET - UNIT TESTS**

### **Setup de Testing**

```xml
<!-- SmartMenu.Application.UnitTests.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xUnit" Version="2.6.0" />
    <PackageReference Include="xUnit.runner.visualstudio" Version="2.5.4" />
    <PackageReference Include="FluentAssertions" Version="6.12.0" />
    <PackageReference Include="Moq" Version="4.20.0" />
    <PackageReference Include="AutoFixture" Version="4.18.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="9.0.0" />
    <PackageReference Include="coverlet.collector" Version="6.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\Application\SmartMenu.Application\SmartMenu.Application.csproj" />
  </ItemGroup>
</Project>
```

---

### **1. Entity Tests (Domain Layer)**

```csharp
// SmartMenu.Domain.UnitTests/Entities/OrderTests.cs
using Xunit;
using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Domain.UnitTests.Entities
{
    public class OrderTests
    {
        [Fact]
        public void CreateOrder_WithValidData_ShouldCreateOrder()
        {
            // Arrange
            var tableId = 12;
            var sessionId = "abc123xyz";
            var items = new List<OrderItem>
            {
                new OrderItem
                {
                    DishId = 1,
                    Quantity = 1,
                    UnitPrice = 385.00m
                }
            };

            // Act
            var order = new Order
            {
                TableId = tableId,
                SessionId = sessionId,
                Items = items,
                Status = OrderStatus.Pending
            };

            // Assert
            order.Should().NotBeNull();
            order.TableId.Should().Be(tableId);
            order.SessionId.Should().Be(sessionId);
            order.Items.Should().HaveCount(1);
            order.Status.Should().Be(OrderStatus.Pending);
        }

        [Fact]
        public void CalculateTotal_WithMultipleItems_ShouldReturnCorrectTotal()
        {
            // Arrange
            var order = new Order
            {
                Items = new List<OrderItem>
                {
                    new OrderItem { Quantity = 1, UnitPrice = 385.00m },
                    new OrderItem { Quantity = 2, UnitPrice = 145.00m },
                    new OrderItem { Quantity = 1, UnitPrice = 195.00m }
                }
            };

            // Act
            var total = order.CalculateTotal();

            // Assert
            total.Should().Be(870.00m); // 385 + 290 + 195
        }

        [Fact]
        public void ChangeStatus_FromPendingToConfirmed_ShouldUpdateStatus()
        {
            // Arrange
            var order = new Order { Status = OrderStatus.Pending };

            // Act
            order.ChangeStatus(OrderStatus.Confirmed);

            // Assert
            order.Status.Should().Be(OrderStatus.Confirmed);
            order.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        }

        [Theory]
        [InlineData(OrderStatus.Cancelled, OrderStatus.Confirmed)]
        [InlineData(OrderStatus.Completed, OrderStatus.Pending)]
        public void ChangeStatus_InvalidTransition_ShouldThrowException(
            OrderStatus currentStatus, 
            OrderStatus newStatus)
        {
            // Arrange
            var order = new Order { Status = currentStatus };

            // Act
            Action act = () => order.ChangeStatus(newStatus);

            // Assert
            act.Should().Throw<InvalidOperationException>()
               .WithMessage($"Cannot change status from {currentStatus} to {newStatus}");
        }

        [Fact]
        public void AddItem_ValidItem_ShouldAddToOrderItems()
        {
            // Arrange
            var order = new Order { Items = new List<OrderItem>() };
            var item = new OrderItem
            {
                DishId = 1,
                Quantity = 1,
                UnitPrice = 100.00m
            };

            // Act
            order.AddItem(item);

            // Assert
            order.Items.Should().HaveCount(1);
            order.Items.Should().Contain(item);
        }

        [Fact]
        public void RemoveItem_ExistingItem_ShouldRemoveFromOrderItems()
        {
            // Arrange
            var item = new OrderItem { Id = 1, DishId = 1, Quantity = 1, UnitPrice = 100.00m };
            var order = new Order
            {
                Items = new List<OrderItem> { item }
            };

            // Act
            order.RemoveItem(item.Id);

            // Assert
            order.Items.Should().BeEmpty();
        }
    }
}
```

---

### **2. Service Tests (Application Layer)**

```csharp
// SmartMenu.Application.UnitTests/Services/OrderServiceTests.cs
using Xunit;
using Moq;
using FluentAssertions;
using AutoFixture;
using SmartMenu.Application.Services;
using SmartMenu.Application.DTOs;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Interfaces;
using SmartMenu.Application.Interfaces;

namespace SmartMenu.Application.UnitTests.Services
{
    public class OrderServiceTests
    {
        private readonly Mock<IOrderRepository> _mockOrderRepository;
        private readonly Mock<IMenuService> _mockMenuService;
        private readonly Mock<ITableService> _mockTableService;
        private readonly Mock<INotificationService> _mockNotificationService;
        private readonly Mock<IInventoryService> _mockInventoryService;
        private readonly OrderService _sut; // System Under Test
        private readonly IFixture _fixture;

        public OrderServiceTests()
        {
            _mockOrderRepository = new Mock<IOrderRepository>();
            _mockMenuService = new Mock<IMenuService>();
            _mockTableService = new Mock<ITableService>();
            _mockNotificationService = new Mock<INotificationService>();
            _mockInventoryService = new Mock<IInventoryService>();
            
            _sut = new OrderService(
                _mockOrderRepository.Object,
                _mockMenuService.Object,
                _mockTableService.Object,
                _mockNotificationService.Object,
                _mockInventoryService.Object
            );

            _fixture = new Fixture();
        }

        [Fact]
        public async Task CreateOrder_WithValidData_ShouldCreateAndReturnOrder()
        {
            // Arrange
            var createOrderDto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "abc123xyz",
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto
                    {
                        DishId = 1,
                        Quantity = 1,
                        UnitPrice = 385.00m
                    }
                }
            };

            var expectedOrder = new Order
            {
                Id = 1,
                TableId = createOrderDto.TableId,
                SessionId = createOrderDto.SessionId,
                Status = OrderStatus.Pending
            };

            _mockTableService
                .Setup(x => x.ValidateSessionAsync(It.IsAny<int>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            _mockMenuService
                .Setup(x => x.ValidateDishAsync(It.IsAny<int>()))
                .ReturnsAsync(true);

            _mockOrderRepository
                .Setup(x => x.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedOrder);

            // Act
            var result = await _sut.CreateOrderAsync(createOrderDto);

            // Assert
            result.Should().NotBeNull();
            result.TableId.Should().Be(createOrderDto.TableId);
            result.SessionId.Should().Be(createOrderDto.SessionId);

            _mockOrderRepository.Verify(
                x => x.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), 
                Times.Once
            );

            _mockNotificationService.Verify(
                x => x.NotifyOrderCreatedAsync(It.IsAny<int>(), It.IsAny<int>()), 
                Times.Once
            );
        }

        [Fact]
        public async Task CreateOrder_WithInvalidSession_ShouldThrowException()
        {
            // Arrange
            var createOrderDto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "invalid",
                Items = new List<CreateOrderItemDto>()
            };

            _mockTableService
                .Setup(x => x.ValidateSessionAsync(It.IsAny<int>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            // Act
            Func<Task> act = async () => await _sut.CreateOrderAsync(createOrderDto);

            // Assert
            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Invalid table session");

            _mockOrderRepository.Verify(
                x => x.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), 
                Times.Never
            );
        }

        [Fact]
        public async Task GetOrderById_ExistingOrder_ShouldReturnOrder()
        {
            // Arrange
            var orderId = 1;
            var expectedOrder = _fixture.Build<Order>()
                .With(o => o.Id, orderId)
                .Create();

            _mockOrderRepository
                .Setup(x => x.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedOrder);

            // Act
            var result = await _sut.GetOrderByIdAsync(orderId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(orderId);
        }

        [Fact]
        public async Task GetOrderById_NonExistingOrder_ShouldReturnNull()
        {
            // Arrange
            var orderId = 999;

            _mockOrderRepository
                .Setup(x => x.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Order)null);

            // Act
            var result = await _sut.GetOrderByIdAsync(orderId);

            // Assert
            result.Should().BeNull();
        }

        [Theory]
        [InlineData(OrderStatus.Pending, OrderStatus.Confirmed)]
        [InlineData(OrderStatus.Confirmed, OrderStatus.Preparing)]
        [InlineData(OrderStatus.Preparing, OrderStatus.Ready)]
        public async Task UpdateOrderStatus_ValidTransition_ShouldUpdateAndNotify(
            OrderStatus currentStatus, 
            OrderStatus newStatus)
        {
            // Arrange
            var orderId = 1;
            var order = new Order
            {
                Id = orderId,
                Status = currentStatus
            };

            _mockOrderRepository
                .Setup(x => x.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(order);

            _mockOrderRepository
                .Setup(x => x.UpdateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            // Act
            await _sut.UpdateOrderStatusAsync(orderId, newStatus);

            // Assert
            order.Status.Should().Be(newStatus);

            _mockOrderRepository.Verify(
                x => x.UpdateAsync(It.Is<Order>(o => o.Id == orderId && o.Status == newStatus), 
                    It.IsAny<CancellationToken>()), 
                Times.Once
            );

            _mockNotificationService.Verify(
                x => x.NotifyOrderStatusChangedAsync(orderId, newStatus.ToString()), 
                Times.Once
            );
        }

        [Fact]
        public async Task CancelOrder_ExistingOrder_ShouldCancelAndRestoreInventory()
        {
            // Arrange
            var orderId = 1;
            var order = new Order
            {
                Id = orderId,
                Status = OrderStatus.Pending,
                Items = new List<OrderItem>
                {
                    new OrderItem { DishId = 1, Quantity = 2 }
                }
            };

            _mockOrderRepository
                .Setup(x => x.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(order);

            // Act
            await _sut.CancelOrderAsync(orderId);

            // Assert
            order.Status.Should().Be(OrderStatus.Cancelled);

            _mockInventoryService.Verify(
                x => x.RestoreInventoryAsync(It.IsAny<List<OrderItem>>()), 
                Times.Once
            );

            _mockNotificationService.Verify(
                x => x.NotifyOrderCancelledAsync(orderId), 
                Times.Once
            );
        }
    }
}
```

---

### **3. Controller Tests (API Layer)**

```csharp
// SmartMenu.API.UnitTests/Controllers/OrdersControllerTests.cs
using Xunit;
using Moq;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using SmartMenu.API.Controllers;
using SmartMenu.Application.Services;
using SmartMenu.Application.DTOs;

namespace SmartMenu.API.UnitTests.Controllers
{
    public class OrdersControllerTests
    {
        private readonly Mock<IOrderService> _mockOrderService;
        private readonly OrdersController _controller;

        public OrdersControllerTests()
        {
            _mockOrderService = new Mock<IOrderService>();
            _controller = new OrdersController(_mockOrderService.Object);
        }

        [Fact]
        public async Task CreateOrder_ValidRequest_ReturnsCreatedResult()
        {
            // Arrange
            var createOrderDto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "abc123",
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { DishId = 1, Quantity = 1, UnitPrice = 100.00m }
                }
            };

            var createdOrder = new OrderDto
            {
                Id = 1,
                TableId = 12,
                Total = 100.00m
            };

            _mockOrderService
                .Setup(x => x.CreateOrderAsync(It.IsAny<CreateOrderDto>()))
                .ReturnsAsync(createdOrder);

            // Act
            var result = await _controller.CreateOrder(createOrderDto);

            // Assert
            var createdAtActionResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
            createdAtActionResult.StatusCode.Should().Be(201);
            createdAtActionResult.Value.Should().BeEquivalentTo(createdOrder);
        }

        [Fact]
        public async Task GetOrder_ExistingId_ReturnsOkResult()
        {
            // Arrange
            var orderId = 1;
            var orderDto = new OrderDto
            {
                Id = orderId,
                TableId = 12,
                Total = 100.00m
            };

            _mockOrderService
                .Setup(x => x.GetOrderByIdAsync(orderId))
                .ReturnsAsync(orderDto);

            // Act
            var result = await _controller.GetOrder(orderId);

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            okResult.StatusCode.Should().Be(200);
            okResult.Value.Should().BeEquivalentTo(orderDto);
        }

        [Fact]
        public async Task GetOrder_NonExistingId_ReturnsNotFound()
        {
            // Arrange
            var orderId = 999;

            _mockOrderService
                .Setup(x => x.GetOrderByIdAsync(orderId))
                .ReturnsAsync((OrderDto)null);

            // Act
            var result = await _controller.GetOrder(orderId);

            // Assert
            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task UpdateOrderStatus_ValidRequest_ReturnsNoContent()
        {
            // Arrange
            var orderId = 1;
            var newStatus = OrderStatus.Confirmed;

            _mockOrderService
                .Setup(x => x.UpdateOrderStatusAsync(orderId, newStatus))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _controller.UpdateOrderStatus(orderId, newStatus);

            // Assert
            result.Should().BeOfType<NoContentResult>();
        }

        [Fact]
        public async Task CreateOrder_InvalidModelState_ReturnsBadRequest()
        {
            // Arrange
            _controller.ModelState.AddModelError("TableId", "TableId is required");
            var createOrderDto = new CreateOrderDto();

            // Act
            var result = await _controller.CreateOrder(createOrderDto);

            // Assert
            result.Result.Should().BeOfType<BadRequestObjectResult>();
        }
    }
}
```

---

### **4. Validator Tests (FluentValidation)**

```csharp
// SmartMenu.Application.UnitTests/Validators/CreateOrderValidatorTests.cs
using Xunit;
using FluentAssertions;
using FluentValidation.TestHelper;
using SmartMenu.Application.Validators;
using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.UnitTests.Validators
{
    public class CreateOrderValidatorTests
    {
        private readonly CreateOrderValidator _validator;

        public CreateOrderValidatorTests()
        {
            _validator = new CreateOrderValidator();
        }

        [Fact]
        public void Validate_ValidOrder_ShouldNotHaveValidationError()
        {
            // Arrange
            var dto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "abc123xyz",
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { DishId = 1, Quantity = 1, UnitPrice = 100.00m }
                }
            };

            // Act
            var result = _validator.TestValidate(dto);

            // Assert
            result.ShouldNotHaveAnyValidationErrors();
        }

        [Fact]
        public void Validate_EmptyTableId_ShouldHaveValidationError()
        {
            // Arrange
            var dto = new CreateOrderDto
            {
                TableId = 0,
                SessionId = "abc123",
                Items = new List<CreateOrderItemDto>()
            };

            // Act
            var result = _validator.TestValidate(dto);

            // Assert
            result.ShouldHaveValidationErrorFor(x => x.TableId)
                  .WithErrorMessage("TableId must be greater than 0");
        }

        [Fact]
        public void Validate_EmptySessionId_ShouldHaveValidationError()
        {
            // Arrange
            var dto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "",
                Items = new List<CreateOrderItemDto>()
            };

            // Act
            var result = _validator.TestValidate(dto);

            // Assert
            result.ShouldHaveValidationErrorFor(x => x.SessionId)
                  .WithErrorMessage("SessionId is required");
        }

        [Fact]
        public void Validate_EmptyItems_ShouldHaveValidationError()
        {
            // Arrange
            var dto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "abc123",
                Items = new List<CreateOrderItemDto>()
            };

            // Act
            var result = _validator.TestValidate(dto);

            // Assert
            result.ShouldHaveValidationErrorFor(x => x.Items)
                  .WithErrorMessage("Order must have at least one item");
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void Validate_InvalidQuantity_ShouldHaveValidationError(int quantity)
        {
            // Arrange
            var dto = new CreateOrderDto
            {
                TableId = 12,
                SessionId = "abc123",
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { DishId = 1, Quantity = quantity, UnitPrice = 100.00m }
                }
            };

            // Act
            var result = _validator.TestValidate(dto);

            // Assert
            result.ShouldHaveValidationErrorFor("Items[0].Quantity");
        }
    }
}
```

---

## **⚛️ FRONTEND REACT - UNIT TESTS**

### **Setup de Testing**

```json
// package.json
{
  "devDependencies": {
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "@testing-library/react-hooks": "^8.0.1",
    "vitest": "^1.0.4",
    "@vitest/ui": "^1.0.4",
    "jsdom": "^23.0.1",
    "msw": "^2.0.11"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

---

### **1. Component Tests**

```typescript
// src/components/Menu/DishCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DishCard } from './DishCard';

describe('DishCard', () => {
  const mockDish = {
    id: 1,
    name: 'Ribeye Premium',
    description: 'Premium aged beef',
    price: 385.00,
    image: '/images/ribeye.jpg',
    isAvailable: true,
    isVegetarian: false,
    rating: 4.9,
    preparationTime: 25,
  };

  it('should render dish information correctly', () => {
    // Arrange & Act
    render(<DishCard dish={mockDish} onAddToCart={vi.fn()} />);

    // Assert
    expect(screen.getByText('Ribeye Premium')).toBeInTheDocument();
    expect(screen.getByText('Premium aged beef')).toBeInTheDocument();
    expect(screen.getByText('$385.00')).toBeInTheDocument();
    expect(screen.getByText('⭐ 4.9')).toBeInTheDocument();
    expect(screen.getByText('⏱️ 25 min')).toBeInTheDocument();
  });

  it('should display dish image with correct alt text', () => {
    // Arrange & Act
    render(<DishCard dish={mockDish} onAddToCart={vi.fn()} />);

    // Assert
    const image = screen.getByAltText('Ribeye Premium');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/images/ribeye.jpg');
  });

  it('should call onAddToCart when add button is clicked', () => {
    // Arrange
    const mockOnAddToCart = vi.fn();
    render(<DishCard dish={mockDish} onAddToCart={mockOnAddToCart} />);

    // Act
    const addButton = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addButton);

    // Assert
    expect(mockOnAddToCart).toHaveBeenCalledTimes(1);
    expect(mockOnAddToCart).toHaveBeenCalledWith(mockDish);
  });

  it('should disable add button when dish is not available', () => {
    // Arrange
    const unavailableDish = { ...mockDish, isAvailable: false };
    render(<DishCard dish={unavailableDish} onAddToCart={vi.fn()} />);

    // Act
    const addButton = screen.getByRole('button', { name: /no disponible/i });

    // Assert
    expect(addButton).toBeDisabled();
    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('should display vegetarian badge when dish is vegetarian', () => {
    // Arrange
    const vegetarianDish = { ...mockDish, isVegetarian: true };
    render(<DishCard dish={vegetarianDish} onAddToCart={vi.fn()} />);

    // Assert
    expect(screen.getByText('🌱 Vegetariano')).toBeInTheDocument();
  });

  it('should open details modal when "Ver Detalles" is clicked', () => {
    // Arrange
    render(<DishCard dish={mockDish} onAddToCart={vi.fn()} />);

    // Act
    const detailsButton = screen.getByText('Ver Detalles');
    fireEvent.click(detailsButton);

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ribeye Premium')).toBeInTheDocument();
  });
});
```

---

### **2. Hook Tests**

```typescript
// src/hooks/useCart.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCart } from './useCart';

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty cart', () => {
    // Arrange & Act
    const { result } = renderHook(() => useCart());

    // Assert
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('should add item to cart', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    // Act
    act(() => {
      result.current.addItem(dish);
    });

    // Assert
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(dish);
    expect(result.current.itemCount).toBe(1);
    expect(result.current.total).toBe(385.00);
  });

  it('should increase quantity when adding same item twice', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    // Act
    act(() => {
      result.current.addItem(dish);
      result.current.addItem(dish);
    });

    // Assert
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.total).toBe(770.00);
  });

  it('should remove item from cart', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    act(() => {
      result.current.addItem(dish);
    });

    // Act
    act(() => {
      result.current.removeItem(1);
    });

    // Assert
    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  it('should update item quantity', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    act(() => {
      result.current.addItem(dish);
    });

    // Act
    act(() => {
      result.current.updateQuantity(1, 3);
    });

    // Assert
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.total).toBe(1155.00);
  });

  it('should clear cart', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    act(() => {
      result.current.addItem(dish);
    });

    // Act
    act(() => {
      result.current.clearCart();
    });

    // Assert
    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  it('should persist cart to localStorage', () => {
    // Arrange
    const { result } = renderHook(() => useCart());
    const dish = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    // Act
    act(() => {
      result.current.addItem(dish);
    });

    // Assert
    const storedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    expect(storedCart).toHaveLength(1);
    expect(storedCart[0]).toEqual(dish);
  });

  it('should restore cart from localStorage on mount', () => {
    // Arrange
    const existingCart = [
      { id: 1, name: 'Ribeye Premium', price: 385.00, quantity: 1 },
      { id: 2, name: 'Ensalada', price: 145.00, quantity: 1 },
    ];
    localStorage.setItem('cart', JSON.stringify(existingCart));

    // Act
    const { result } = renderHook(() => useCart());

    // Assert
    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(530.00);
  });
});
```

---

### **3. Redux Slice Tests**

```typescript
// src/store/slices/cartSlice.test.ts
import { describe, it, expect } from 'vitest';
import cartReducer, {
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
} from './cartSlice';

describe('cartSlice', () => {
  const initialState = {
    items: [],
    total: 0,
  };

  it('should return initial state', () => {
    // Act
    const result = cartReducer(undefined, { type: 'unknown' });

    // Assert
    expect(result).toEqual(initialState);
  });

  it('should handle addItem', () => {
    // Arrange
    const item = {
      id: 1,
      name: 'Ribeye Premium',
      price: 385.00,
      quantity: 1,
    };

    // Act
    const result = cartReducer(initialState, addItem(item));

    // Assert
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(item);
    expect(result.total).toBe(385.00);
  });

  it('should handle removeItem', () => {
    // Arrange
    const stateWithItem = {
      items: [
        { id: 1, name: 'Ribeye', price: 385.00, quantity: 1 },
      ],
      total: 385.00,
    };

    // Act
    const result = cartReducer(stateWithItem, removeItem(1));

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should handle updateQuantity', () => {
    // Arrange
    const stateWithItem = {
      items: [
        { id: 1, name: 'Ribeye', price: 385.00, quantity: 1 },
      ],
      total: 385.00,
    };

    // Act
    const result = cartReducer(
      stateWithItem,
      updateQuantity({ id: 1, quantity: 3 })
    );

    // Assert
    expect(result.items[0].quantity).toBe(3);
    expect(result.total).toBe(1155.00);
  });

  it('should handle clearCart', () => {
    // Arrange
    const stateWithItems = {
      items: [
        { id: 1, name: 'Ribeye', price: 385.00, quantity: 1 },
        { id: 2, name: 'Ensalada', price: 145.00, quantity: 1 },
      ],
      total: 530.00,
    };

    // Act
    const result = cartReducer(stateWithItems, clearCart());

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

---

### **4. API Service Tests (con MSW)**

```typescript
// src/services/api/orderService.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { orderService } from './orderService';

const server = setupServer(
  rest.post('http://localhost:5000/api/orders', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 1,
        tableId: 12,
        sessionId: 'abc123',
        total: 1073.00,
        status: 'Pending',
      })
    );
  }),

  rest.get('http://localhost:5000/api/orders/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        id: Number(id),
        tableId: 12,
        sessionId: 'abc123',
        total: 1073.00,
        status: 'Confirmed',
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('orderService', () => {
  it('should create order successfully', async () => {
    // Arrange
    const orderData = {
      tableId: 12,
      sessionId: 'abc123',
      items: [
        { dishId: 1, quantity: 1, unitPrice: 385.00 },
      ],
    };

    // Act
    const result = await orderService.createOrder(orderData);

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.tableId).toBe(12);
    expect(result.total).toBe(1073.00);
  });

  it('should get order by id', async () => {
    // Act
    const result = await orderService.getOrderById(1);

    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(result.status).toBe('Confirmed');
  });

  it('should handle API errors', async () => {
    // Arrange
    server.use(
      rest.post('http://localhost:5000/api/orders', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({ error: 'Invalid order data' })
        );
      })
    );

    // Act & Assert
    await expect(
      orderService.createOrder({})
    ).rejects.toThrow('Invalid order data');
  });
});
```

---

## **📊 COVERAGE GOALS**

### **Targets por Capa**

| Capa | Coverage Goal | Prioridad |
|------|---------------|-----------|
| **Domain Entities** | 90%+ | 🔴 Critical |
| **Application Services** | 85%+ | 🔴 Critical |
| **API Controllers** | 80%+ | 🟡 High |
| **Validators** | 90%+ | 🟡 High |
| **React Components** | 70%+ | 🟡 High |
| **React Hooks** | 80%+ | 🟡 High |
| **Redux Slices** | 85%+ | 🟡 High |
| **Utils/Helpers** | 90%+ | 🟢 Medium |

---

## **🚀 CI/CD INTEGRATION**

### **GitHub Actions Workflow**

```yaml
# .github/workflows/tests.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
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
      
      - name: Run Unit Tests
        run: dotnet test --no-build --verbosity normal --collect:"XPlat Code Coverage"
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: frontend
```

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**Stack:** .NET 9 + React + xUnit + Vitest
