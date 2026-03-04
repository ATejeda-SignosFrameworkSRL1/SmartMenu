# 09 - Modelo de Base de Datos SQL Server

**Proyecto:** SmartMenu - Sistema de Menú Digital  
**Base de Datos:** SQL Server 2022  
**Servidor:** sqldev.signos.com.do:1599  
**Database:** DbNewMenu

---

## 📊 DIAGRAMA ENTIDAD-RELACIÓN

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Restaurant    │────1:N──│      Zone        │────1:N──│      Table      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                                                          │
        │                                                          │
        │ 1:N                                                      │ 1:N
        │                                                          │
┌─────────────────┐                                       ┌─────────────────┐
│      User       │                                       │  TableSession   │
└─────────────────┘                                       └─────────────────┘
        │                                                          │
        │                                                          │
        │                                                          │ 1:N
        │                                                          │
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│    Category     │────1:N──│      Dish        │         │      Order      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │                            │
                                     │                            │
                                     │ 1:N                        │ 1:N
                                     │                            │
                            ┌──────────────────┐         ┌─────────────────┐
                            │  DishModifier    │         │   OrderItem     │
                            └──────────────────┘         └─────────────────┘
                                                                  │
                                                                  │ 1:N
                                                                  │
                                                         ┌─────────────────┐
                                                         │OrderItemModifier│
                                                         └─────────────────┘
```

---

## 📋 TABLAS Y ESTRUCTURA

### 1. Restaurants
Información del restaurante.

```sql
CREATE TABLE Restaurants (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(200) NOT NULL,
    Address NVARCHAR(500),
    Phone NVARCHAR(20),
    Email NVARCHAR(100),
    RNC NVARCHAR(50),
    Logo NVARCHAR(500),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2
);

-- Índices
CREATE NONCLUSTERED INDEX IX_Restaurants_IsActive 
    ON Restaurants(IsActive);
```

**Campos:**
- `Id`: Identificador único
- `Name`: Nombre del restaurante
- `Address`: Dirección física
- `Phone`: Teléfono de contacto
- `Email`: Email de contacto
- `RNC`: Registro Nacional de Contribuyentes (RD)
- `Logo`: URL del logo
- `IsActive`: Si el restaurante está activo
- `CreatedAt`: Fecha de creación
- `UpdatedAt`: Fecha de última actualización

---

### 2. Zones
Zonas del restaurante (Terraza, Salón Principal, Bar, etc.).

```sql
CREATE TABLE Zones (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    RestaurantId INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Zones_Restaurant 
        FOREIGN KEY (RestaurantId) REFERENCES Restaurants(Id)
);

-- Índices
CREATE NONCLUSTERED INDEX IX_Zones_RestaurantId 
    ON Zones(RestaurantId);
```

**Campos:**
- `Id`: Identificador único
- `Name`: Nombre de la zona
- `RestaurantId`: ID del restaurante
- `IsActive`: Si la zona está activa

---

### 3. Tables
Mesas del restaurante.

```sql
CREATE TABLE Tables (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TableNumber INT NOT NULL,
    Capacity INT NOT NULL,
    ZoneId INT NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Available',
    QrCode NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Tables_Zone 
        FOREIGN KEY (ZoneId) REFERENCES Zones(Id),
    CONSTRAINT CK_Tables_Status 
        CHECK (Status IN ('Available', 'Occupied', 'Reserved', 'OutOfService'))
);

-- Índices
CREATE UNIQUE NONCLUSTERED INDEX IX_Tables_QrCode 
    ON Tables(QrCode);
CREATE NONCLUSTERED INDEX IX_Tables_ZoneId 
    ON Tables(ZoneId);
CREATE NONCLUSTERED INDEX IX_Tables_Status 
    ON Tables(Status);
```

**Campos:**
- `Id`: Identificador único
- `TableNumber`: Número de mesa
- `Capacity`: Capacidad de personas
- `ZoneId`: ID de la zona
- `Status`: Estado (Available, Occupied, Reserved, OutOfService)
- `QrCode`: Código QR único de la mesa

---

### 4. Users
Usuarios del sistema (Admin, Chef, Waiter, etc.).

```sql
CREATE TABLE Users (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20),
    Role NVARCHAR(50) NOT NULL,
    RestaurantId INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastLogin DATETIME2,
    CONSTRAINT FK_Users_Restaurant 
        FOREIGN KEY (RestaurantId) REFERENCES Restaurants(Id),
    CONSTRAINT CK_Users_Role 
        CHECK (Role IN ('Admin', 'Manager', 'Chef', 'KitchenStaff', 
                       'Waiter', 'Hostess', 'Bartender', 'Cashier'))
);

-- Índices
CREATE UNIQUE NONCLUSTERED INDEX IX_Users_Email 
    ON Users(Email);
CREATE NONCLUSTERED INDEX IX_Users_Role 
    ON Users(Role);
CREATE NONCLUSTERED INDEX IX_Users_RestaurantId 
    ON Users(RestaurantId);
```

**Campos:**
- `Id`: Identificador único
- `Email`: Email único del usuario
- `PasswordHash`: Contraseña hasheada con BCrypt
- `FirstName`: Nombre
- `LastName`: Apellido
- `Phone`: Teléfono
- `Role`: Rol del usuario
- `RestaurantId`: ID del restaurante
- `IsActive`: Si el usuario está activo
- `LastLogin`: Última vez que inició sesión

---

### 5. Categories
Categorías del menú (Entradas, Platos Fuertes, Postres, etc.).

```sql
CREATE TABLE Categories (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    RestaurantId INT NOT NULL,
    SortOrder INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Categories_Restaurant 
        FOREIGN KEY (RestaurantId) REFERENCES Restaurants(Id)
);

-- Índices
CREATE NONCLUSTERED INDEX IX_Categories_RestaurantId 
    ON Categories(RestaurantId);
CREATE NONCLUSTERED INDEX IX_Categories_SortOrder 
    ON Categories(SortOrder);
```

**Campos:**
- `Id`: Identificador único
- `Name`: Nombre de la categoría
- `Description`: Descripción
- `RestaurantId`: ID del restaurante
- `SortOrder`: Orden de visualización
- `IsActive`: Si la categoría está activa

---

### 6. Dishes
Platillos del menú.

```sql
CREATE TABLE Dishes (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(1000),
    CategoryId INT NOT NULL,
    Price DECIMAL(10,2) NOT NULL,
    ImageUrl NVARCHAR(500),
    PreparationTimeMinutes INT NOT NULL DEFAULT 15,
    IsAvailable BIT NOT NULL DEFAULT 1,
    IsVegetarian BIT NOT NULL DEFAULT 0,
    IsVegan BIT NOT NULL DEFAULT 0,
    IsGlutenFree BIT NOT NULL DEFAULT 0,
    Calories INT,
    Allergens NVARCHAR(500),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2,
    CONSTRAINT FK_Dishes_Category 
        FOREIGN KEY (CategoryId) REFERENCES Categories(Id),
    CONSTRAINT CK_Dishes_Price 
        CHECK (Price >= 0)
);

-- Índices
CREATE NONCLUSTERED INDEX IX_Dishes_CategoryId 
    ON Dishes(CategoryId);
CREATE NONCLUSTERED INDEX IX_Dishes_IsAvailable 
    ON Dishes(IsAvailable);
CREATE FULLTEXT INDEX ON Dishes(Name, Description)
    KEY INDEX PK__Dishes;
```

**Campos:**
- `Id`: Identificador único
- `Name`: Nombre del platillo
- `Description`: Descripción detallada
- `CategoryId`: ID de la categoría
- `Price`: Precio en RD$
- `ImageUrl`: URL de la imagen
- `PreparationTimeMinutes`: Tiempo de preparación
- `IsAvailable`: Si está disponible
- `IsVegetarian`: Si es vegetariano
- `IsVegan`: Si es vegano
- `IsGlutenFree`: Si es libre de gluten
- `Calories`: Calorías
- `Allergens`: Alérgenos

---

### 7. DishModifiers
Modificadores de platillos (Extra queso, Sin cebolla, etc.).

```sql
CREATE TABLE DishModifiers (
    Id INT PRIMARY KEY IDENTITY(1,1),
    DishId INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    PriceAdjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_DishModifiers_Dish 
        FOREIGN KEY (DishId) REFERENCES Dishes(Id) ON DELETE CASCADE
);

-- Índices
CREATE NONCLUSTERED INDEX IX_DishModifiers_DishId 
    ON DishModifiers(DishId);
```

**Campos:**
- `Id`: Identificador único
- `DishId`: ID del platillo
- `Name`: Nombre del modificador
- `PriceAdjustment`: Ajuste de precio (puede ser 0, + o -)
- `IsActive`: Si está activo

---

### 8. TableSessions
Sesiones de mesa (cuando un cliente se sienta).

```sql
CREATE TABLE TableSessions (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TableId INT NOT NULL,
    SessionCode NVARCHAR(50) NOT NULL UNIQUE,
    StartTime DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    EndTime DATETIME2,
    CustomerCount INT NOT NULL DEFAULT 1,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Active',
    CONSTRAINT FK_TableSessions_Table 
        FOREIGN KEY (TableId) REFERENCES Tables(Id),
    CONSTRAINT CK_TableSessions_Status 
        CHECK (Status IN ('Active', 'Completed', 'Cancelled'))
);

-- Índices
CREATE UNIQUE NONCLUSTERED INDEX IX_TableSessions_SessionCode 
    ON TableSessions(SessionCode);
CREATE NONCLUSTERED INDEX IX_TableSessions_TableId 
    ON TableSessions(TableId);
CREATE NONCLUSTERED INDEX IX_TableSessions_Status 
    ON TableSessions(Status);
```

**Campos:**
- `Id`: Identificador único
- `TableId`: ID de la mesa
- `SessionCode`: Código único de sesión
- `StartTime`: Hora de inicio
- `EndTime`: Hora de finalización
- `CustomerCount`: Número de clientes
- `Status`: Estado (Active, Completed, Cancelled)

---

### 9. Orders
Órdenes de los clientes.

```sql
CREATE TABLE Orders (
    Id INT PRIMARY KEY IDENTITY(1,1),
    OrderNumber NVARCHAR(20) NOT NULL UNIQUE,
    TableId INT NOT NULL,
    SessionId NVARCHAR(50) NOT NULL,
    WaiterId INT,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    SubTotal DECIMAL(10,2) NOT NULL,
    TaxAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
    TipAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
    DiscountAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
    TotalAmount DECIMAL(10,2) NOT NULL,
    SpecialInstructions NVARCHAR(1000),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2,
    CompletedAt DATETIME2,
    CONSTRAINT FK_Orders_Table 
        FOREIGN KEY (TableId) REFERENCES Tables(Id),
    CONSTRAINT FK_Orders_Waiter 
        FOREIGN KEY (WaiterId) REFERENCES Users(Id),
    CONSTRAINT CK_Orders_Status 
        CHECK (Status IN ('Pending', 'Confirmed', 'Preparing', 'Ready', 
                         'Served', 'Completed', 'Cancelled'))
);

-- Índices
CREATE UNIQUE NONCLUSTERED INDEX IX_Orders_OrderNumber 
    ON Orders(OrderNumber);
CREATE NONCLUSTERED INDEX IX_Orders_TableId 
    ON Orders(TableId);
CREATE NONCLUSTERED INDEX IX_Orders_Status 
    ON Orders(Status);
CREATE NONCLUSTERED INDEX IX_Orders_CreatedAt 
    ON Orders(CreatedAt DESC);
```

**Campos:**
- `Id`: Identificador único
- `OrderNumber`: Número de orden único
- `TableId`: ID de la mesa
- `SessionId`: ID de la sesión
- `WaiterId`: ID del mesero (opcional)
- `Status`: Estado de la orden
- `SubTotal`: Subtotal
- `TaxAmount`: ITBIS (18%)
- `TipAmount`: Propina
- `DiscountAmount`: Descuento
- `TotalAmount`: Total
- `SpecialInstructions`: Instrucciones especiales

---

### 10. OrderItems
Items de cada orden.

```sql
CREATE TABLE OrderItems (
    Id INT PRIMARY KEY IDENTITY(1,1),
    OrderId INT NOT NULL,
    DishId INT NOT NULL,
    Quantity INT NOT NULL DEFAULT 1,
    UnitPrice DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,
    Notes NVARCHAR(500),
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_OrderItems_Order 
        FOREIGN KEY (OrderId) REFERENCES Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Dish 
        FOREIGN KEY (DishId) REFERENCES Dishes(Id),
    CONSTRAINT CK_OrderItems_Quantity 
        CHECK (Quantity > 0),
    CONSTRAINT CK_OrderItems_Status 
        CHECK (Status IN ('Pending', 'Preparing', 'Ready', 'Served', 'Cancelled'))
);

-- Índices
CREATE NONCLUSTERED INDEX IX_OrderItems_OrderId 
    ON OrderItems(OrderId);
CREATE NONCLUSTERED INDEX IX_OrderItems_DishId 
    ON OrderItems(DishId);
CREATE NONCLUSTERED INDEX IX_OrderItems_Status 
    ON OrderItems(Status);
```

**Campos:**
- `Id`: Identificador único
- `OrderId`: ID de la orden
- `DishId`: ID del platillo
- `Quantity`: Cantidad
- `UnitPrice`: Precio unitario
- `Subtotal`: Subtotal (Quantity * UnitPrice + modificadores)
- `Notes`: Notas especiales
- `Status`: Estado del item

---

### 11. OrderItemModifiers
Modificadores aplicados a items de orden.

```sql
CREATE TABLE OrderItemModifiers (
    Id INT PRIMARY KEY IDENTITY(1,1),
    OrderItemId INT NOT NULL,
    DishModifierId INT NOT NULL,
    PriceAdjustment DECIMAL(10,2) NOT NULL,
    CONSTRAINT FK_OrderItemModifiers_OrderItem 
        FOREIGN KEY (OrderItemId) REFERENCES OrderItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItemModifiers_DishModifier 
        FOREIGN KEY (DishModifierId) REFERENCES DishModifiers(Id)
);

-- Índices
CREATE NONCLUSTERED INDEX IX_OrderItemModifiers_OrderItemId 
    ON OrderItemModifiers(OrderItemId);
```

**Campos:**
- `Id`: Identificador único
- `OrderItemId`: ID del item de orden
- `DishModifierId`: ID del modificador
- `PriceAdjustment`: Ajuste de precio

---

### 12. Payments
Pagos realizados.

```sql
CREATE TABLE Payments (
    Id INT PRIMARY KEY IDENTITY(1,1),
    OrderId INT NOT NULL,
    PaymentMethod NVARCHAR(50) NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    TransactionId NVARCHAR(200),
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    ProcessedAt DATETIME2,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Payments_Order 
        FOREIGN KEY (OrderId) REFERENCES Orders(Id),
    CONSTRAINT CK_Payments_Method 
        CHECK (PaymentMethod IN ('Cash', 'Card', 'Transfer', 'Digital')),
    CONSTRAINT CK_Payments_Status 
        CHECK (Status IN ('Pending', 'Completed', 'Failed', 'Refunded'))
);

-- Índices
CREATE NONCLUSTERED INDEX IX_Payments_OrderId 
    ON Payments(OrderId);
CREATE NONCLUSTERED INDEX IX_Payments_Status 
    ON Payments(Status);
```

**Campos:**
- `Id`: Identificador único
- `OrderId`: ID de la orden
- `PaymentMethod`: Método de pago
- `Amount`: Monto pagado
- `TransactionId`: ID de transacción externa
- `Status`: Estado del pago

---

## 🔧 STORED PROCEDURES

### SP_GetDailyRevenue
Obtiene ingresos del día.

```sql
CREATE PROCEDURE SP_GetDailyRevenue
    @Date DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(DISTINCT o.Id) AS TotalOrders,
        SUM(o.SubTotal) AS SubTotal,
        SUM(o.TaxAmount) AS TaxAmount,
        SUM(o.TipAmount) AS TipAmount,
        SUM(o.TotalAmount) AS TotalRevenue,
        AVG(o.TotalAmount) AS AverageOrderValue
    FROM Orders o
    WHERE CAST(o.CreatedAt AS DATE) = @Date
        AND o.Status = 'Completed';
END;
GO
```

### SP_GetPopularDishes
Obtiene platillos más vendidos.

```sql
CREATE PROCEDURE SP_GetPopularDishes
    @StartDate DATE,
    @EndDate DATE,
    @TopN INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@TopN)
        d.Id,
        d.Name,
        c.Name AS CategoryName,
        COUNT(oi.Id) AS TimesSold,
        SUM(oi.Quantity) AS TotalQuantity,
        SUM(oi.Subtotal) AS TotalRevenue
    FROM OrderItems oi
    INNER JOIN Dishes d ON oi.DishId = d.Id
    INNER JOIN Categories c ON d.CategoryId = c.Id
    INNER JOIN Orders o ON oi.OrderId = o.Id
    WHERE CAST(o.CreatedAt AS DATE) BETWEEN @StartDate AND @EndDate
        AND o.Status = 'Completed'
    GROUP BY d.Id, d.Name, c.Name
    ORDER BY TotalQuantity DESC;
END;
GO
```

### SP_GetTableUtilization
Obtiene utilización de mesas.

```sql
CREATE PROCEDURE SP_GetTableUtilization
    @Date DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        t.Id AS TableId,
        t.TableNumber,
        z.Name AS ZoneName,
        COUNT(DISTINCT ts.Id) AS SessionsCount,
        COUNT(DISTINCT o.Id) AS OrdersCount,
        SUM(o.TotalAmount) AS TotalRevenue,
        AVG(DATEDIFF(MINUTE, ts.StartTime, ts.EndTime)) AS AvgSessionMinutes
    FROM Tables t
    INNER JOIN Zones z ON t.ZoneId = z.Id
    LEFT JOIN TableSessions ts ON t.Id = ts.TableId 
        AND CAST(ts.StartTime AS DATE) = @Date
    LEFT JOIN Orders o ON t.Id = o.TableId 
        AND CAST(o.CreatedAt AS DATE) = @Date
        AND o.Status = 'Completed'
    GROUP BY t.Id, t.TableNumber, z.Name
    ORDER BY TotalRevenue DESC;
END;
GO
```

---

## 🚀 MIGRATIONS CON EF CORE

### Comandos útiles:

```bash
# Crear nueva migración
dotnet ef migrations add NombreMigracion --project src/backend/SmartMenu.Infrastructure --startup-project src/backend/SmartMenu.API

# Aplicar migraciones
dotnet ef database update --project src/backend/SmartMenu.Infrastructure --startup-project src/backend/SmartMenu.API

# Revertir migración
dotnet ef database update NombreMigracionAnterior --project src/backend/SmartMenu.Infrastructure --startup-project src/backend/SmartMenu.API

# Generar script SQL
dotnet ef migrations script --project src/backend/SmartMenu.Infrastructure --startup-project src/backend/SmartMenu.API --output migration.sql

# Eliminar última migración
dotnet ef migrations remove --project src/backend/SmartMenu.Infrastructure --startup-project src/backend/SmartMenu.API
```

---

## 📊 OPTIMIZACIONES

### Índices Compuestos Recomendados:

```sql
-- Búsqueda de órdenes por mesa y fecha
CREATE NONCLUSTERED INDEX IX_Orders_TableId_CreatedAt 
    ON Orders(TableId, CreatedAt DESC) 
    INCLUDE (Status, TotalAmount);

-- Búsqueda de platillos por categoría y disponibilidad
CREATE NONCLUSTERED INDEX IX_Dishes_CategoryId_IsAvailable 
    ON Dishes(CategoryId, IsAvailable) 
    INCLUDE (Name, Price, ImageUrl);

-- Búsqueda de items de orden por estado
CREATE NONCLUSTERED INDEX IX_OrderItems_Status_OrderId 
    ON OrderItems(Status, OrderId) 
    INCLUDE (DishId, Quantity);
```

### Estadísticas:

```sql
-- Actualizar estadísticas
UPDATE STATISTICS Restaurants WITH FULLSCAN;
UPDATE STATISTICS Orders WITH FULLSCAN;
UPDATE STATISTICS OrderItems WITH FULLSCAN;
```

---

## 📈 MANTENIMIENTO

### Backup Diario:

```sql
-- Backup completo
BACKUP DATABASE DbNewMenu 
TO DISK = 'C:\Backups\DbNewMenu_Full.bak'
WITH FORMAT, INIT, NAME = 'DbNewMenu Full Backup';

-- Backup diferencial
BACKUP DATABASE DbNewMenu 
TO DISK = 'C:\Backups\DbNewMenu_Diff.bak'
WITH DIFFERENTIAL, NAME = 'DbNewMenu Differential Backup';

-- Backup de log
BACKUP LOG DbNewMenu 
TO DISK = 'C:\Backups\DbNewMenu_Log.bak'
WITH NAME = 'DbNewMenu Log Backup';
```

### Limpieza de Datos Antiguos:

```sql
-- Archivar órdenes antiguas (más de 1 año)
CREATE PROCEDURE SP_ArchiveOldOrders
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Crear tabla de archivo si no existe
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Orders_Archive')
    BEGIN
        SELECT * INTO Orders_Archive FROM Orders WHERE 1=0;
    END;
    
    -- Mover órdenes antiguas
    INSERT INTO Orders_Archive
    SELECT * FROM Orders
    WHERE CreatedAt < DATEADD(YEAR, -1, GETUTCDATE())
        AND Status IN ('Completed', 'Cancelled');
    
    -- Eliminar de tabla principal
    DELETE FROM Orders
    WHERE CreatedAt < DATEADD(YEAR, -1, GETUTCDATE())
        AND Status IN ('Completed', 'Cancelled');
END;
GO
```

---

## 🔒 SEGURIDAD

### Permisos por Rol:

```sql
-- Crear roles
CREATE ROLE SmartMenu_ReadOnly;
CREATE ROLE SmartMenu_Application;
CREATE ROLE SmartMenu_Admin;

-- Asignar permisos
GRANT SELECT ON SCHEMA::dbo TO SmartMenu_ReadOnly;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::dbo TO SmartMenu_Application;
GRANT CONTROL ON DATABASE::DbNewMenu TO SmartMenu_Admin;
```

---

## ✅ VERIFICACIÓN DEL MODELO

```sql
-- Verificar integridad referencial
EXEC sp_MSforeachtable 'DBCC CHECKCONSTRAINTS(''?'')';

-- Verificar índices
SELECT 
    OBJECT_NAME(i.object_id) AS TableName,
    i.name AS IndexName,
    i.type_desc,
    i.is_unique
FROM sys.indexes i
WHERE i.object_id > 100
ORDER BY TableName, IndexName;

-- Verificar relaciones
SELECT 
    OBJECT_NAME(f.parent_object_id) AS TableName,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
    OBJECT_NAME(f.referenced_object_id) AS ReferencedTableName,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferencedColumnName
FROM sys.foreign_keys AS f
INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
ORDER BY TableName;
```

---

**Última Actualización:** 7 de Febrero de 2026  
**Estado:** ✅ Completado y Verificado
