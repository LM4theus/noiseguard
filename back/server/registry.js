// Registro persistente de ambientes e dispositivos.
// É a fonte única de verdade consumida pela interface (lista de ambientes,
// planta baixa, monitor e tela de gestão). Persiste em data/registry.json.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'registry.json');

// Valores iniciais (mesmos dispositivos do protótipo) usados na primeira
// execução, quando ainda não existe o arquivo de persistência.
const SEED = {
  environments: [
    { id: 'school-1',   name: 'Escola Central',        type: 'school',     icon: '🏫' },
    { id: 'indust-1',   name: 'Galpão Industrial A',   type: 'industrial', icon: '🏭' },
    { id: 'office-1',   name: 'Escritório Open Space', type: 'office',     icon: '🏢' },
    { id: 'hospital-1', name: 'Hospital Geral',        type: 'hospital',   icon: '🏥' },
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
    save();
  }
  return data;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getRegistry() {
  return load();
}

function getDevice(id) {
  return load().devices.find(d => d.id === id) ?? null;
}

function environmentExists(envId) {
  return load().environments.some(e => e.id === envId);
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
  Object.assign(device, patch, { id }); // id não muda via update
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
  getRegistry, getDevice, environmentExists,
  addDevice, updateDevice, deleteDevice,
};
