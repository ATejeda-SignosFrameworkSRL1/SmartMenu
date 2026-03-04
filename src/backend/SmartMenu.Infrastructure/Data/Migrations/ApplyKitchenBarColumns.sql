-- Añade las columnas KitchenPreparing, BarPreparing, KitchenReady, BarReady a Orders si no existen.
-- Ejecuta este script en tu base de datos (SQL Server) si la migración no se aplicó.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Orders') AND name = 'KitchenPreparing')
    ALTER TABLE [Orders] ADD [KitchenPreparing] bit NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Orders') AND name = 'BarPreparing')
    ALTER TABLE [Orders] ADD [BarPreparing] bit NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Orders') AND name = 'KitchenReady')
    ALTER TABLE [Orders] ADD [KitchenReady] bit NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Orders') AND name = 'BarReady')
    ALTER TABLE [Orders] ADD [BarReady] bit NOT NULL DEFAULT 0;

GO
