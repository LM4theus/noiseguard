// Camada de dados de cadastro sobre o Postgres.
// Hierarquia: Organização → N Ambientes → N Dispositivos.
const pool = require('./db/pool');

const TYPE_ICON = { school: '🏫', industrial: '🏭', office: '🏢', hospital: '🏥' };

// ── Mapeamento snake_case (DB) → camelCase (API/front) ─────────
const mapOrg = r => ({ id: r.id, name: r.name, active: r.active });
const mapEnv = r => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, orgId: r.org_id });
const mapDevice = r => ({
  id: r.id, name: r.name, envId: r.env_id,
  base: r.base, warnThreshold: r.warn_threshold, critThreshold: r.crit_threshold,
  intervalMs: r.interval_ms, active: r.active,
});

// ── Helpers de id ──────────────────────────────────────────────
function slugify(s) {
  const from = 'àáâãäçèéêëìíîïñòóôõöùúûüý';
  const to   = 'aaaaaceeeeiiiinooooouuuuy';
  const str = (s || '').toString().normalize('NFC').toLowerCase();
  let out = '';
  for (const ch of str) {
    const i = from.indexOf(ch);
    out += i === -1 ? ch : to[i];
  }
  return out.trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'item';
}

function uniqueId(base, existingIds) {
  const set = new Set(existingIds);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ── Registro completo (árvore para o front) ────────────────────
async function getRegistry() {
  const [orgs, envs, devs] = await Promise.all([
    pool.query('SELECT * FROM organizations ORDER BY name'),
    pool.query('SELECT * FROM environments ORDER BY name'),
    pool.query('SELECT * FROM devices ORDER BY name'),
  ]);
  return {
    organizations: orgs.rows.map(mapOrg),
    environments: envs.rows.map(mapEnv),
    devices: devs.rows.map(mapDevice),
  };
}

// ── Contagens ──────────────────────────────────────────────────
async function countEnvironments(orgId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM environments WHERE org_id=$1', [orgId]);
  return rows[0].n;
}

async function countDevicesByEnv(envId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM devices WHERE env_id=$1', [envId]);
  return rows[0].n;
}

// ── Organizações ───────────────────────────────────────────────
async function listOrganizationsWithCounts() {
  const { rows } = await pool.query(`
    SELECT o.*,
      (SELECT count(*)::int FROM environments e WHERE e.org_id = o.id) AS environments,
      (SELECT count(*)::int FROM devices d
         JOIN environments e2 ON d.env_id = e2.id
        WHERE e2.org_id = o.id) AS devices
    FROM organizations o
    ORDER BY o.name
  `);
  return rows.map(r => ({ ...mapOrg(r), environments: r.environments, devices: r.devices }));
}

async function getOrganization(id) {
  const { rows } = await pool.query('SELECT * FROM organizations WHERE id=$1', [id]);
  return rows[0] ? mapOrg(rows[0]) : null;
}

async function organizationExists(id) {
  const { rows } = await pool.query('SELECT 1 FROM organizations WHERE id=$1', [id]);
  return rows.length > 0;
}

async function addOrganization({ name, active }) {
  const { rows } = await pool.query('SELECT id FROM organizations');
  const id = uniqueId(`org-${slugify(name)}`, rows.map(r => r.id));
  const isActive = active !== false;
  await pool.query('INSERT INTO organizations(id, name, active) VALUES ($1,$2,$3)', [id, name, isActive]);
  return { id, name, active: isActive };
}

async function updateOrganization(id, patch) {
  const cur = await getOrganization(id);
  if (!cur) return null;
  const name = patch.name != null ? patch.name : cur.name;
  const active = 'active' in patch ? !!patch.active : cur.active;
  await pool.query('UPDATE organizations SET name=$2, active=$3 WHERE id=$1', [id, name, active]);
  return { id, name, active };
}

async function deleteOrganization(id) {
  const exists = await organizationExists(id);
  if (!exists) return { ok: false, code: 404 };
  if (await countEnvironments(id) > 0) return { ok: false, code: 409 };
  await pool.query('DELETE FROM organizations WHERE id=$1', [id]);
  return { ok: true };
}

// ── Ambientes ──────────────────────────────────────────────────
async function listEnvironmentsWithCounts(orgId) {
  const params = [];
  let where = '';
  if (orgId) { params.push(orgId); where = 'WHERE e.org_id = $1'; }
  const { rows } = await pool.query(`
    SELECT e.*,
      (SELECT count(*)::int FROM devices d WHERE d.env_id = e.id) AS devices
    FROM environments e
    ${where}
    ORDER BY e.name
  `, params);
  return rows.map(r => ({ ...mapEnv(r), devices: r.devices }));
}

async function getEnvironment(id) {
  const { rows } = await pool.query('SELECT * FROM environments WHERE id=$1', [id]);
  return rows[0] ? mapEnv(rows[0]) : null;
}

async function environmentExists(id) {
  const { rows } = await pool.query('SELECT 1 FROM environments WHERE id=$1', [id]);
  return rows.length > 0;
}

async function addEnvironment({ name, type, icon, orgId }) {
  const { rows } = await pool.query('SELECT id FROM environments');
  const id = uniqueId(slugify(name), rows.map(r => r.id));
  const ic = icon || TYPE_ICON[type] || '📍';
  await pool.query(
    'INSERT INTO environments(id, name, type, icon, org_id) VALUES ($1,$2,$3,$4,$5)',
    [id, name, type, ic, orgId],
  );
  return mapEnv({ id, name, type, icon: ic, org_id: orgId });
}

async function updateEnvironment(id, patch) {
  const cur = await getEnvironment(id);
  if (!cur) return null;
  const name  = patch.name  != null ? patch.name  : cur.name;
  const type  = patch.type  != null ? patch.type  : cur.type;
  const icon  = patch.icon  != null ? patch.icon  : cur.icon;
  const orgId = patch.orgId != null ? patch.orgId : cur.orgId;
  await pool.query(
    'UPDATE environments SET name=$2, type=$3, icon=$4, org_id=$5 WHERE id=$1',
    [id, name, type, icon, orgId],
  );
  return mapEnv({ id, name, type, icon, org_id: orgId });
}

async function deleteEnvironment(id) {
  const exists = await environmentExists(id);
  if (!exists) return { ok: false, code: 404 };
  if (await countDevicesByEnv(id) > 0) return { ok: false, code: 409 };
  await pool.query('DELETE FROM environments WHERE id=$1', [id]);
  return { ok: true };
}

// ── Dispositivos ───────────────────────────────────────────────
async function getDevice(id) {
  const { rows } = await pool.query('SELECT * FROM devices WHERE id=$1', [id]);
  return rows[0] ? mapDevice(rows[0]) : null;
}

async function addDevice(d) {
  await pool.query(
    `INSERT INTO devices(id, name, env_id, base, warn_threshold, crit_threshold, interval_ms, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [d.id, d.name, d.envId, d.base, d.warnThreshold, d.critThreshold, d.intervalMs, d.active !== false],
  );
  return d;
}

async function updateDevice(id, patch) {
  const cur = await getDevice(id);
  if (!cur) return null;
  const m = { ...cur, ...patch, id };
  await pool.query(
    `UPDATE devices SET name=$2, env_id=$3, base=$4, warn_threshold=$5,
       crit_threshold=$6, interval_ms=$7, active=$8 WHERE id=$1`,
    [id, m.name, m.envId, m.base, m.warnThreshold, m.critThreshold, m.intervalMs, m.active !== false],
  );
  return m;
}

async function deleteDevice(id) {
  const cur = await getDevice(id);
  if (!cur) return false;
  await pool.query('DELETE FROM readings WHERE device_id=$1', [id]);
  await pool.query('DELETE FROM devices WHERE id=$1', [id]);
  return true;
}

module.exports = {
  TYPE_ICON,
  getRegistry,
  countEnvironments, countDevicesByEnv,
  listOrganizationsWithCounts, getOrganization, organizationExists,
  addOrganization, updateOrganization, deleteOrganization,
  listEnvironmentsWithCounts, getEnvironment, environmentExists,
  addEnvironment, updateEnvironment, deleteEnvironment,
  getDevice, addDevice, updateDevice, deleteDevice,
};
