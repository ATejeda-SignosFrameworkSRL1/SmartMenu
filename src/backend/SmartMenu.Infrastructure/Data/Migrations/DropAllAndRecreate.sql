-- =============================================================================
-- BORRAR TODO EL ESQUEMA: tablas y historial de migraciones.
-- Después de ejecutar esto, corre: dotnet ef database update
-- =============================================================================
SET NOCOUNT ON;

-- Eliminar todas las restricciones FK
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql += 'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';'
FROM sys.foreign_keys;
IF LEN(@sql) > 0 EXEC sp_executesql @sql;

-- Eliminar todas las tablas (incluye __EFMigrationsHistory)
DECLARE @drop NVARCHAR(MAX) = '';
SELECT @drop += 'DROP TABLE ' + QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME) + ';'
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE';
IF LEN(@drop) > 0 EXEC sp_executesql @drop;

PRINT 'Todas las tablas eliminadas. Ejecuta: dotnet ef database update';
