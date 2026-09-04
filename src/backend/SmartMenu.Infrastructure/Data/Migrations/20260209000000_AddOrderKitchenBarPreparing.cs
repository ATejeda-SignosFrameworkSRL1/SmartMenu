using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260209000000_AddOrderKitchenBarPreparing")]
    public partial class AddOrderKitchenBarPreparing : Migration
    {

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "KitchenPreparing",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "BarPreparing",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "KitchenReady",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "BarReady",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "KitchenPreparing", table: "Orders");
            migrationBuilder.DropColumn(name: "BarPreparing", table: "Orders");
            migrationBuilder.DropColumn(name: "KitchenReady", table: "Orders");
            migrationBuilder.DropColumn(name: "BarReady", table: "Orders");
        }
    }
}
