using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderIsTakeaway : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTakeaway",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsTakeaway",
                table: "Orders");
        }
    }
}
