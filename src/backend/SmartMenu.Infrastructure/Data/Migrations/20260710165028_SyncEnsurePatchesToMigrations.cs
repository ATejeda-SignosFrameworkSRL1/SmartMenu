using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <summary>
    /// PROD-SCHEMA.1 — Consolida en una migration EF formal TODOS los parches de
    /// esquema que hasta ahora solo aplicaba DbInitializer.Ensure* al arrancar en
    /// Development. Con esto `dotnet ef database update` produce el esquema COMPLETO
    /// en una base de datos virgen (camino de produccion), sin depender del startup.
    ///
    /// El SQL es IDEMPOTENTE (IF NOT EXISTS), copiado 1:1 de los Ensure*:
    /// - BDs existentes (dev/QA) que ya recibieron los parches: esta migration es no-op.
    /// - BDs virgenes: crea todo.
    /// Los tipos/longitudes son los REALES de las BDs existentes (nvarchar(20/80/120/500),
    /// FK de FloorStructures a Zones, defaults 1 en visibilidad del plano), NO los del
    /// snapshot (nvarchar(max)), para que todos los entornos queden identicos.
    ///
    /// Incluye ademas 3 parches FUERA del modelo EF (solo SQL crudo en el codigo):
    /// PIN del waiter + WaiterAuthMode, tabla AuditEvents (DGII) y VirtualTables.PayerTableId.
    /// </summary>
    public partial class SyncEnsurePatchesToMigrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. PLANO (Gestion de Salon) — columnas de layout en Tables [ex EnsureFloorPlanColumnsAsync]
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'PositionX')
                    ALTER TABLE Tables ADD PositionX float NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'PositionY')
                    ALTER TABLE Tables ADD PositionY float NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Shape')
                    ALTER TABLE Tables ADD Shape nvarchar(20) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Width')
                    ALTER TABLE Tables ADD Width float NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Height')
                    ALTER TABLE Tables ADD Height float NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Server')
                    ALTER TABLE Tables ADD [Server] nvarchar(20) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Name')
                    ALTER TABLE Tables ADD [Name] nvarchar(80) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Color')
                    ALTER TABLE Tables ADD Color nvarchar(20) NULL;");

            // 2. Restaurants — paleta + visibilidad del plano [ex EnsureRestaurantPaletteColumnAsync / EnsureFloorPlanVisibilityColumnsAsync]
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanPaletteJson')
                    ALTER TABLE Restaurants ADD FloorPlanPaletteJson nvarchar(max) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanHostEnabled')
                    ALTER TABLE Restaurants ADD FloorPlanHostEnabled bit NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanWaiterEnabled')
                    ALTER TABLE Restaurants ADD FloorPlanWaiterEnabled bit NOT NULL DEFAULT 1;");

            // 3. TableReservations — reserva de ZONA completa [ex EnsureZoneExclusiveColumnsAsync]
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'IsZoneExclusive')
                    ALTER TABLE TableReservations ADD IsZoneExclusive bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'HostResponseMessage')
                    ALTER TABLE TableReservations ADD HostResponseMessage nvarchar(500) NULL;");

            // 4. OrderItems.CustomerName — pedido compartido por mesa [ex EnsureOrderItemCustomerNameColumnAsync]
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OrderItems') AND name = 'CustomerName')
                    ALTER TABLE OrderItems ADD CustomerName nvarchar(120) NULL;");

            // 5. FloorStructures — estructuras del plano (paredes/puertas/etiquetas) [ex EnsureFloorStructureTableAsync]
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FloorStructures')
                BEGIN
                    CREATE TABLE FloorStructures (
                        Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        ZoneId int NOT NULL,
                        Type nvarchar(20) NOT NULL DEFAULT 'wall',
                        X float NOT NULL DEFAULT 0,
                        Y float NOT NULL DEFAULT 0,
                        Width float NULL,
                        Height float NULL,
                        Label nvarchar(64) NULL,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT FK_FloorStructures_Zones FOREIGN KEY (ZoneId) REFERENCES Zones(Id) ON DELETE CASCADE
                    );
                END");

            // 6. VirtualTables.PayerTableId — cobro unificado de mesa virtual [ex EnsureVirtualTablePayerColumnAsync]
            //    (columna fuera del modelo EF: se usa via SQL crudo)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VirtualTables') AND name = 'PayerTableId')
                    ALTER TABLE VirtualTables ADD PayerTableId int NULL;");

            // 7. PIN del waiter + WaiterAuthMode [ex EnsureWaiterPinColumnsAsync]
            //    (columnas fuera del modelo EF: se usan via SQL crudo)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinHash')
                    ALTER TABLE Users ADD PinHash nvarchar(120) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinSetAt')
                    ALTER TABLE Users ADD PinSetAt datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinFailedAttempts')
                    ALTER TABLE Users ADD PinFailedAttempts int NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinLockedUntil')
                    ALTER TABLE Users ADD PinLockedUntil datetime2 NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'WaiterAuthMode')
                    ALTER TABLE Restaurants ADD WaiterAuthMode int NOT NULL DEFAULT 0;");

            // 8. AuditEvents — trazabilidad DGII (Sprint 4.2) [ex EnsureAuditEventsTableAsync]
            //    (tabla fuera del modelo EF: AuditService escribe via SQL crudo)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditEvents')
                BEGIN
                    CREATE TABLE AuditEvents (
                        Id          int IDENTITY(1,1) PRIMARY KEY,
                        UserId      int NULL,
                        Action      nvarchar(80)  NOT NULL,
                        EntityType  nvarchar(80)  NOT NULL,
                        EntityId    int NULL,
                        IpAddress   nvarchar(64)  NULL,
                        AuthMethod  nvarchar(20)  NOT NULL DEFAULT 'password',
                        Metadata    nvarchar(2048) NULL,
                        OccurredAt  datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        CreatedAt   datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
                        UpdatedAt   datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
                    );
                    CREATE INDEX IX_AuditEvents_UserId_OccurredAt  ON AuditEvents (UserId, OccurredAt DESC);
                    CREATE INDEX IX_AuditEvents_Action_OccurredAt  ON AuditEvents (Action, OccurredAt DESC);
                    CREATE INDEX IX_AuditEvents_Entity            ON AuditEvents (EntityType, EntityId);
                END;
                -- AUDIT-FIX.1 — relajar UserId a NULL en instalaciones existentes
                ELSE IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID('AuditEvents')
                      AND name = 'UserId' AND is_nullable = 0
                )
                BEGIN
                    ALTER TABLE AuditEvents ALTER COLUMN UserId int NULL;
                END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditEvents') DROP TABLE AuditEvents;
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FloorStructures') DROP TABLE FloorStructures;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinHash') ALTER TABLE Users DROP COLUMN PinHash;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinSetAt') ALTER TABLE Users DROP COLUMN PinSetAt;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinFailedAttempts') ALTER TABLE Users DROP COLUMN PinFailedAttempts;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PinLockedUntil') ALTER TABLE Users DROP COLUMN PinLockedUntil;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VirtualTables') AND name = 'PayerTableId') ALTER TABLE VirtualTables DROP COLUMN PayerTableId;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OrderItems') AND name = 'CustomerName') ALTER TABLE OrderItems DROP COLUMN CustomerName;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'IsZoneExclusive') ALTER TABLE TableReservations DROP COLUMN IsZoneExclusive;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TableReservations') AND name = 'HostResponseMessage') ALTER TABLE TableReservations DROP COLUMN HostResponseMessage;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'WaiterAuthMode') ALTER TABLE Restaurants DROP COLUMN WaiterAuthMode;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanPaletteJson') ALTER TABLE Restaurants DROP COLUMN FloorPlanPaletteJson;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanHostEnabled') ALTER TABLE Restaurants DROP COLUMN FloorPlanHostEnabled;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Restaurants') AND name = 'FloorPlanWaiterEnabled') ALTER TABLE Restaurants DROP COLUMN FloorPlanWaiterEnabled;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'PositionX') ALTER TABLE Tables DROP COLUMN PositionX;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'PositionY') ALTER TABLE Tables DROP COLUMN PositionY;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Shape') ALTER TABLE Tables DROP COLUMN Shape;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Width') ALTER TABLE Tables DROP COLUMN Width;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Height') ALTER TABLE Tables DROP COLUMN Height;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Server') ALTER TABLE Tables DROP COLUMN [Server];
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Name') ALTER TABLE Tables DROP COLUMN [Name];
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Tables') AND name = 'Color') ALTER TABLE Tables DROP COLUMN Color;");
        }
    }
}
