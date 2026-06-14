// Criação do schema e seed inicial. Idempotente: roda a cada boot do servidor,
// cria as tabelas se não existirem e popula o cadastro só se estiver vazio.
const pool = require('./pool');

const SCHEMA = `
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

  -- Leituras: série temporal. device_id sem FK rígida para aceitar ingestão
  -- de dispositivos não cadastrados / legado (bucket "default").
  CREATE TABLE IF NOT EXISTS readings (
    id        bigserial PRIMARY KEY,
    device_id text NOT NULL,
    db        real NOT NULL,
    level     text NOT NULL,
    ts        bigint NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings (device_id, ts DESC);
`;

// Mesmos dados de exemplo de antes (organização → ambientes → dispositivos).
const SEED = {
  organizations: [
    { id: 'org-demo', name: 'Organização Demo', active: true },
  ],
  environments: [
    { id: 'school-1',   name: 'Escola Central',        type: 'school',     icon: '🏫', org_id: 'org-demo' },
    { id: 'indust-1',   name: 'Galpão Industrial A',   type: 'industrial', icon: '🏭', org_id: 'org-demo' },
    { id: 'office-1',   name: 'Escritório Open Space', type: 'office',     icon: '🏢', org_id: 'org-demo' },
    { id: 'hospital-1', name: 'Hospital Geral',        type: 'hospital',   icon: '🏥', org_id: 'org-demo' },
  ],
  devices: [
    { id: 's101', name: 'Sala 101',            env_id: 'school-1',   base: 55, warn: 70, crit: 85 },
    { id: 's102', name: 'Sala 102',            env_id: 'school-1',   base: 62, warn: 70, crit: 85 },
    { id: 's103', name: 'Sala 103',            env_id: 'school-1',   base: 50, warn: 70, crit: 85 },
    { id: 'lab',  name: 'Lab de Ciências',     env_id: 'school-1',   base: 70, warn: 70, crit: 85 },
    { id: 'bib',  name: 'Biblioteca',          env_id: 'school-1',   base: 40, warn: 60, crit: 75 },
    { id: 'ref',  name: 'Refeitório',          env_id: 'school-1',   base: 78, warn: 75, crit: 90 },
    { id: 'l1',   name: 'Linha de Produção 1', env_id: 'indust-1',   base: 84, warn: 80, crit: 90 },
    { id: 'l2',   name: 'Linha de Produção 2', env_id: 'indust-1',   base: 88, warn: 80, crit: 90 },
    { id: 'comp', name: 'Compressores',        env_id: 'indust-1',   base: 95, warn: 85, crit: 95 },
    { id: 'exp',  name: 'Expedição',           env_id: 'indust-1',   base: 76, warn: 80, crit: 90 },
    { id: 'alm',  name: 'Almoxarifado',        env_id: 'indust-1',   base: 62, warn: 80, crit: 90 },
    { id: 'os',   name: 'Open Space',          env_id: 'office-1',   base: 63, warn: 65, crit: 80 },
    { id: 'sr',   name: 'Sala de Reunião',     env_id: 'office-1',   base: 58, warn: 65, crit: 80 },
    { id: 'copa', name: 'Copa',                env_id: 'office-1',   base: 64, warn: 65, crit: 80 },
    { id: 'rec',  name: 'Recepção',            env_id: 'hospital-1', base: 58, warn: 55, crit: 70 },
    { id: 'uti',  name: 'UTI',                 env_id: 'hospital-1', base: 45, warn: 50, crit: 60 },
    { id: 'enfa', name: 'Enfermaria A',        env_id: 'hospital-1', base: 52, warn: 55, crit: 70 },
    { id: 'enfb', name: 'Enfermaria B',        env_id: 'hospital-1', base: 54, warn: 55, crit: 70 },
    { id: 'cc',   name: 'Centro Cirúrgico',    env_id: 'hospital-1', base: 48, warn: 50, crit: 65 },
    { id: 'href', name: 'Refeitório',          env_id: 'hospital-1', base: 61, warn: 65, crit: 80 },
  ],
};

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM organizations');
  if (rows[0].n > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const o of SEED.organizations) {
      await client.query(
        'INSERT INTO organizations(id, name, active) VALUES ($1,$2,$3)',
        [o.id, o.name, o.active],
      );
    }
    for (const e of SEED.environments) {
      await client.query(
        'INSERT INTO environments(id, name, type, icon, org_id) VALUES ($1,$2,$3,$4,$5)',
        [e.id, e.name, e.type, e.icon, e.org_id],
      );
    }
    for (const d of SEED.devices) {
      await client.query(
        `INSERT INTO devices(id, name, env_id, base, warn_threshold, crit_threshold, interval_ms, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.id, d.name, d.env_id, d.base, d.warn, d.crit, 1000, true],
      );
    }
    await client.query('COMMIT');
    console.log('Seed inicial inserido no banco.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function init() {
  await pool.query(SCHEMA);
  await seedIfEmpty();
}

module.exports = { init };
