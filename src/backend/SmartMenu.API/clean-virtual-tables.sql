-- Limpiar todas las mesas virtuales para testing
DELETE FROM VirtualTableTables;
DELETE FROM VirtualTables;

-- Verificar que esté vacío
SELECT * FROM VirtualTables;
SELECT * FROM VirtualTableTables;

-- Ver las mesas disponibles
SELECT Id, TableNumber, ZoneId, Status FROM Tables ORDER BY TableNumber;
