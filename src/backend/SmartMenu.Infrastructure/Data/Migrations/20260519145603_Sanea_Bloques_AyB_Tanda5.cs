using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartMenu.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Snapshot bump intencionalmente vacío.
    ///
    /// Después de Bloques A/B/C/D + Tanda 5, el modelo cambió (RowVersion en
    /// Order/Payment, IsDeleted/DeletedAt en Dish, ~9 índices nuevos, cascade
    /// fix OrderItem→Order, HasQueryFilter en Dish, JsonStringEnumConverter).
    /// El snapshot estaba desactualizado y `migrations add` generó un diff
    /// enorme con operaciones duplicadas de las que `Ensure*Async` ya aplicó
    /// idempotentemente en producción.
    ///
    /// En lugar de un Up() destructivo, esta migration solo actualiza el
    /// snapshot. La DB ya tiene los cambios via Ensure*Async (siguen siendo
    /// invocados desde Program.cs como cinturón + tirantes para DBs frescas).
    ///
    /// FUTURO: nuevas migrations generan diffs limpios desde esta línea base.
    /// </summary>
    public partial class Sanea_Bloques_AyB_Tanda5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op. Ver comentario de clase.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op.
        }
    }
}
