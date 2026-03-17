using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SmartMenu.Infrastructure.Data;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260310000000_AddClientBillingPreferences")]
    public partial class AddClientBillingPreferences : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClientRequestedPaymentMethod",
                table: "Orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ClientTipPercentage",
                table: "Orders",
                type: "decimal(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ClientTipAmount",
                table: "Orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ClientRequestedPaymentMethod", table: "Orders");
            migrationBuilder.DropColumn(name: "ClientTipPercentage", table: "Orders");
            migrationBuilder.DropColumn(name: "ClientTipAmount", table: "Orders");
        }
    }
}
