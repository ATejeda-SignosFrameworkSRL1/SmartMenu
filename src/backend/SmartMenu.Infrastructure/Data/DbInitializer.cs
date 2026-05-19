using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;
using BCrypt.Net;

namespace SmartMenu.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        // Si ya hay datos, salir
        if (context.Users.Any())
        {
            Console.WriteLine("⚠️  Database already seeded. Skipping...");
            return;
        }

        Console.WriteLine("🌱 Starting database seed...");

        // 1. Crear Restaurant
        var restaurant = new Restaurant
        {
            Name = "Restaurante Demo SmartMenu",
            Address = "Calle Principal #123, Santo Domingo, RD",
            Phone = "809-555-0100",
            Email = "info@smartmenudemo.com",
            RNC = "131123456-7",
            IsActive = true
        };
        context.Restaurants.Add(restaurant);
        await context.SaveChangesAsync();
        Console.WriteLine("✅ Restaurant created");

        // 2. Crear Usuarios
        var users = new List<User>
        {
            new User
            {
                Email = "admin@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                FirstName = "Admin",
                LastName = "System",
                Role = UserRole.Admin,
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "chef@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Chef123!"),
                FirstName = "Juan",
                LastName = "Pérez",
                Phone = "809-555-0101",
                Role = UserRole.Chef,
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "waiter@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Waiter123!"),
                FirstName = "María",
                LastName = "González",
                Phone = "809-555-0102",
                Role = UserRole.Waiter,
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "bartender@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Bar123!"),
                FirstName = "Carlos",
                LastName = "Martínez",
                Phone = "809-555-0103",
                Role = UserRole.Waiter,  // Bartender también es mesero
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "waiter2@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Waiter2!"),
                FirstName = "Pedro",
                LastName = "Rodríguez",
                Phone = "809-555-0104",
                Role = UserRole.Waiter,
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "host@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Host123!"),
                FirstName = "Laura",
                LastName = "Martinez",
                Phone = "809-555-0105",
                Role = UserRole.Host,
                IsActive = true,
                RestaurantId = restaurant.Id
            },
            new User
            {
                Email = "cashier@smartmenu.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Cash123!"),
                FirstName = "Ana",
                LastName = "Cajero",
                Phone = "809-555-0106",
                Role = UserRole.Cashier,
                IsActive = true,
                RestaurantId = restaurant.Id
            }
        };
        context.Users.AddRange(users);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {users.Count} users created");

        // 3. Crear Zonas
        var zones = new List<Zone>
        {
            new Zone { Name = "Terraza", RestaurantId = restaurant.Id, IsActive = true },
            new Zone { Name = "Salón Principal", RestaurantId = restaurant.Id, IsActive = true },
            new Zone { Name = "VIP", RestaurantId = restaurant.Id, IsActive = true }
        };
        context.Zones.AddRange(zones);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {zones.Count} zones created");

        // 4. Crear Mesas
        var tables = new List<Table>();
        var tableNumber = 1;
        foreach (var zone in zones)
        {
            for (int i = 0; i < 8; i++)
            {
                tables.Add(new Table
                {
                    TableNumber = tableNumber++,
                    Capacity = (i % 3) == 0 ? 4 : (i % 3) == 1 ? 2 : 6,
                    ZoneId = zone.Id,
                    RestaurantId = restaurant.Id,
                    Status = TableStatus.Available,
                    QRCode = Guid.NewGuid().ToString("N")
                });
            }
        }
        context.Tables.AddRange(tables);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {tables.Count} tables created");

        // 5. Crear Menú
        var menu = new Menu
        {
            Name = "Menú Principal",
            Description = "Nuestro menú completo con especialidades de la casa",
            RestaurantId = restaurant.Id,
            IsActive = true
        };
        context.Menus.Add(menu);
        await context.SaveChangesAsync();
        Console.WriteLine("✅ Menu created");

        // 6. Crear Categorías
        var categories = new List<Category>
        {
            new Category { Name = "Entradas", Description = "Para comenzar", MenuId = menu.Id, SortOrder = 1, IsActive = true },
            new Category { Name = "Platos Fuertes", Description = "Especialidades de la casa", MenuId = menu.Id, SortOrder = 2, IsActive = true },
            new Category { Name = "Pastas", Description = "Pasta fresca italiana", MenuId = menu.Id, SortOrder = 3, IsActive = true },
            new Category { Name = "Bebidas", Description = "Cocteles y bebidas", MenuId = menu.Id, SortOrder = 4, IsActive = true },
            new Category { Name = "Postres", Description = "Dulces delicias", MenuId = menu.Id, SortOrder = 5, IsActive = true }
        };
        context.Categories.AddRange(categories);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {categories.Count} categories created");

        // 6b. Crear Tags para platos (picante, etc.)
        var dishTags = new List<DishTag>
        {
            new DishTag { Code = "muy_picante", Label = "Muy picante", Icon = "🌶️🌶️🌶️", SortOrder = 1, IsActive = true },
            new DishTag { Code = "picante", Label = "Picante", Icon = "🌶️", SortOrder = 2, IsActive = true },
            new DishTag { Code = "vegetariano", Label = "Vegetariano", Icon = "🥬", SortOrder = 3, IsActive = true },
            new DishTag { Code = "vegano", Label = "Vegano", Icon = "🌱", SortOrder = 4, IsActive = true },
            new DishTag { Code = "sin_gluten", Label = "Sin gluten", Icon = "🌾", SortOrder = 5, IsActive = true },
            new DishTag { Code = "popular", Label = "Popular", Icon = "⭐", SortOrder = 6, IsActive = true }
        };
        context.DishTags.AddRange(dishTags);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {dishTags.Count} dish tags created");

        // 7. Crear Platos
        var dishes = new List<Dish>
        {
            // Entradas
            new Dish
            {
                Name = "Bruschetta Italiana",
                Description = "Pan tostado con tomates frescos, albahaca y aceite de oliva extra virgen",
                Price = 245.00m,
                CategoryId = categories[0].Id,
                ImageUrl = "/images/bruschetta.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 10
            },
            new Dish
            {
                Name = "Carpaccio de Res",
                Description = "Finas láminas de res con rúcula, parmesano y vinagreta de limón",
                Price = 385.00m,
                CategoryId = categories[0].Id,
                ImageUrl = "/images/carpaccio.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 12
            },
            new Dish
            {
                Name = "Ensalada César",
                Description = "Lechuga romana, crutones, parmesano y aderezo césar casero",
                Price = 295.00m,
                CategoryId = categories[0].Id,
                ImageUrl = "/images/caesar.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 8
            },
            
            // Platos Fuertes
            new Dish
            {
                Name = "Ribeye Premium 12oz",
                Description = "Ribeye de 12oz con guarnición de vegetales asados y papas al romero",
                Price = 985.00m,
                CategoryId = categories[1].Id,
                ImageUrl = "/images/ribeye.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 25
            },
            new Dish
            {
                Name = "Salmón a la Parrilla",
                Description = "Filete de salmón fresco con vegetales y arroz jazmín",
                Price = 685.00m,
                CategoryId = categories[1].Id,
                ImageUrl = "/images/salmon.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 20
            },
            new Dish
            {
                Name = "Pollo Marsala",
                Description = "Pechuga de pollo en salsa marsala con champiñones",
                Price = 485.00m,
                CategoryId = categories[1].Id,
                ImageUrl = "/images/chicken.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 22
            },
            
            // Pastas
            new Dish
            {
                Name = "Fettuccine Alfredo",
                Description = "Pasta fresca con cremosa salsa alfredo y queso parmesano",
                Price = 445.00m,
                CategoryId = categories[2].Id,
                ImageUrl = "/images/fettuccine.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 15
            },
            new Dish
            {
                Name = "Spaghetti Carbonara",
                Description = "Spaghetti con pancetta, huevo, parmesano y pimienta negra",
                Price = 465.00m,
                CategoryId = categories[2].Id,
                ImageUrl = "/images/carbonara.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 18
            },
            new Dish
            {
                Name = "Penne Arrabiata",
                Description = "Penne en salsa de tomate picante con ajo y albahaca",
                Price = 395.00m,
                CategoryId = categories[2].Id,
                ImageUrl = "/images/arrabiata.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                IsVegan = true,
                PreparationTimeMinutes = 16
            },
            
            // Bebidas
            new Dish
            {
                Name = "Mojito Clásico",
                Description = "Ron blanco, menta fresca, lima, azúcar y soda",
                Price = 285.00m,
                CategoryId = categories[3].Id,
                ImageUrl = "/images/mojito.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 5
            },
            new Dish
            {
                Name = "Piña Colada",
                Description = "Ron, crema de coco, jugo de piña y hielo",
                Price = 295.00m,
                CategoryId = categories[3].Id,
                ImageUrl = "/images/pina.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 5
            },
            new Dish
            {
                Name = "Margarita",
                Description = "Tequila, triple sec, lima y sal",
                Price = 305.00m,
                CategoryId = categories[3].Id,
                ImageUrl = "/images/margarita.jpg",
                IsAvailable = true,
                PreparationTimeMinutes = 5
            },
            
            // Postres
            new Dish
            {
                Name = "Tiramisú",
                Description = "Postre italiano con café, mascarpone y cacao",
                Price = 325.00m,
                CategoryId = categories[4].Id,
                ImageUrl = "/images/tiramisu.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 5
            },
            new Dish
            {
                Name = "Cheesecake de Fresa",
                Description = "Cremoso cheesecake con coulis de fresas frescas",
                Price = 295.00m,
                CategoryId = categories[4].Id,
                ImageUrl = "/images/cheesecake.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 5
            },
            new Dish
            {
                Name = "Brownie con Helado",
                Description = "Brownie de chocolate caliente con helado de vainilla",
                Price = 275.00m,
                CategoryId = categories[4].Id,
                ImageUrl = "/images/brownie.jpg",
                IsAvailable = true,
                IsVegetarian = true,
                PreparationTimeMinutes = 8
            }
        };
        context.Dishes.AddRange(dishes);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {dishes.Count} dishes created");

        Console.WriteLine("🎉 Database seed completed successfully!");
        Console.WriteLine("");
        Console.WriteLine("📝 Default users created:");
        Console.WriteLine("   Admin:     admin@smartmenu.com / Admin123!");
        Console.WriteLine("   Chef:      chef@smartmenu.com / Chef123!");
        Console.WriteLine("   Waiter:    waiter@smartmenu.com / Waiter123!");
        Console.WriteLine("   Waiter 2:  waiter2@smartmenu.com / Waiter2!");
        Console.WriteLine("   Bartender: bartender@smartmenu.com / Bar123!");
        Console.WriteLine("   Cashier:   cashier@smartmenu.com / Cash123!");
        Console.WriteLine("   Host:      host@smartmenu.com / Host123!");
        Console.WriteLine("");
    }

    /// <summary>
    /// Añade el segundo mesero (waiter2) si no existe. Útil cuando la BD ya estaba creada y el seed no se ejecutó.
    /// </summary>
    public static async Task EnsureExtraWaiterAsync(ApplicationDbContext context)
    {
        if (await context.Users.AnyAsync(u => u.Email == "waiter2@smartmenu.com"))
            return;

        var restaurantId = await context.Restaurants.OrderBy(r => r.Id).Select(r => r.Id).FirstOrDefaultAsync();
        if (restaurantId == 0)
            return;

        var waiter2 = new User
        {
            Email = "waiter2@smartmenu.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Waiter2!"),
            FirstName = "Pedro",
            LastName = "Rodríguez",
            Phone = "809-555-0104",
            Role = UserRole.Waiter,
            IsActive = true,
            RestaurantId = restaurantId
        };
        context.Users.Add(waiter2);
        await context.SaveChangesAsync();
        Console.WriteLine("✅ Segundo mesero creado: waiter2@smartmenu.com / Waiter2!");
    }

    /// <summary>
    /// Añade el usuario Cashier si no existe.
    /// </summary>
    public static async Task EnsureCashierAsync(ApplicationDbContext context)
    {
        if (await context.Users.AnyAsync(u => u.Email == "cashier@smartmenu.com"))
            return;

        var restaurantId = await context.Restaurants.OrderBy(r => r.Id).Select(r => r.Id).FirstOrDefaultAsync();
        if (restaurantId == 0)
            return;

        var cashier = new User
        {
            Email = "cashier@smartmenu.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Cash123!"),
            FirstName = "Ana",
            LastName = "Cajero",
            Phone = "809-555-0106",
            Role = UserRole.Cashier,
            IsActive = true,
            RestaurantId = restaurantId
        };
        context.Users.Add(cashier);
        await context.SaveChangesAsync();
        Console.WriteLine("✅ Cajero creado: cashier@smartmenu.com / Cash123!");
    }

    /// <summary>
    /// Crea tablas y columnas de la migración AddVirtualTableTransferDishTags si no existen (para no depender de dotnet ef database update).
    /// </summary>
    public static async Task EnsureMigrationAddVirtualTableTransferDishTagsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando tablas/columnas de migración AddVirtualTableTransferDishTags (idempotente)...");
        }
        catch
        {
            // ignore
        }

        try
        {
        // Columnas en Payments
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'BillSplitType')
                ALTER TABLE Payments ADD BillSplitType nvarchar(64) NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'SplitPartIndex')
                ALTER TABLE Payments ADD SplitPartIndex int NULL;");

        // Columnas en TableReservations
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'ReservedUntil')
                ALTER TABLE TableReservations ADD ReservedUntil datetime2 NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'ConfirmationLinkSentAt')
                ALTER TABLE TableReservations ADD ConfirmationLinkSentAt datetime2 NULL;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'ConfirmationLink')
                ALTER TABLE TableReservations ADD ConfirmationLink nvarchar(500) NULL;");

        // Columna CustomerName en Orders (nombre del comensal al escanear QR)
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'CustomerName')
                ALTER TABLE Orders ADD CustomerName nvarchar(256) NULL;");

        // Columna PreferenceText en OrderItems (preferencia en texto, ej. término de carne)
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OrderItems') AND name = 'PreferenceText')
                ALTER TABLE OrderItems ADD PreferenceText nvarchar(256) NULL;");

        // Tabla DishTags
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DishTags')
            CREATE TABLE DishTags (
                Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Code nvarchar(64) NOT NULL,
                Label nvarchar(128) NOT NULL,
                Icon nvarchar(32) NOT NULL,
                SortOrder int NOT NULL,
                IsActive bit NOT NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NOT NULL
            );");

        // Tabla VirtualTables
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VirtualTables')
            CREATE TABLE VirtualTables (
                Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Name nvarchar(128) NOT NULL,
                CreatedByWaiterId int NOT NULL,
                IsActive bit NOT NULL,
                DeactivatedAt datetime2 NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NOT NULL,
                CONSTRAINT FK_VirtualTables_Users_CreatedByWaiterId FOREIGN KEY (CreatedByWaiterId) REFERENCES Users(Id)
            );
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VirtualTables_CreatedByWaiterId' AND object_id = OBJECT_ID('VirtualTables'))
                CREATE INDEX IX_VirtualTables_CreatedByWaiterId ON VirtualTables(CreatedByWaiterId);");

        // Tabla VirtualTableTables
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'VirtualTableTables')
            CREATE TABLE VirtualTableTables (
                VirtualTableId int NOT NULL,
                TableId int NOT NULL,
                PRIMARY KEY (VirtualTableId, TableId),
                CONSTRAINT FK_VirtualTableTables_VirtualTables_VirtualTableId FOREIGN KEY (VirtualTableId) REFERENCES VirtualTables(Id) ON DELETE CASCADE,
                CONSTRAINT FK_VirtualTableTables_Tables_TableId FOREIGN KEY (TableId) REFERENCES [Tables](Id) ON DELETE CASCADE
            );
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VirtualTableTables_TableId' AND object_id = OBJECT_ID('VirtualTableTables'))
                CREATE INDEX IX_VirtualTableTables_TableId ON VirtualTableTables(TableId);");

        // Tabla TableTransferRequests
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TableTransferRequests')
            CREATE TABLE TableTransferRequests (
                Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                FromWaiterId int NOT NULL,
                ToWaiterId int NOT NULL,
                TableIdsJson nvarchar(500) NOT NULL,
                Status int NOT NULL,
                RespondedByWaiterId int NULL,
                RespondedAt datetime2 NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NOT NULL,
                CONSTRAINT FK_TableTransferRequests_FromWaiter FOREIGN KEY (FromWaiterId) REFERENCES Users(Id),
                CONSTRAINT FK_TableTransferRequests_ToWaiter FOREIGN KEY (ToWaiterId) REFERENCES Users(Id)
            );
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TableTransferRequests_FromWaiterId' AND object_id = OBJECT_ID('TableTransferRequests'))
                CREATE INDEX IX_TableTransferRequests_FromWaiterId ON TableTransferRequests(FromWaiterId);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TableTransferRequests_ToWaiterId' AND object_id = OBJECT_ID('TableTransferRequests'))
                CREATE INDEX IX_TableTransferRequests_ToWaiterId ON TableTransferRequests(ToWaiterId);");

        // Tabla DishDishTags (depende de DishTags)
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DishDishTags')
            CREATE TABLE DishDishTags (
                DishId int NOT NULL,
                DishTagId int NOT NULL,
                PRIMARY KEY (DishId, DishTagId),
                CONSTRAINT FK_DishDishTags_Dishes_DishId FOREIGN KEY (DishId) REFERENCES Dishes(Id) ON DELETE CASCADE,
                CONSTRAINT FK_DishDishTags_DishTags_DishTagId FOREIGN KEY (DishTagId) REFERENCES DishTags(Id) ON DELETE CASCADE
            );
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DishDishTags_DishTagId' AND object_id = OBJECT_ID('DishDishTags'))
                CREATE INDEX IX_DishDishTags_DishTagId ON DishDishTags(DishTagId);");

        // Registrar migración en historial para que EF no intente aplicarla de nuevo
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260210000000_AddVirtualTableTransferDishTags')
            INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260210000000_AddVirtualTableTransferDishTags', N'9.0.0');");

            try { Console.WriteLine("✅ Tablas/columnas de migración listas."); } catch { }
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureMigrationAddVirtualTableTransferDishTags: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Inserta los tags de plato por defecto si la tabla DishTags está vacía (p. ej. cuando la migración se aplicó después del seed).
    /// </summary>
    public static async Task EnsureDishTagsSeedAsync(ApplicationDbContext context)
    {
        if (await context.DishTags.AnyAsync())
            return;
        var dishTags = new List<DishTag>
        {
            new DishTag { Code = "muy_picante", Label = "Muy picante", Icon = "🌶️🌶️🌶️", SortOrder = 1, IsActive = true },
            new DishTag { Code = "picante", Label = "Picante", Icon = "🌶️", SortOrder = 2, IsActive = true },
            new DishTag { Code = "vegetariano", Label = "Vegetariano", Icon = "🥬", SortOrder = 3, IsActive = true },
            new DishTag { Code = "vegano", Label = "Vegano", Icon = "🌱", SortOrder = 4, IsActive = true },
            new DishTag { Code = "sin_gluten", Label = "Sin gluten", Icon = "🌾", SortOrder = 5, IsActive = true },
            new DishTag { Code = "popular", Label = "Popular", Icon = "⭐", SortOrder = 6, IsActive = true }
        };
        context.DishTags.AddRange(dishTags);
        await context.SaveChangesAsync();
        Console.WriteLine($"✅ {dishTags.Count} dish tags creados.");
    }

    /// <summary>
    /// Agrega columnas Type y Description a Zones si no existen.
    /// </summary>
    public static async Task EnsureOrderServedColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'KitchenServed')
                    ALTER TABLE Orders ADD KitchenServed bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'BarServed')
                    ALTER TABLE Orders ADD BarServed bit NOT NULL DEFAULT 0;");
            Console.WriteLine("✅ Columnas KitchenServed/BarServed en Orders listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureOrderServedColumns: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Adds AssignedZoneId to Users and KitchenZoneId to Dishes, creates "Cocina Principal" zone, and assigns existing Chef to it.
    /// </summary>
    public static async Task EnsureKitchenZoneColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            // Add columns
            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AssignedZoneId')
                    ALTER TABLE Users ADD AssignedZoneId int NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_Zones_AssignedZoneId')
                    ALTER TABLE Users ADD CONSTRAINT FK_Users_Zones_AssignedZoneId FOREIGN KEY (AssignedZoneId) REFERENCES Zones(Id);
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'KitchenZoneId')
                    ALTER TABLE Dishes ADD KitchenZoneId int NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Dishes_Zones_KitchenZoneId')
                    ALTER TABLE Dishes ADD CONSTRAINT FK_Dishes_Zones_KitchenZoneId FOREIGN KEY (KitchenZoneId) REFERENCES Zones(Id);");

            // Ensure "Cocina Principal" zone exists
            var restaurantId = await context.Restaurants.OrderBy(r => r.Id).Select(r => r.Id).FirstOrDefaultAsync();
            if (restaurantId > 0)
            {
                var mainKitchen = await context.Zones.FirstOrDefaultAsync(z => z.Name == "Cocina Principal" && z.Type == "Kitchen");
                if (mainKitchen == null)
                {
                    mainKitchen = new Zone
                    {
                        Name = "Cocina Principal",
                        Type = "Kitchen",
                        Description = "Cocina principal del restaurante",
                        RestaurantId = restaurantId,
                        IsActive = true
                    };
                    context.Zones.Add(mainKitchen);
                    await context.SaveChangesAsync();
                    Console.WriteLine("✅ Zona 'Cocina Principal' creada.");
                }

                // Assign existing chef(s) without zone to Cocina Principal
                var chefsWithoutZone = await context.Users
                    .Where(u => u.Role == UserRole.Chef && u.AssignedZoneId == null)
                    .ToListAsync();
                foreach (var chef in chefsWithoutZone)
                {
                    chef.AssignedZoneId = mainKitchen.Id;
                }
                if (chefsWithoutZone.Count > 0)
                {
                    await context.SaveChangesAsync();
                    Console.WriteLine($"✅ {chefsWithoutZone.Count} chef(s) asignados a 'Cocina Principal'.");
                }

                // Assign existing dishes without KitchenZoneId to Cocina Principal (except drinks)
                // ExecuteSqlAsync parametriza FormattableString → evita SQL injection (warning EF1002)
                await context.Database.ExecuteSqlAsync(
                    $"UPDATE Dishes SET KitchenZoneId = {mainKitchen.Id} WHERE KitchenZoneId IS NULL");
                Console.WriteLine("✅ Platos sin zona asignados a 'Cocina Principal'.");
            }

            Console.WriteLine("✅ Columnas AssignedZoneId/KitchenZoneId listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureKitchenZoneColumns: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureZoneTypeColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando columnas Type/Description en Zones (idempotente)...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'Type')
                    ALTER TABLE Zones ADD [Type] nvarchar(32) NOT NULL DEFAULT 'Dining';
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Zones') AND name = 'Description')
                    ALTER TABLE Zones ADD [Description] nvarchar(256) NULL;");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260225000000_AddZoneTypeAndDescription')
                INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260225000000_AddZoneTypeAndDescription', N'9.0.0');");

            Console.WriteLine("✅ Columnas Type/Description en Zones listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureZoneTypeColumns: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Ensures bar@smartmenu.com bartender user exists.
    /// </summary>
    public static async Task EnsureBarUserAsync(ApplicationDbContext context)
    {
        try
        {
            const string barEmail = "bar@smartmenu.com";
            if (!context.Users.Any(u => u.Email == barEmail))
            {
                // Obtener el primer restaurante
                var restaurant = context.Restaurants.FirstOrDefault();
                if (restaurant != null)
                {
                    context.Users.Add(new User
                    {
                        Email = barEmail,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Bar123!"),
                        FirstName = "Bar",
                        LastName = "SmartMenu",
                        Phone = "809-555-0199",
                        Role = UserRole.Bartender,
                        IsActive = true,
                        RestaurantId = restaurant.Id
                    });
                    await context.SaveChangesAsync();
                    Console.WriteLine("✅ Usuario bar@smartmenu.com creado.");
                }
            }
            else
            {
                // Asegurar que el usuario tenga rol Bartender
                var barUser = context.Users.FirstOrDefault(u => u.Email == barEmail);
                if (barUser != null && barUser.Role != UserRole.Bartender)
                {
                    barUser.Role = UserRole.Bartender;
                    await context.SaveChangesAsync();
                    Console.WriteLine("✅ Rol de bar@smartmenu.com actualizado a Bartender.");
                }
            }
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureBarUser: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Adds DefaultCourse to Dishes (default 1=PlatoFuerte) and CourseTiming to OrderItems (nullable).
    /// </summary>
    public static async Task EnsureCourseTimingColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'DefaultCourse')
                    ALTER TABLE Dishes ADD DefaultCourse int NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OrderItems') AND name = 'CourseTiming')
                    ALTER TABLE OrderItems ADD CourseTiming int NULL;");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20260303000000_AddCourseTiming')
                INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20260303000000_AddCourseTiming', N'9.0.0');");

            // Fix DefaultCourse based on category name
            await context.Database.ExecuteSqlRawAsync(@"
                UPDATE d SET d.DefaultCourse = 0
                FROM Dishes d INNER JOIN Categories c ON d.CategoryId = c.Id
                WHERE LOWER(c.Name) LIKE '%entrada%' OR LOWER(c.Name) LIKE '%aperitivo%';

                UPDATE d SET d.DefaultCourse = 2
                FROM Dishes d INNER JOIN Categories c ON d.CategoryId = c.Id
                WHERE LOWER(c.Name) LIKE '%postre%' OR LOWER(c.Name) LIKE '%dulce%';

                UPDATE d SET d.DefaultCourse = 1
                FROM Dishes d INNER JOIN Categories c ON d.CategoryId = c.Id
                WHERE LOWER(c.Name) LIKE '%bebida%' OR LOWER(c.Name) LIKE '%coctel%'
                   OR LOWER(c.Name) LIKE '%c_ctel%' OR LOWER(c.Name) LIKE '%vino%';");

            Console.WriteLine("✅ Columnas DefaultCourse/CourseTiming listas + DefaultCourse sincronizado con categorías.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureCourseTimingColumns: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureAdvanceBlockAndSourceColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando columnas AdvanceBlockMinutes/Source en TableReservations...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'AdvanceBlockMinutes')
                    ALTER TABLE TableReservations ADD AdvanceBlockMinutes int NOT NULL DEFAULT 60;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'Source')
                    ALTER TABLE TableReservations ADD [Source] nvarchar(20) NOT NULL DEFAULT 'Internal';
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'ConfirmationLinkSentAt')
                    ALTER TABLE TableReservations ADD ConfirmationLinkSentAt datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'ConfirmationLink')
                    ALTER TABLE TableReservations ADD ConfirmationLink nvarchar(512) NULL;");

            Console.WriteLine("✅ Columnas AdvanceBlockMinutes/Source listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureAdvanceBlockAndSourceColumns: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureFiscalReceiptColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando columnas fiscales en Payments...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'RequiresFiscalReceipt')
                    ALTER TABLE Payments ADD RequiresFiscalReceipt bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'RNC')
                    ALTER TABLE Payments ADD RNC nvarchar(20) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'BusinessName')
                    ALTER TABLE Payments ADD BusinessName nvarchar(256) NULL;");

            Console.WriteLine("✅ Columnas fiscales en Payments listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureFiscalReceiptColumns: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureDishImagesTableAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Creando tabla DishImages...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DishImages')
                BEGIN
                    CREATE TABLE DishImages (
                        Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        DishId int NOT NULL,
                        ImageUrl nvarchar(512) NOT NULL DEFAULT '',
                        DisplayOrder int NOT NULL DEFAULT 0,
                        IsMain bit NOT NULL DEFAULT 0,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_DishImages_Dishes FOREIGN KEY (DishId) REFERENCES Dishes(Id) ON DELETE CASCADE
                    );
                END");

            Console.WriteLine("✅ Tabla DishImages lista.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureDishImagesTable: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureWaiterShiftsTableAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Creando tabla WaiterShifts...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WaiterShifts')
                BEGIN
                    CREATE TABLE WaiterShifts (
                        Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        WaiterId int NOT NULL,
                        StartTime datetime2 NOT NULL,
                        EndTime datetime2 NULL,
                        IsActive bit NOT NULL DEFAULT 1,
                        Notes nvarchar(512) NULL,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_WaiterShifts_Users FOREIGN KEY (WaiterId) REFERENCES Users(Id)
                    );
                END");

            Console.WriteLine("✅ Tabla WaiterShifts lista.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureWaiterShiftsTable: " + ex.Message); } catch { }
        }
    }

    public static async Task EnsureReservationPreOrderTablesAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Creando tablas ReservationPreOrders / PreOrderItems...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReservationPreOrders')
                BEGIN
                    CREATE TABLE ReservationPreOrders (
                        Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        ReservationId int NOT NULL,
                        Notes nvarchar(1024) NULL,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_ReservationPreOrders_TableReservations FOREIGN KEY (ReservationId) REFERENCES TableReservations(Id) ON DELETE CASCADE
                    );
                END

                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PreOrderItems')
                BEGIN
                    CREATE TABLE PreOrderItems (
                        Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        PreOrderId int NOT NULL,
                        DishId int NOT NULL,
                        Quantity int NOT NULL DEFAULT 1,
                        Notes nvarchar(512) NULL,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_PreOrderItems_ReservationPreOrders FOREIGN KEY (PreOrderId) REFERENCES ReservationPreOrders(Id) ON DELETE CASCADE,
                        CONSTRAINT FK_PreOrderItems_Dishes FOREIGN KEY (DishId) REFERENCES Dishes(Id)
                    );
                END");

            Console.WriteLine("✅ Tablas ReservationPreOrders/PreOrderItems listas.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureReservationPreOrderTables: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Tanda 5 saneamiento DB:
    /// - Cambia el FK OrderItems→Orders de CASCADE a NO ACTION (proteger histórico fiscal).
    /// - Índices adicionales para queries de dashboard y reports.
    /// </summary>
    public static async Task EnsureTanda5DbObjectsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando Tanda 5: cascade fix + índices adicionales...");
            await context.Database.ExecuteSqlRawAsync(@"
                -- Cascade → NO ACTION en OrderItem→Order (proteger histórico fiscal de DELETE accidental)
                DECLARE @fkName nvarchar(256) = (
                    SELECT TOP 1 name FROM sys.foreign_keys
                    WHERE parent_object_id = OBJECT_ID('OrderItems')
                      AND referenced_object_id = OBJECT_ID('Orders')
                      AND delete_referential_action_desc = 'CASCADE');
                IF @fkName IS NOT NULL
                BEGIN
                    DECLARE @colName sysname = (
                        SELECT TOP 1 c.name
                        FROM sys.foreign_key_columns fkc
                        JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
                        WHERE fkc.constraint_object_id = OBJECT_ID(@fkName));
                    DECLARE @sql nvarchar(max) =
                        'ALTER TABLE OrderItems DROP CONSTRAINT ' + QUOTENAME(@fkName) + ';' +
                        'ALTER TABLE OrderItems ADD CONSTRAINT ' + QUOTENAME(@fkName) +
                        ' FOREIGN KEY (' + QUOTENAME(@colName) + ') REFERENCES Orders(Id) ON DELETE NO ACTION;';
                    EXEC sp_executesql @sql;
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Status' AND object_id = OBJECT_ID('Orders'))
                    CREATE INDEX IX_Orders_Status ON Orders(Status);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_CreatedAt' AND object_id = OBJECT_ID('Orders'))
                    CREATE INDEX IX_Orders_CreatedAt ON Orders(CreatedAt);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_Status' AND object_id = OBJECT_ID('Payments'))
                    CREATE INDEX IX_Payments_Status ON Payments(Status);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dishes_IsDeleted' AND object_id = OBJECT_ID('Dishes'))
                    CREATE INDEX IX_Dishes_IsDeleted ON Dishes(IsDeleted);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dishes_CategoryId_IsAvailable' AND object_id = OBJECT_ID('Dishes'))
                    CREATE INDEX IX_Dishes_CategoryId_IsAvailable ON Dishes(CategoryId, IsAvailable);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TableSessions_TableId_IsActive' AND object_id = OBJECT_ID('TableSessions'))
                    CREATE INDEX IX_TableSessions_TableId_IsActive ON TableSessions(TableId, IsActive);");
            Console.WriteLine("✅ Tanda 5: cascade + índices listos.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureTanda5DbObjects: " + ex.Message); } catch { }
        }
    }

    /// <summary>
    /// Bloque B saneamiento fiscal:
    /// - Concurrency token (rowversion) en Orders y Payments.
    /// - Soft delete (IsDeleted, DeletedAt) en Dishes.
    /// </summary>
    public static async Task EnsureConcurrencyAndSoftDeleteColumnsAsync(ApplicationDbContext context)
    {
        try
        {
            Console.WriteLine("📦 Aplicando RowVersion en Orders/Payments + soft-delete en Dishes...");

            await context.Database.ExecuteSqlRawAsync(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'RowVersion')
                    ALTER TABLE Orders ADD RowVersion rowversion NOT NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'RowVersion')
                    ALTER TABLE Payments ADD RowVersion rowversion NOT NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'IsDeleted')
                    ALTER TABLE Dishes ADD IsDeleted bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'DeletedAt')
                    ALTER TABLE Dishes ADD DeletedAt datetime2 NULL;");

            Console.WriteLine("✅ Concurrency + soft-delete listo.");
        }
        catch (Exception ex)
        {
            try { Console.WriteLine("⚠️ EnsureConcurrencyAndSoftDeleteColumns: " + ex.Message); } catch { }
        }
    }
}
