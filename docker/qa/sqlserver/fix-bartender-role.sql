-- One-shot corrective: alinear el QA stack con el fix del seed
-- bartender@smartmenu.com debe ser Bartender (rol=8), no Waiter (rol=3).
-- Y eliminar el duplicado legacy bar@smartmenu.com.

PRINT '-- BEFORE --';
SELECT Email, Role FROM Users WHERE Email IN ('bartender@smartmenu.com', 'bar@smartmenu.com');

UPDATE Users SET Role = 8 WHERE Email = 'bartender@smartmenu.com' AND Role <> 8;
DELETE FROM Users WHERE Email = 'bar@smartmenu.com';

PRINT '-- AFTER --';
SELECT Email, Role FROM Users WHERE Email IN ('bartender@smartmenu.com', 'bar@smartmenu.com');
