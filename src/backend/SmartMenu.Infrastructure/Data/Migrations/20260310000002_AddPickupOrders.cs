using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SmartMenu.Infrastructure.Data;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260310000002_AddPickupOrders")]
    public partial class AddPickupOrders : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Make TableId nullable (para órdenes de mostrador sin mesa)
            migrationBuilder.AlterColumn<int>(
                name: "TableId",
                table: "Orders",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // Add IsPickup flag
            migrationBuilder.AddColumn<bool>(
                name: "IsPickup",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IsPickup", table: "Orders");

            migrationBuilder.AlterColumn<int>(
                name: "TableId",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldNullable: true,
                oldType: "int");
        }
    }
}
