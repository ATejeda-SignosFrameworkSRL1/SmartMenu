using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncOrderAndOrderItemColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables");

            migrationBuilder.AddForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables");

            migrationBuilder.AddForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
