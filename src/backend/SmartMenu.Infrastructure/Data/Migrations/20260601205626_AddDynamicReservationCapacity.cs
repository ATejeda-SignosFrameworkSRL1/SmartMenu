using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Capacidad dinámica por intervalo: nuevas columnas de ciclo de vida en TableReservations
    /// (Status, EndDateTime, DurationMinutes, ServicePeriodId, RowVersion, holds, timestamps,
    /// ConfirmationCode, TableSessionId, depósito stub) + tablas ServicePeriods y ReservationTables.
    ///
    /// NOTA DE DRIFT: el diff de EF también incluyó objetos que ya existen en la BD (creados por
    /// Ensure*Async / migraciones previas no reflejadas en el snapshot anterior). Esos se manejan así:
    ///   - PayerTableId, columnas PIN, WaiterAuthMode y la tabla AuditEvents → ya los crean sus
    ///     respectivos Ensure*Async (siguen cableados en Program.cs); NO se re-crean aquí.
    ///   - OccasionType, RequestedZoneId (+ índice y FK) → se aplican idempotentes (IF NOT EXISTS)
    ///     para no fallar en la BD actual y seguir creándolos en una BD fresca.
    /// Solo los objetos genuinamente nuevos usan las llamadas EF directas.
    /// </summary>
    public partial class AddDynamicReservationCapacity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // (1) Objetos pre-existentes incluidos por el diff — idempotentes para no chocar.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'OccasionType' AND Object_ID = Object_ID(N'TableReservations'))
    ALTER TABLE [TableReservations] ADD [OccasionType] int NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'RequestedZoneId' AND Object_ID = Object_ID(N'TableReservations'))
    ALTER TABLE [TableReservations] ADD [RequestedZoneId] int NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TableReservations_RequestedZoneId' AND object_id = OBJECT_ID(N'TableReservations'))
    CREATE INDEX [IX_TableReservations_RequestedZoneId] ON [TableReservations]([RequestedZoneId]);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_TableReservations_Zones_RequestedZoneId' AND parent_object_id = OBJECT_ID(N'TableReservations'))
    ALTER TABLE [TableReservations] ADD CONSTRAINT [FK_TableReservations_Zones_RequestedZoneId] FOREIGN KEY ([RequestedZoneId]) REFERENCES [Zones]([Id]);");

            // (2) TableId pasa a nullable (portal sin mesa). Ya lo es en la BD actual; no-op seguro.
            migrationBuilder.AlterColumn<int>(
                name: "TableId",
                table: "TableReservations",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            // (3) Columnas nuevas de capacidad dinámica por intervalo.
            migrationBuilder.AddColumn<string>(name: "CancelReason", table: "TableReservations", type: "nvarchar(max)", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "CancelledAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "CompletedAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<string>(name: "ConfirmationCode", table: "TableReservations", type: "nvarchar(450)", nullable: true);
            migrationBuilder.AddColumn<decimal>(name: "DepositAmount", table: "TableReservations", type: "decimal(18,2)", nullable: true);
            migrationBuilder.AddColumn<string>(name: "DepositStatus", table: "TableReservations", type: "nvarchar(max)", nullable: true);
            migrationBuilder.AddColumn<int>(name: "DurationMinutes", table: "TableReservations", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<DateTime>(name: "EndDateTime", table: "TableReservations", type: "datetime2", nullable: false, defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
            migrationBuilder.AddColumn<DateTime>(name: "HoldExpiresAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "NoShowAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "ReminderSentAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<byte[]>(name: "RowVersion", table: "TableReservations", type: "rowversion", rowVersion: true, nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "SeatedAt", table: "TableReservations", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<int>(name: "ServicePeriodId", table: "TableReservations", type: "int", nullable: true);
            migrationBuilder.AddColumn<int>(name: "Status", table: "TableReservations", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "TableSessionId", table: "TableReservations", type: "int", nullable: true);

            // (4) Tablas nuevas.
            migrationBuilder.CreateTable(
                name: "ServicePeriods",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RestaurantId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DaysOfWeekMask = table.Column<int>(type: "int", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                    SlotMinutes = table.Column<int>(type: "int", nullable: false),
                    DefaultDurationMinutes = table.Column<int>(type: "int", nullable: false),
                    TurnoverBufferMinutes = table.Column<int>(type: "int", nullable: false),
                    MaxCoversPerSlot = table.Column<int>(type: "int", nullable: false),
                    MaxReservationsPerSlot = table.Column<int>(type: "int", nullable: false),
                    LeadTimeMinutes = table.Column<int>(type: "int", nullable: false),
                    MaxHorizonDays = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    LargePartyThreshold = table.Column<int>(type: "int", nullable: true),
                    LargePartyDurationMinutes = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServicePeriods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServicePeriods_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReservationTables",
                columns: table => new
                {
                    ReservationId = table.Column<int>(type: "int", nullable: false),
                    TableId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReservationTables", x => new { x.ReservationId, x.TableId });
                    table.ForeignKey(
                        name: "FK_ReservationTables_TableReservations_ReservationId",
                        column: x => x.ReservationId,
                        principalTable: "TableReservations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReservationTables_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // (5) Índices nuevos.
            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_ConfirmationCode",
                table: "TableReservations",
                column: "ConfirmationCode");
            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_ServicePeriodId_ReservationDateTime",
                table: "TableReservations",
                columns: new[] { "ServicePeriodId", "ReservationDateTime" });
            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_Status_ReservationDateTime_EndDateTime",
                table: "TableReservations",
                columns: new[] { "Status", "ReservationDateTime", "EndDateTime" });
            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_TableSessionId",
                table: "TableReservations",
                column: "TableSessionId");
            migrationBuilder.CreateIndex(
                name: "IX_ReservationTables_TableId",
                table: "ReservationTables",
                column: "TableId");
            migrationBuilder.CreateIndex(
                name: "IX_ServicePeriods_RestaurantId_IsActive",
                table: "ServicePeriods",
                columns: new[] { "RestaurantId", "IsActive" });

            // (6) FKs nuevas.
            migrationBuilder.AddForeignKey(
                name: "FK_TableReservations_ServicePeriods_ServicePeriodId",
                table: "TableReservations",
                column: "ServicePeriodId",
                principalTable: "ServicePeriods",
                principalColumn: "Id");
            migrationBuilder.AddForeignKey(
                name: "FK_TableReservations_TableSessions_TableSessionId",
                table: "TableReservations",
                column: "TableSessionId",
                principalTable: "TableSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // (7) Backfill de filas legacy: Status desde los bool, duración/ventana por defecto.
            migrationBuilder.Sql(@"
UPDATE [TableReservations] SET [DurationMinutes] = 90 WHERE [DurationMinutes] = 0;
UPDATE [TableReservations] SET [EndDateTime] = DATEADD(MINUTE, [DurationMinutes] + 10, [ReservationDateTime]) WHERE [EndDateTime] < '2000-01-01';
UPDATE [TableReservations] SET [Status] = CASE WHEN [IsCancelled] = 1 THEN 5 WHEN [IsConfirmed] = 1 THEN 1 ELSE 0 END;
UPDATE [TableReservations] SET [DepositStatus] = 'None' WHERE [DepositStatus] IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revierte solo los objetos genuinamente nuevos. Deja intactos los pre-existentes
            // (OccasionType, RequestedZoneId, PayerTableId, PIN, WaiterAuthMode, AuditEvents) que
            // son gestionados por sus Ensure*Async / existían antes de esta migración.
            migrationBuilder.DropForeignKey(name: "FK_TableReservations_ServicePeriods_ServicePeriodId", table: "TableReservations");
            migrationBuilder.DropForeignKey(name: "FK_TableReservations_TableSessions_TableSessionId", table: "TableReservations");
            migrationBuilder.DropTable(name: "ReservationTables");
            migrationBuilder.DropTable(name: "ServicePeriods");
            migrationBuilder.DropIndex(name: "IX_TableReservations_ConfirmationCode", table: "TableReservations");
            migrationBuilder.DropIndex(name: "IX_TableReservations_ServicePeriodId_ReservationDateTime", table: "TableReservations");
            migrationBuilder.DropIndex(name: "IX_TableReservations_Status_ReservationDateTime_EndDateTime", table: "TableReservations");
            migrationBuilder.DropIndex(name: "IX_TableReservations_TableSessionId", table: "TableReservations");
            migrationBuilder.DropColumn(name: "CancelReason", table: "TableReservations");
            migrationBuilder.DropColumn(name: "CancelledAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "CompletedAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "ConfirmationCode", table: "TableReservations");
            migrationBuilder.DropColumn(name: "DepositAmount", table: "TableReservations");
            migrationBuilder.DropColumn(name: "DepositStatus", table: "TableReservations");
            migrationBuilder.DropColumn(name: "DurationMinutes", table: "TableReservations");
            migrationBuilder.DropColumn(name: "EndDateTime", table: "TableReservations");
            migrationBuilder.DropColumn(name: "HoldExpiresAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "NoShowAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "ReminderSentAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "RowVersion", table: "TableReservations");
            migrationBuilder.DropColumn(name: "SeatedAt", table: "TableReservations");
            migrationBuilder.DropColumn(name: "ServicePeriodId", table: "TableReservations");
            migrationBuilder.DropColumn(name: "Status", table: "TableReservations");
            migrationBuilder.DropColumn(name: "TableSessionId", table: "TableReservations");
        }
    }
}
