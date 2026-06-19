-- One-shot reset para arrancar E2E-V2 limpio:
-- - Mesas 5 y 9 → Available (estaban Cleaning/Billing tras último cobro)
-- - VirtualTable 1 → desactivada
-- Las órdenes/payments anteriores se quedan archivados (no tocar historial).

PRINT '-- BEFORE --';
SELECT Id, TableNumber, Status FROM Tables WHERE Id IN (5, 9);
SELECT Id, Name, IsActive FROM VirtualTables;

UPDATE Tables SET Status = 0 WHERE Id IN (5, 9);          -- Available
UPDATE VirtualTables SET IsActive = 0 WHERE IsActive = 1; -- Desactivar todas las activas

PRINT '-- AFTER --';
SELECT Id, TableNumber, Status FROM Tables WHERE Id IN (5, 9);
SELECT Id, Name, IsActive FROM VirtualTables;
