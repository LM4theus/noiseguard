// Acesso ao registro (organizações/ambientes/dispositivos) e às últimas
// leituras REAIS de cada dispositivo, ambos servidos pelo backend.
// (fonte única de verdade — ver back/server/registry.js e store.js).

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
  const vals = orgDevices(org).map(deviceDb).filter(v => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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

// ── Últimas leituras reais (por dispositivo) ───────────────────────
// { [deviceId]: { db, level, timestamp } } — vinda de /api/readings/latest.
let latest = {};

export async function refreshReadings() {
  latest = await fetch(`${BASE}/api/readings/latest`).then(r => r.json());
  return latest;
}

// dB real da última leitura, ou null se o dispositivo ainda não enviou nada.
export function deviceDb(device) {
  const r = latest[device.id];
  return r ? r.db : null;
}

// Média do ambiente considerando apenas dispositivos COM leitura real.
// Retorna null quando nenhum dispositivo tem dados.
export function environmentAvg(env) {
  const vals = env.devices.map(deviceDb).filter(v => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
