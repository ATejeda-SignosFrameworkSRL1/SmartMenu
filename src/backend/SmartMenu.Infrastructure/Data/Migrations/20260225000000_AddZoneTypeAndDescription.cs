using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260225000000_AddZoneTypeAndDescription")]
    public partial class AddZoneTypeAndDescription : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Zones",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Dining");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Zones",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Type", table: "Zones");
            migrationBuilder.DropColumn(name: "Description", table: "Zones");
        }
    }
}
