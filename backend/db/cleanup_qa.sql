-- =====================================================================
-- Borra SOLO los datos de pruebas manuales hechas contra Supabase.
-- Convencion: usuarios con correo qa+...@reservaya.test y restaurantes
-- cuyo nombre empieza por "QA ". Las sedes, horarios, reservas y la
-- auditoria caen por ON DELETE CASCADE.
--
-- Uso: Supabase -> SQL Editor -> pegar -> Run. Revisa primero el SELECT.
-- =====================================================================

-- 1) Revisar que se va a borrar
SELECT 'usuario' AS tipo, id, email AS nombre FROM users WHERE email LIKE 'qa+%@reservaya.test'
UNION ALL
SELECT 'restaurante', id, name FROM restaurants WHERE name LIKE 'QA %';

-- 2) Borrar
BEGIN;
DELETE FROM restaurants WHERE name LIKE 'QA %';
DELETE FROM users WHERE email LIKE 'qa+%@reservaya.test';
COMMIT;
