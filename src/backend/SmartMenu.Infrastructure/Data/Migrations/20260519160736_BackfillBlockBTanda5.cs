using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Backfill formal de los cambios de Bloque B + Tanda 5 que originalmente
    /// se aplicaban vía DbInitializer.EnsureConcurrencyAndSoftDeleteColumnsAsync
    /// y DbInitializer.EnsureTanda5DbObjectsAsync.
    ///
    /// Up() es idempotente (IF NOT EXISTS) para que esta migration sea segura tanto en
    /// DBs nuevas (aplica los cambios) como en DBs existentes donde los Ensure*Async
    /// ya corrieron (no-op).
    ///
    /// Cambios:
    /// - RowVersion (rowversion NOT NULL) en Orders y Payments — optimistic concurrency.
    /// - IsDeleted (bit NOT NULL DEFAULT 0) + DeletedAt (datetime2 NULL) en Dishes — soft delete fiscal.
    /// - FK OrderItems.OrderId: CASCADE → NO ACTION (proteger histórico fiscal de DELETE accidental).
    /// - 6 índices para queries de dashboard/reports.
    /// </summary>
    public partial class BackfillBlockBTanda5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'RowVersion')
                    ALTER TABLE Orders ADD RowVersion rowversion NOT NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'RowVersion')
                    ALTER TABLE Payments ADD RowVersion rowversion NOT NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'IsDeleted')
                    ALTER TABLE Dishes ADD IsDeleted bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'DeletedAt')
                    ALTER TABLE Dishes ADD DeletedAt datetime2 NULL;");

            migrationBuilder.Sql(@"
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
                END;");

            migrationBuilder.Sql(@"
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TableSessions_TableId_IsActive' AND object_id = OBJECT_ID('TableSessions'))
                    DROP INDEX IX_TableSessions_TableId_IsActive ON TableSessions;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dishes_CategoryId_IsAvailable' AND object_id = OBJECT_ID('Dishes'))
                    DROP INDEX IX_Dishes_CategoryId_IsAvailable ON Dishes;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dishes_IsDeleted' AND object_id = OBJECT_ID('Dishes'))
                    DROP INDEX IX_Dishes_IsDeleted ON Dishes;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_Status' AND object_id = OBJECT_ID('Payments'))
                    DROP INDEX IX_Payments_Status ON Payments;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_CreatedAt' AND object_id = OBJECT_ID('Orders'))
                    DROP INDEX IX_Orders_CreatedAt ON Orders;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Status' AND object_id = OBJECT_ID('Orders'))
                    DROP INDEX IX_Orders_Status ON Orders;");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'DeletedAt')
                    ALTER TABLE Dishes DROP COLUMN DeletedAt;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dishes') AND name = 'IsDeleted')
                    ALTER TABLE Dishes DROP COLUMN IsDeleted;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'RowVersion')
                    ALTER TABLE Payments DROP COLUMN RowVersion;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Orders') AND name = 'RowVersion')
                    ALTER TABLE Orders DROP COLUMN RowVersion;");
        }
    }
}
