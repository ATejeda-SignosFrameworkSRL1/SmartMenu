using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260303000000_AddCourseTiming")]
    public partial class AddCourseTiming : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // DefaultCourse en Dishes (int, default 1 = PlatoFuerte)
            migrationBuilder.AddColumn<int>(
                name: "DefaultCourse",
                table: "Dishes",
                type: "int",
                nullable: false,
                defaultValue: 1);

            // CourseTiming en OrderItems (int, nullable — null solo si el registro es anterior a esta migración)
            migrationBuilder.AddColumn<int>(
                name: "CourseTiming",
                table: "OrderItems",
                type: "int",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DefaultCourse", table: "Dishes");
            migrationBuilder.DropColumn(name: "CourseTiming", table: "OrderItems");
        }
    }
}
