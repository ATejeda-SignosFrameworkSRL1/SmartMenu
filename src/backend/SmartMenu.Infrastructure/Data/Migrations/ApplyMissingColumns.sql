-- =============================================================================
-- Script para agregar columnas y tablas faltantes (migración AddExtendedFeaturesV2)
-- Ejecutar contra la base de datos (SSMS, Azure Data Studio o sqlcmd).
-- Puedes ejecutarlo SIN detener el backend. Luego reinicia el API para que dejen los errores.
-- Base de datos: la que uses en appsettings.json (DefaultConnection)
-- =============================================================================

SET NOCOUNT ON;

-- ---------- PAYMENTS ----------
IF COL_LENGTH('Payments','ProcessedByWaiterId') IS NULL
  ALTER TABLE Payments ADD ProcessedByWaiterId int NULL;
IF COL_LENGTH('Payments','TipAmount') IS NULL
  ALTER TABLE Payments ADD TipAmount decimal(18,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('Payments','TipPercentage') IS NULL
  ALTER TABLE Payments ADD TipPercentage decimal(18,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('Payments','TotalAmount') IS NULL
  ALTER TABLE Payments ADD TotalAmount decimal(18,2) NOT NULL DEFAULT 0;

-- ---------- ORDERS ----------
IF COL_LENGTH('Orders','AssignedWaiterId') IS NULL
  ALTER TABLE Orders ADD AssignedWaiterId int NULL;
IF COL_LENGTH('Orders','CustomerFinishedEating') IS NULL
  ALTER TABLE Orders ADD CustomerFinishedEating bit NOT NULL DEFAULT 0;
IF COL_LENGTH('Orders','FinishedEatingAt') IS NULL
  ALTER TABLE Orders ADD FinishedEatingAt datetime2 NULL;
IF COL_LENGTH('Orders','ServedAt') IS NULL
  ALTER TABLE Orders ADD ServedAt datetime2 NULL;
IF COL_LENGTH('Orders','TableSessionId') IS NULL
  ALTER TABLE Orders ADD TableSessionId int NULL;

-- ---------- ORDER ITEMS ----------
IF COL_LENGTH('OrderItems','Allergies') IS NULL
  ALTER TABLE OrderItems ADD Allergies nvarchar(max) NULL;
IF COL_LENGTH('OrderItems','Customizations') IS NULL
  ALTER TABLE OrderItems ADD Customizations nvarchar(max) NULL;
IF COL_LENGTH('OrderItems','DrinkTiming') IS NULL
  ALTER TABLE OrderItems ADD DrinkTiming int NULL;
IF COL_LENGTH('OrderItems','MeatCooking') IS NULL
  ALTER TABLE OrderItems ADD MeatCooking int NULL;
IF COL_LENGTH('OrderItems','SideDish') IS NULL
  ALTER TABLE OrderItems ADD SideDish nvarchar(max) NULL;
IF COL_LENGTH('OrderItems','WithAlcohol') IS NULL
  ALTER TABLE OrderItems ADD WithAlcohol bit NULL;

-- ---------- TABLA TableSessions (si no existe) ----------
IF OBJECT_ID('TableSessions','U') IS NULL
BEGIN
  CREATE TABLE TableSessions (
    Id int IDENTITY(1,1) NOT NULL,
    TableId int NOT NULL,
    NumberOfGuests int NOT NULL,
    AssignedWaiterId int NULL,
    AssignedByHostId int NULL,
    StartTime datetime2 NOT NULL,
    EndTime datetime2 NULL,
    IsActive bit NOT NULL,
    SpecialNotes nvarchar(max) NULL,
    CreatedAt datetime2 NOT NULL,
    UpdatedAt datetime2 NOT NULL,
    CONSTRAINT PK_TableSessions PRIMARY KEY (Id),
    CONSTRAINT FK_TableSessions_Tables_TableId FOREIGN KEY (TableId) REFERENCES Tables(Id),
    CONSTRAINT FK_TableSessions_Users_AssignedWaiterId FOREIGN KEY (AssignedWaiterId) REFERENCES Users(Id),
    CONSTRAINT FK_TableSessions_Users_AssignedByHostId FOREIGN KEY (AssignedByHostId) REFERENCES Users(Id)
  );
  CREATE INDEX IX_TableSessions_TableId ON TableSessions(TableId);
  CREATE INDEX IX_TableSessions_AssignedWaiterId ON TableSessions(AssignedWaiterId);
  CREATE INDEX IX_TableSessions_AssignedByHostId ON TableSessions(AssignedByHostId);
END

-- ---------- TABLA TableReservations (si no existe) ----------
IF OBJECT_ID('TableReservations','U') IS NULL
BEGIN
  CREATE TABLE TableReservations (
    Id int IDENTITY(1,1) NOT NULL,
    TableId int NOT NULL,
    CustomerName nvarchar(max) NOT NULL,
    CustomerPhone nvarchar(max) NOT NULL,
    CustomerEmail nvarchar(max) NULL,
    NumberOfGuests int NOT NULL,
    ReservationDateTime datetime2 NOT NULL,
    SpecialRequests nvarchar(max) NULL,
    IsConfirmed bit NOT NULL,
    IsCancelled bit NOT NULL,
    CreatedByHostId int NULL,
    CreatedAt datetime2 NOT NULL,
    UpdatedAt datetime2 NOT NULL,
    CONSTRAINT PK_TableReservations PRIMARY KEY (Id),
    CONSTRAINT FK_TableReservations_Tables_TableId FOREIGN KEY (TableId) REFERENCES Tables(Id),
    CONSTRAINT FK_TableReservations_Users_CreatedByHostId FOREIGN KEY (CreatedByHostId) REFERENCES Users(Id)
  );
  CREATE INDEX IX_TableReservations_TableId ON TableReservations(TableId);
  CREATE INDEX IX_TableReservations_CreatedByHostId ON TableReservations(CreatedByHostId);
END

-- ---------- ÍNDICES ----------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_ProcessedByWaiterId' AND object_id = OBJECT_ID('Payments'))
  CREATE INDEX IX_Payments_ProcessedByWaiterId ON Payments(ProcessedByWaiterId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_AssignedWaiterId' AND object_id = OBJECT_ID('Orders'))
  CREATE INDEX IX_Orders_AssignedWaiterId ON Orders(AssignedWaiterId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_TableSessionId' AND object_id = OBJECT_ID('Orders'))
  CREATE INDEX IX_Orders_TableSessionId ON Orders(TableSessionId);

-- ---------- FOREIGN KEYS (Orders -> TableSessions, Orders -> Users) ----------
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Orders_TableSessions_TableSessionId')
  ALTER TABLE Orders ADD CONSTRAINT FK_Orders_TableSessions_TableSessionId
    FOREIGN KEY (TableSessionId) REFERENCES TableSessions(Id) ON DELETE SET NULL;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Orders_Users_AssignedWaiterId')
  ALTER TABLE Orders ADD CONSTRAINT FK_Orders_Users_AssignedWaiterId
    FOREIGN KEY (AssignedWaiterId) REFERENCES Users(Id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Payments_Users_ProcessedByWaiterId')
  ALTER TABLE Payments ADD CONSTRAINT FK_Payments_Users_ProcessedByWaiterId
    FOREIGN KEY (ProcessedByWaiterId) REFERENCES Users(Id);

PRINT 'Script aplicado correctamente. Reinicia el backend (dotnet run) para que desaparezcan los errores.';
