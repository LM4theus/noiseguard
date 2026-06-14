// Acesso ao registro de ambientes/dispositivos servido pelo backend
// (fonte única de verdade — ver back/server/registry.js).
// As leituras de dB recebem uma simulação leve (random-walk) para a
// interface parecer "viva"; a tela de Dispositivo também usa o feed real.

const BASE = 'http://localhost:3000';

let organizations = []; // [{ id, name, active }]
let environments  = [];  // [{ id, name, type, icon, orgId, devices: [...] }]
let deviceList    = [];   // lista plana de dispositivos

// Carrega (ou recarrega) o registro do backend e monta a árvore.
export async function loadRegistry() {
  const res = await fetch(`${BASE}/api/registry`);
  const reg = await res.json();

  organizations = reg.organizations ?? [];
  deviceList = reg.devices;
  environments = reg.environments.map(env => ({
    ...env,
    devices: deviceList.filter(d => d.envId === env.id && d.active !== false),
  }));

  return environments;
}

export function getOrganizations() {
  return organizations;
}

export function getOrganization(id) {
  return organizations.find(o => o.id === id) ?? null;
}

export function getEnvironments() {
  return environments;
}

export function getEnvironmentsByOrg(orgId) {
  return environments.filter(e => e.orgId === orgId);
}

export function getEnvironment(id) {
  return environments.find(e => e.id === id) ?? null;
}

// Todos os dispositivos (ativos) de uma organização.
function orgDevices(org) {
  return getEnvironmentsByOrg(org.id).flatMap(e => e.devices);
}

export function orgDeviceCount(org) {
  return orgDevices(org).length;
}

export function orgEnvCount(org) {
  return getEnvironmentsByOrg(org.id).length;
}

export function orgAvg(org) {
  const devices = orgDevices(org);
  if (devices.length === 0) return 0;
  return devices.reduce((acc, d) => acc + deviceDb(d), 0) / devices.length;
}

export function findDevice(deviceId) {
  for (const env of environments) {
    const device = env.devices.find(d => d.id === deviceId);
    if (device) return { env, device };
  }
  return null;
}

const TYPE_LABEL = {
  school:     'Escola',
  industrial: 'Industrial',
  office:     'Escritório',
  hospital:   'Hospital',
};

export function typeLabel(type) {
  return TYPE_LABEL[type] ?? type;
}

// ── Simulação de leitura (random-walk em torno do `base`) ──────────
const liveDb = new Map();

function tick(device) {
  const prev = liveDb.has(device.id) ? liveDb.get(device.id) : device.base;
  const next = prev + (Math.random() - 0.5) * 3;
  const clamped = Math.max(device.base - 6, Math.min(device.base + 6, next));
  const bounded = Math.max(0, Math.min(120, clamped));
  liveDb.set(device.id, bounded);
  return bounded;
}

export function deviceDb(device) {
  return liveDb.has(device.id) ? liveDb.get(device.id) : device.base;
}

export function simulateStep() {
  for (const env of environments) {
    for (const d of env.devices) tick(d);
  }
}

export function environmentAvg(env) {
  if (env.devices.length === 0) return 0;
  const sum = env.devices.reduce((acc, d) => acc + deviceDb(d), 0);
  return sum / env.devices.length;
}

// Faixas de cor conforme a legenda do protótipo:
// 0–69 Seguro · 70–84 Moderado · 85+ Crítico
export function band(db) {
  if (db >= 85) return 'crit';
  if (db >= 70) return 'warn';
  return 'ok';
}

export const BAND_LABEL = {
  ok:   'Seguro',
  warn: 'Moderado',
  crit: 'Crítico',
};
