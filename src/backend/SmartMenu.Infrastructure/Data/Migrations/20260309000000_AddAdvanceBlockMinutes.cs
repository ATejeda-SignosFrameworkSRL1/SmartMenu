using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    public partial class AddAdvanceBlockMinutes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AdvanceBlockMinutes",
                table: "TableReservations",
                type: "int",
                nullable: false,
                defaultValue: 60);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AdvanceBlockMinutes", table: "TableReservations");
        }
    }
}
