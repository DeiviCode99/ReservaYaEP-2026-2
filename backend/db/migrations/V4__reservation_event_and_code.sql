-- Añade evento y código visible de confirmación a las reservas existentes.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event VARCHAR(30) NOT NULL DEFAULT 'NONE';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(40);

UPDATE reservations
SET confirmation_code = 'RY-' || LPAD(id::text, 6, '0')
WHERE confirmation_code IS NULL;

ALTER TABLE reservations ALTER COLUMN confirmation_code SET NOT NULL;
-- DROP IF EXISTS: el script se puede volver a ejecutar sin fallar.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS uq_reservations_confirmation_code;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS ck_reservations_event;
ALTER TABLE reservations ADD CONSTRAINT uq_reservations_confirmation_code UNIQUE (confirmation_code);
ALTER TABLE reservations ADD CONSTRAINT ck_reservations_event
    CHECK (event IN ('NONE', 'ROMANTIC_DINNER', 'BIRTHDAY', 'WEDDING'));