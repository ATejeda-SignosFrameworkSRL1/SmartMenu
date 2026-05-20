-- SmartMenu QA — crea las 2 bases vacías (EF migrations las popula al arrancar el backend).
-- Idempotente: corre cada vez que se levanta el container.

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'DbNewMenu')
BEGIN
    CREATE DATABASE [DbNewMenu];
    PRINT 'Created DbNewMenu';
END
ELSE
    PRINT 'DbNewMenu already exists';

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'DbNewMenuAudit')
BEGIN
    CREATE DATABASE [DbNewMenuAudit];
    PRINT 'Created DbNewMenuAudit';
END
ELSE
    PRINT 'DbNewMenuAudit already exists';
GO

-- Healthcheck flag (Caddy/healthcheck.sh comprueba esto)
USE [master];
GO
