using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{

    public partial class AddDeliveryGeoTracking : Migration
    {

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "Restaurants",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "Restaurants",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DriverLat",
                table: "Invoices",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DriverLng",
                table: "Invoices",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DriverLocationAt",
                table: "Invoices",
                type: "datetime2",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DriverLat",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "DriverLng",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "DriverLocationAt",
                table: "Invoices");
        }
    }
}
