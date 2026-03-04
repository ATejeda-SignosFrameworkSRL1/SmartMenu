using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExtendedFeaturesV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables");

            migrationBuilder.AddColumn<int>(
                name: "ProcessedByWaiterId",
                table: "Payments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TipAmount",
                table: "Payments",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TipPercentage",
                table: "Payments",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalAmount",
                table: "Payments",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "AssignedWaiterId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CustomerFinishedEating",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinishedEatingAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ServedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TableSessionId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Allergies",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Customizations",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DrinkTiming",
                table: "OrderItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MeatCooking",
                table: "OrderItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SideDish",
                table: "OrderItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WithAlcohol",
                table: "OrderItems",
                type: "bit",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TableReservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableId = table.Column<int>(type: "int", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CustomerPhone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NumberOfGuests = table.Column<int>(type: "int", nullable: false),
                    ReservationDateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SpecialRequests = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    IsCancelled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByHostId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TableReservations_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TableReservations_Users_CreatedByHostId",
                        column: x => x.CreatedByHostId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TableSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableId = table.Column<int>(type: "int", nullable: false),
                    NumberOfGuests = table.Column<int>(type: "int", nullable: false),
                    AssignedWaiterId = table.Column<int>(type: "int", nullable: true),
                    AssignedByHostId = table.Column<int>(type: "int", nullable: true),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SpecialNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TableSessions_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TableSessions_Users_AssignedByHostId",
                        column: x => x.AssignedByHostId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TableSessions_Users_AssignedWaiterId",
                        column: x => x.AssignedWaiterId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ProcessedByWaiterId",
                table: "Payments",
                column: "ProcessedByWaiterId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_AssignedWaiterId",
                table: "Orders",
                column: "AssignedWaiterId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_TableSessionId",
                table: "Orders",
                column: "TableSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_CreatedByHostId",
                table: "TableReservations",
                column: "CreatedByHostId");

            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_TableId",
                table: "TableReservations",
                column: "TableId");

            migrationBuilder.CreateIndex(
                name: "IX_TableSessions_AssignedByHostId",
                table: "TableSessions",
                column: "AssignedByHostId");

            migrationBuilder.CreateIndex(
                name: "IX_TableSessions_AssignedWaiterId",
                table: "TableSessions",
                column: "AssignedWaiterId");

            migrationBuilder.CreateIndex(
                name: "IX_TableSessions_TableId",
                table: "TableSessions",
                column: "TableId");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_TableSessions_TableSessionId",
                table: "Orders",
                column: "TableSessionId",
                principalTable: "TableSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Users_AssignedWaiterId",
                table: "Orders",
                column: "AssignedWaiterId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Users_ProcessedByWaiterId",
                table: "Payments",
                column: "ProcessedByWaiterId",
                principalTable: "Users",
                principalColumn: "Id");

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
                name: "FK_Orders_TableSessions_TableSessionId",
                table: "Orders");

            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Users_AssignedWaiterId",
                table: "Orders");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Users_ProcessedByWaiterId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables");

            migrationBuilder.DropTable(
                name: "TableReservations");

            migrationBuilder.DropTable(
                name: "TableSessions");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ProcessedByWaiterId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Orders_AssignedWaiterId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_TableSessionId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ProcessedByWaiterId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TipAmount",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TipPercentage",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TotalAmount",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "AssignedWaiterId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CustomerFinishedEating",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FinishedEatingAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ServedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TableSessionId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Allergies",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "Customizations",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "DrinkTiming",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "MeatCooking",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "SideDish",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "WithAlcohol",
                table: "OrderItems");

            migrationBuilder.AddForeignKey(
                name: "FK_Tables_Zones_ZoneId",
                table: "Tables",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
