// Registro persistente de organizações, ambientes e dispositivos.
// Hierarquia: Organização → N Ambientes → N Dispositivos.
// É a fonte única de verdade consumida pela interface. Persiste em
// data/registry.json.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'registry.json');

const TYPE_ICON = { school: '🏫', industrial: '🏭', office: '🏢', hospital: '🏥' };

// Valores iniciais usados na primeira execução (sem arquivo de persistência).
const SEED = {
  organizations: [
    { id: 'org-demo', name: 'Organização Demo', active: true },
  ],
  environments: [
    { id: 'school-1',   name: 'Escola Central',        type: 'school',     icon: '🏫', orgId: 'org-demo' },
    { id: 'indust-1',   name: 'Galpão Industrial A',   type: 'industrial', icon: '🏭', orgId: 'org-demo' },
    { id: 'office-1',   name: 'Escritório Open Space', type: 'office',     icon: '🏢', orgId: 'org-demo' },
    { id: 'hospital-1', name: 'Hospital Geral',        type: 'hospital',   icon: '🏥', orgId: 'org-demo' },
  ],
  devices: [
    { id: 's101', name: 'Sala 101',           envId: 'school-1',   base: 55, warnThreshold: 70, critThreshold: 85, intervalMs: 1000, active: true },
    { id: 's102', name: 'Sala 102',           envId: 'school-1',   base: 62, warnThreshold: 70, critThreshold: 85, intervalMs: 1000, active: true },
    { id: 's103', name: 'Sala 103',           envId: 'school-1',   base: 50, warnThreshold: 70, critThreshold: 85, intervalMs: 1000, active: true },
    { id: 'lab',  name: 'Lab de Ciências',    envId: 'school-1',   base: 70, warnThreshold: 70, critThreshold: 85, intervalMs: 1000, active: true },
    { id: 'bib',  name: 'Biblioteca',         envId: 'school-1',   base: 40, warnThreshold: 60, critThreshold: 75, intervalMs: 1000, active: true },
    { id: 'ref',  name: 'Refeitório',         envId: 'school-1',   base: 78, warnThreshold: 75, critThreshold: 90, intervalMs: 1000, active: true },
    { id: 'l1',   name: 'Linha de Produção 1', envId: 'indust-1',  base: 84, warnThreshold: 80, critThreshold: 90, intervalMs: 1000, active: true },
    { id: 'l2',   name: 'Linha de Produção 2', envId: 'indust-1',  base: 88, warnThreshold: 80, critThreshold: 90, intervalMs: 1000, active: true },
    { id: 'comp', name: 'Compressores',        envId: 'indust-1',  base: 95, warnThreshold: 85, critThreshold: 95, intervalMs: 1000, active: true },
    { id: 'exp',  name: 'Expedição',           envId: 'indust-1',  base: 76, warnThreshold: 80, critThreshold: 90, intervalMs: 1000, active: true },
    { id: 'alm',  name: 'Almoxarifado',        envId: 'indust-1',  base: 62, warnThreshold: 80, critThreshold: 90, intervalMs: 1000, active: true },
    { id: 'os',   name: 'Open Space',          envId: 'office-1',  base: 63, warnThreshold: 65, critThreshold: 80, intervalMs: 1000, active: true },
    { id: 'sr',   name: 'Sala de Reunião',     envId: 'office-1',  base: 58, warnThreshold: 65, critThreshold: 80, intervalMs: 1000, active: true },
    { id: 'copa', name: 'Copa',                envId: 'office-1',  base: 64, warnThreshold: 65, critThreshold: 80, intervalMs: 1000, active: true },
    { id: 'rec',  name: 'Recepção',            envId: 'hospital-1', base: 58, warnThreshold: 55, critThreshold: 70, intervalMs: 1000, active: true },
    { id: 'uti',  name: 'UTI',                 envId: 'hospital-1', base: 45, warnThreshold: 50, critThreshold: 60, intervalMs: 1000, active: true },
    { id: 'enfa', name: 'Enfermaria A',        envId: 'hospital-1', base: 52, warnThreshold: 55, critThreshold: 70, intervalMs: 1000, active: true },
    { id: 'enfb', name: 'Enfermaria B',        envId: 'hospital-1', base: 54, warnThreshold: 55, critThreshold: 70, intervalMs: 1000, active: true },
    { id: 'cc',   name: 'Centro Cirúrgico',    envId: 'hospital-1', base: 48, warnThreshold: 50, critThreshold: 65, intervalMs: 1000, active: true },
    { id: 'href', name: 'Refeitório',          envId: 'hospital-1', base: 61, warnThreshold: 65, critThreshold: 80, intervalMs: 1000, active: true },
  ],
};

let data = null;

function load() {
  if (data) return data;
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    data = JSON.parse(JSON.stringify(SEED));
  }
  migrate();
  return data;
}

// Garante a estrutura nova em arquivos antigos (sem organizations/orgId).
function migrate() {
  let changed = false;
  if (!Array.isArray(data.organizations)) { data.organizations = []; changed = true; }
  if (data.organizations.length === 0) {
    data.organizations.push({ id: 'org-default', name: 'Organização Padrão', active: true });
    changed = true;
  }
  const defaultOrg = data.organizations[0].id;
  for (const env of data.environments) {
    if (!env.orgId) { env.orgId = defaultOrg; changed = true; }
  }
  if (changed) save();
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ── Helpers de id ──────────────────────────────────────────────
function slugify(s) {
  const from = 'àáâãäçèéêëìíîïñòóôõöùúûüý';
  const to   = 'aaaaaceeeeiiiinooooouuuuy';
  let str = (s || '').toString().normalize('NFC').toLowerCase();
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

function getRegistry() {
  return load();
}

// ── Contagens ──────────────────────────────────────────────────
function countEnvironments(orgId) {
  return load().environments.filter(e => e.orgId === orgId).length;
}

function countDevicesByEnv(envId) {
  return load().devices.filter(d => d.envId === envId).length;
}

function countDevicesByOrg(orgId) {
  const envIds = new Set(load().environments.filter(e => e.orgId === orgId).map(e => e.id));
  return data.devices.filter(d => envIds.has(d.envId)).length;
}

// ── Organizações ───────────────────────────────────────────────
function getOrganization(id) {
  return load().organizations.find(o => o.id === id) ?? null;
}

function organizationExists(id) {
  return load().organizations.some(o => o.id === id);
}

function addOrganization({ name, active }) {
  load();
  const id = uniqueId(`org-${slugify(name)}`, data.organizations.map(o => o.id));
  const rec = { id, name, active: active !== false };
  data.organizations.push(rec);
  save();
  return rec;
}

function updateOrganization(id, patch) {
  load();
  const o = data.organizations.find(x => x.id === id);
  if (!o) return null;
  if (patch.name != null) o.name = patch.name;
  if ('active' in patch) o.active = !!patch.active;
  save();
  return o;
}

function deleteOrganization(id) {
  load();
  const idx = data.organizations.findIndex(o => o.id === id);
  if (idx === -1) return { ok: false, code: 404 };
  if (countEnvironments(id) > 0) return { ok: false, code: 409 };
  data.organizations.splice(idx, 1);
  save();
  return { ok: true };
}

// ── Ambientes ──────────────────────────────────────────────────
function getEnvironment(id) {
  return load().environments.find(e => e.id === id) ?? null;
}

function environmentExists(id) {
  return load().environments.some(e => e.id === id);
}

function addEnvironment({ name, type, icon, orgId }) {
  load();
  const id = uniqueId(slugify(name), data.environments.map(e => e.id));
  const rec = { id, name, type, icon: icon || TYPE_ICON[type] || '📍', orgId };
  data.environments.push(rec);
  save();
  return rec;
}

function updateEnvironment(id, patch) {
  load();
  const e = data.environments.find(x => x.id === id);
  if (!e) return null;
  for (const k of ['name', 'type', 'icon', 'orgId']) {
    if (k in patch && patch[k] != null) e[k] = patch[k];
  }
  save();
  return e;
}

function deleteEnvironment(id) {
  load();
  const idx = data.environments.findIndex(e => e.id === id);
  if (idx === -1) return { ok: false, code: 404 };
  if (countDevicesByEnv(id) > 0) return { ok: false, code: 409 };
  data.environments.splice(idx, 1);
  save();
  return { ok: true };
}

// ── Dispositivos ───────────────────────────────────────────────
function getDevice(id) {
  return load().devices.find(d => d.id === id) ?? null;
}

function addDevice(device) {
  load();
  data.devices.push(device);
  save();
  return device;
}

function updateDevice(id, patch) {
  load();
  const device = data.devices.find(d => d.id === id);
  if (!device) return null;
  Object.assign(device, patch, { id });
  save();
  return device;
}

function deleteDevice(id) {
  load();
  const idx = data.devices.findIndex(d => d.id === id);
  if (idx === -1) return false;
  data.devices.splice(idx, 1);
  save();
  return true;
}

module.exports = {
  TYPE_ICON,
  getRegistry,
  countEnvironments, countDevicesByEnv, countDevicesByOrg,
  getOrganization, organizationExists, addOrganization, updateOrganization, deleteOrganization,
  getEnvironment, environmentExists, addEnvironment, updateEnvironment, deleteEnvironment,
  getDevice, addDevice, updateDevice, deleteDevice,
};
