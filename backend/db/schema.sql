-- =====================================================================
-- ReservaYa - Esquema de base de datos
-- Entornos de Programacion - Entrega 1
-- Motor: PostgreSQL 15+ (alojado en Supabase, esquema "public")
--
-- Como aplicarlo:
--   Supabase -> SQL Editor -> pegar este archivo -> Run
--
-- Convenciones:
--   * Identificadores: BIGSERIAL (auto-incremento)
--   * Tiempos: TIMESTAMPTZ con DEFAULT now()
--   * Estados y roles: VARCHAR + CHECK (no se usa el tipo ENUM nativo de
--     Postgres porque Hibernate necesitaria un conversor especial para
--     insertarlo; con VARCHAR basta @Enumerated(EnumType.STRING))
-- =====================================================================

-- ---------------------------------------------------------------------
-- Limpieza (util al re-aplicar el esquema durante el desarrollo)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS reservations      CASCADE;
DROP TABLE IF EXISTS restaurant_admins CASCADE;
DROP TABLE IF EXISTS schedules         CASCADE;
DROP TABLE IF EXISTS branches          CASCADE;
DROP TABLE IF EXISTS restaurants       CASCADE;
DROP TABLE IF EXISTS users             CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- ---------------------------------------------------------------------
-- Funcion de apoyo: mantiene updated_at al dia en cada UPDATE
-- ---------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- auth-service
-- =====================================================================

-- RF-01, RF-02, RF-14 / HU-01, HU-02
CREATE TABLE users (
    id            BIGSERIAL     PRIMARY KEY,
    name          VARCHAR(80)   NOT NULL,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(100)  NOT NULL,          -- BCrypt (RNF-03), nunca texto plano
    role          VARCHAR(20)   NOT NULL DEFAULT 'CLIENT',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email  UNIQUE (email),
    CONSTRAINT ck_users_role   CHECK (role IN ('CLIENT', 'RESTAURANT_ADMIN', 'SYSTEM_ADMIN')),
    CONSTRAINT ck_users_name   CHECK (char_length(name) >= 2)
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  users IS 'Usuarios de la plataforma: clientes y administradores de restaurante';
COMMENT ON COLUMN users.password_hash IS 'Hash BCrypt de la contrasena (RNF-03)';


-- =====================================================================
-- restaurant-service
-- =====================================================================

-- La "marca" del restaurante (ej. Crepes & Waffles). RF-03, RF-13 / HU-08
CREATE TABLE restaurants (
    id           BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(80)  NOT NULL,
    cuisine_type VARCHAR(60)  NOT NULL,
    description  TEXT,
    logo_url     VARCHAR(512),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_restaurants_name UNIQUE (name)
);

CREATE INDEX idx_restaurants_name_lower ON restaurants (lower(name));
CREATE INDEX idx_restaurants_cuisine    ON restaurants (lower(cuisine_type));

CREATE TRIGGER trg_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE restaurants IS 'Marca de restaurante. Una marca tiene 1..N sedes';


-- Cada local fisico de una marca. Aqui vive el aforo que valida el cupo (RF-07)
CREATE TABLE branches (
    id            BIGSERIAL    PRIMARY KEY,
    restaurant_id BIGINT       NOT NULL,
    name          VARCHAR(80)  NOT NULL,           -- ej. "Sede Cabecera"
    address       VARCHAR(150) NOT NULL,
    city          VARCHAR(80)  NOT NULL,
    phone         VARCHAR(30),
    latitude      NUMERIC(9,6),
    longitude     NUMERIC(9,6),
    capacity      INT          NOT NULL,           -- aforo maximo por franja horaria
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_branches_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT uq_branches_name_per_restaurant UNIQUE (restaurant_id, name),
    CONSTRAINT ck_branches_capacity CHECK (capacity BETWEEN 1 AND 500)
);

CREATE INDEX idx_branches_restaurant ON branches (restaurant_id);
CREATE INDEX idx_branches_city_lower ON branches (lower(city));

CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN branches.capacity IS 'Aforo (numero de personas) disponible por franja horaria';


-- Horario semanal de cada sede. RF-05 / HU-04
CREATE TABLE schedules (
    id          BIGSERIAL PRIMARY KEY,
    branch_id   BIGINT    NOT NULL,
    day_of_week SMALLINT  NOT NULL,                -- 1 = lunes ... 7 = domingo (ISO-8601)
    open_time   TIME      NOT NULL,
    close_time  TIME      NOT NULL,
    is_closed   BOOLEAN   NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_schedules_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT uq_schedules_branch_day UNIQUE (branch_id, day_of_week),
    CONSTRAINT ck_schedules_day   CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_schedules_range CHECK (is_closed OR close_time > open_time)
);

COMMENT ON COLUMN schedules.day_of_week IS 'Dia ISO-8601: 1=lunes ... 7=domingo (coincide con java.time.DayOfWeek.getValue())';


-- Que administrador gestiona que marca. RF-14
CREATE TABLE restaurant_admins (
    user_id       BIGINT      NOT NULL,
    restaurant_id BIGINT      NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_restaurant_admins PRIMARY KEY (user_id, restaurant_id),
    CONSTRAINT fk_restaurant_admins_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_admins_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX idx_restaurant_admins_restaurant ON restaurant_admins (restaurant_id);

COMMENT ON TABLE restaurant_admins IS 'Vinculacion admin-marca. El JWT trae el rol; esta tabla dice sobre que marca puede actuar';


-- =====================================================================
-- reservation-service
-- =====================================================================

-- RF-06 a RF-12 / HU-05, HU-06, HU-07, HU-09, HU-10
CREATE TABLE reservations (
    id                  BIGSERIAL    PRIMARY KEY,
    user_id             BIGINT       NOT NULL,
    branch_id           BIGINT       NOT NULL,
    reservation_date    DATE         NOT NULL,
    reservation_time    TIME         NOT NULL,     -- franja de una hora exacta
    party_size          INT          NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    cancellation_reason VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_reservations_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reservations_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    CONSTRAINT ck_reservations_party  CHECK (party_size BETWEEN 1 AND 50),
    CONSTRAINT ck_reservations_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'COMPLETED'))
);

-- Consulta de disponibilidad (RF-05) y listado del admin por fecha (RF-10)
CREATE INDEX idx_reservations_branch_date ON reservations (branch_id, reservation_date);
-- Historial del cliente (RF-08 / HU-07)
CREATE INDEX idx_reservations_user_date   ON reservations (user_id, reservation_date DESC);

-- Un mismo cliente no puede tener dos reservas activas en la misma sede,
-- fecha y hora (evita duplicados por doble clic o reenvio del formulario)
CREATE UNIQUE INDEX uq_reservations_active_slot
    ON reservations (user_id, branch_id, reservation_date, reservation_time)
    WHERE status IN ('PENDING', 'CONFIRMED');

CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN reservations.status IS
    'PENDING (creada por el cliente) -> CONFIRMED (admin acepta) | REJECTED (admin rechaza) | CANCELLED (cliente cancela) -> COMPLETED (asistio)';


-- =====================================================================
-- Consulta de referencia: cupo disponible de una sede en una fecha/hora
-- (la logica equivalente vive en reservation-service, RF-07)
--
--   SELECT b.capacity - COALESCE(SUM(r.party_size), 0) AS cupo_disponible
--   FROM   branches b
--   LEFT JOIN reservations r
--          ON r.branch_id = b.id
--         AND r.reservation_date = :fecha
--         AND r.reservation_time = :hora
--         AND r.status IN ('PENDING', 'CONFIRMED')
--   WHERE  b.id = :branchId
--   GROUP  BY b.capacity;
-- =====================================================================
