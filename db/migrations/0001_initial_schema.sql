-- 0001 — Schema inicial: organizações → ambientes → dispositivos + leituras.

CREATE TABLE IF NOT EXISTS organizations (
    id     text PRIMARY KEY,
    name   text NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS environments (
    id     text PRIMARY KEY,
    name   text NOT NULL,
    type   text NOT NULL,
    icon   text,
    org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS devices (
    id             text PRIMARY KEY,
    name           text NOT NULL,
    env_id         text NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    base           real NOT NULL DEFAULT 55,
    warn_threshold real NOT NULL DEFAULT 70,
    crit_threshold real NOT NULL DEFAULT 85,
    interval_ms    integer NOT NULL DEFAULT 1000,
    active         boolean NOT NULL DEFAULT true
);

-- Leituras (série temporal). device_id sem FK rígida para aceitar ingestão
-- de dispositivos não cadastrados / legado (bucket "default").
CREATE TABLE IF NOT EXISTS readings (
    id        bigserial PRIMARY KEY,
    device_id text NOT NULL,
    db        real NOT NULL,
    level     text NOT NULL,
    ts        bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings (device_id, ts DESC);
