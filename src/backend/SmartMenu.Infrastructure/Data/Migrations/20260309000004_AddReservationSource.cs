using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    public partial class AddReservationSource : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "TableReservations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Internal");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Source", table: "TableReservations");
        }
    }
}
