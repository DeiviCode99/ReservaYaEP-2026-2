-- La tabla schedules de produccion se creo con un borrador antiguo del esquema
-- (Resumen_proyecto.md) que usaba dias 0..6. El codigo usa ISO-8601: 1=lunes ... 7=domingo
-- (java.time.DayOfWeek), igual que schema.sql. Con la restriccion vieja ninguna sede
-- con horario de domingo (7) se podia guardar.
-- Se puede ejecutar mas de una vez.

-- En el esquema 0..6 el domingo era 0.
UPDATE schedules SET day_of_week = 7 WHERE day_of_week = 0;

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_day_of_week_check;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS ck_schedules_day;
ALTER TABLE schedules ADD CONSTRAINT ck_schedules_day CHECK (day_of_week BETWEEN 1 AND 7);
