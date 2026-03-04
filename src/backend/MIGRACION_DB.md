# Aplicar migración (tablas DishDishTags, DishTags, etc.)

Si la API falla con **"Invalid object name 'DishDishTags'"**, la base de datos no tiene las tablas de la migración.

## Opción recomendada (desarrollo)

**Reinicia la API** (Ctrl+C y luego `dotnet run` de nuevo). En desarrollo, al arrancar la API se ejecuta automáticamente `EnsureMigrationAddVirtualTableTransferDishTagsAsync`, que crea las tablas y columnas faltantes de forma idempotente. No hace falta ejecutar `dotnet ef database update` a mano.

## Opción manual (si lo anterior no aplica)

1. **Detén la API** (Ctrl+C).
2. Desde **`src/backend`** ejecuta:
   ```powershell
   dotnet ef database update --project SmartMenu.Infrastructure --startup-project SmartMenu.API
   ```
3. **Vuelve a arrancar la API**.

Con eso se crean las tablas `DishTags`, `DishDishTags`, `VirtualTables`, `VirtualTableTables`, `TableTransferRequests` y las columnas en `Payments` y `TableReservations`.
