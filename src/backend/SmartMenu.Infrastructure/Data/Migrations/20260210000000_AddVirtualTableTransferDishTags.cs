using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260210000000_AddVirtualTableTransferDishTags")]
    public partial class AddVirtualTableTransferDishTags : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "BillSplitType", table: "Payments", type: "nvarchar(64)", maxLength: 64, nullable: true);
            migrationBuilder.AddColumn<int>(name: "SplitPartIndex", table: "Payments", type: "int", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "ReservedUntil", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "ConfirmationLinkSentAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<string>(name: "ConfirmationLink", table: "TableReservations", type: "nvarchar(500)", maxLength: 500, nullable: true);

            migrationBuilder.CreateTable(name: "DishTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table => { table.PrimaryKey("PK_DishTags", x => x.Id); });

            migrationBuilder.CreateTable(name: "VirtualTables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CreatedByWaiterId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    DeactivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VirtualTables", x => x.Id);
                    table.ForeignKey(name: "FK_VirtualTables_Users_CreatedByWaiterId", column: x => x.CreatedByWaiterId, principalTable: "Users", principalColumn: "Id", onDelete: ReferentialAction.NoAction);
                });
            migrationBuilder.CreateIndex(name: "IX_VirtualTables_CreatedByWaiterId", table: "VirtualTables", column: "CreatedByWaiterId");

            migrationBuilder.CreateTable(name: "VirtualTableTables",
                columns: table => new
                {
                    VirtualTableId = table.Column<int>(type: "int", nullable: false),
                    TableId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VirtualTableTables", x => new { x.VirtualTableId, x.TableId });
                    table.ForeignKey(name: "FK_VirtualTableTables_VirtualTables_VirtualTableId", column: x => x.VirtualTableId, principalTable: "VirtualTables", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(name: "FK_VirtualTableTables_Tables_TableId", column: x => x.TableId, principalTable: "Tables", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
                });
            migrationBuilder.CreateIndex(name: "IX_VirtualTableTables_TableId", table: "VirtualTableTables", column: "TableId");

            migrationBuilder.CreateTable(name: "TableTransferRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    FromWaiterId = table.Column<int>(type: "int", nullable: false),
                    ToWaiterId = table.Column<int>(type: "int", nullable: false),
                    TableIdsJson = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    RespondedByWaiterId = table.Column<int>(type: "int", nullable: true),
                    RespondedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableTransferRequests", x => x.Id);
                    table.ForeignKey(name: "FK_TableTransferRequests_FromWaiter", column: x => x.FromWaiterId, principalTable: "Users", principalColumn: "Id", onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(name: "FK_TableTransferRequests_ToWaiter", column: x => x.ToWaiterId, principalTable: "Users", principalColumn: "Id", onDelete: ReferentialAction.NoAction);
                });
            migrationBuilder.CreateIndex(name: "IX_TableTransferRequests_FromWaiterId", table: "TableTransferRequests", column: "FromWaiterId");
            migrationBuilder.CreateIndex(name: "IX_TableTransferRequests_ToWaiterId", table: "TableTransferRequests", column: "ToWaiterId");

            migrationBuilder.CreateTable(name: "DishDishTags",
                columns: table => new
                {
                    DishId = table.Column<int>(type: "int", nullable: false),
                    DishTagId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DishDishTags", x => new { x.DishId, x.DishTagId });
                    table.ForeignKey(name: "FK_DishDishTags_Dishes_DishId", column: x => x.DishId, principalTable: "Dishes", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(name: "FK_DishDishTags_DishTags_DishTagId", column: x => x.DishTagId, principalTable: "DishTags", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
                });
            migrationBuilder.CreateIndex(name: "IX_DishDishTags_DishTagId", table: "DishDishTags", column: "DishTagId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "DishDishTags");
            migrationBuilder.DropTable(name: "TableTransferRequests");
            migrationBuilder.DropTable(name: "VirtualTableTables");
            migrationBuilder.DropTable(name: "VirtualTables");
            migrationBuilder.DropTable(name: "DishTags");
            migrationBuilder.DropColumn(name: "BillSplitType", table: "Payments");
            migrationBuilder.DropColumn(name: "SplitPartIndex", table: "Payments");
            migrationBuilder.DropColumn(name: "ReservedUntil", table: "TableReservations");
            migrationBuilder.DropColumn(name: "ConfirmationLinkSentAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "ConfirmationLink", table: "TableReservations");
        }
    }
}
