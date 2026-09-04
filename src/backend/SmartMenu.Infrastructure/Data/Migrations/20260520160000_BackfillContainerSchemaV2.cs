using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{

    public partial class BackfillContainerSchemaV2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'KitchenZoneId' AND Object_ID = Object_ID(N'Dishes'))
    ALTER TABLE [Dishes] ADD [KitchenZoneId] int NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Dishes_KitchenZoneId' AND object_id = OBJECT_ID(N'Dishes'))
    CREATE INDEX [IX_Dishes_KitchenZoneId] ON [Dishes]([KitchenZoneId]);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Dishes_Zones_KitchenZoneId' AND parent_object_id = OBJECT_ID(N'Dishes'))
    ALTER TABLE [Dishes]
        ADD CONSTRAINT [FK_Dishes_Zones_KitchenZoneId]
        FOREIGN KEY ([KitchenZoneId]) REFERENCES [Zones]([Id]);");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'BarServed' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] ADD [BarServed] bit NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'KitchenServed' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] ADD [KitchenServed] bit NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CustomerName' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] ADD [CustomerName] nvarchar(max) NULL;");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PreferenceText' AND Object_ID = Object_ID(N'OrderItems'))
    ALTER TABLE [OrderItems] ADD [PreferenceText] nvarchar(max) NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PreferenceText' AND Object_ID = Object_ID(N'OrderItems'))
    ALTER TABLE [OrderItems] DROP COLUMN [PreferenceText];

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CustomerName' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] DROP COLUMN [CustomerName];

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'KitchenServed' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] DROP COLUMN [KitchenServed];

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'BarServed' AND Object_ID = Object_ID(N'Orders'))
    ALTER TABLE [Orders] DROP COLUMN [BarServed];

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Dishes_Zones_KitchenZoneId')
    ALTER TABLE [Dishes] DROP CONSTRAINT [FK_Dishes_Zones_KitchenZoneId];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Dishes_KitchenZoneId' AND object_id = OBJECT_ID(N'Dishes'))
    DROP INDEX [IX_Dishes_KitchenZoneId] ON [Dishes];

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'KitchenZoneId' AND Object_ID = Object_ID(N'Dishes'))
    ALTER TABLE [Dishes] DROP COLUMN [KitchenZoneId];");
        }
    }
}
