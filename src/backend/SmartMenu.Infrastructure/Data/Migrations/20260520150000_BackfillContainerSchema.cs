using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{

    public partial class BackfillContainerSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'AssignedZoneId' AND Object_ID = Object_ID(N'Users'))
BEGIN
    ALTER TABLE [Users] ADD [AssignedZoneId] int NULL;
END;");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_AssignedZoneId' AND object_id = OBJECT_ID(N'Users'))
BEGIN
    CREATE INDEX [IX_Users_AssignedZoneId] ON [Users]([AssignedZoneId]);
END;");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Users_Zones_AssignedZoneId' AND parent_object_id = OBJECT_ID(N'Users'))
BEGIN
    ALTER TABLE [Users]
        ADD CONSTRAINT [FK_Users_Zones_AssignedZoneId]
        FOREIGN KEY ([AssignedZoneId]) REFERENCES [Zones]([Id]);
END;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Users_Zones_AssignedZoneId')
    ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Zones_AssignedZoneId];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_AssignedZoneId' AND object_id = OBJECT_ID(N'Users'))
    DROP INDEX [IX_Users_AssignedZoneId] ON [Users];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'AssignedZoneId' AND Object_ID = Object_ID(N'Users'))
    ALTER TABLE [Users] DROP COLUMN [AssignedZoneId];");
        }
    }
}
