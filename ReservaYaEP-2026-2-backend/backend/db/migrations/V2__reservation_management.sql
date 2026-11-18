-- Migracion aditiva para HU-07, HU-09 y HU-10. Conserva las reservas existentes.
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

UPDATE reservations r
SET customer_email = u.email
FROM users u
WHERE r.user_id = u.id
  AND r.customer_email IS NULL;

CREATE TABLE IF NOT EXISTS reservation_audit (
    id              BIGSERIAL PRIMARY KEY,
    reservation_id  BIGINT      NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    actor_user_id   BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_role      VARCHAR(30) NOT NULL,
    action          VARCHAR(20) NOT NULL,
    previous_status VARCHAR(20),
    new_status      VARCHAR(20) NOT NULL,
    details         VARCHAR(255),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_reservation_audit_previous_status CHECK (
        previous_status IS NULL OR previous_status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED')
    ),
    CONSTRAINT ck_reservation_audit_new_status CHECK (
        new_status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED')
    )
);

CREATE INDEX IF NOT EXISTS idx_reservation_audit_reservation
    ON reservation_audit (reservation_id, changed_at DESC);