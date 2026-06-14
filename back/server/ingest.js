// Ingestão de uma leitura de ruído, compartilhada entre o endpoint HTTP
// (/api/noise) e o WebSocket (/ws). Valida o dB, resolve o dispositivo no
// registro, classifica com os limiares dele e grava no store por dispositivo.
const store = require('./store');
const reg = require('./registry');
const { classify } = require('./alerts');

// Leituras sem deviceId (firmware legado) caem neste dispositivo virtual.
const DEFAULT_DEVICE_ID = 'default';

function ingest({ deviceId, db, timestamp }) {
  if (typeof db !== 'number' || Number.isNaN(db) || db < 0 || db > 140) {
    return { ok: false, code: 400, error: 'db deve ser um número entre 0 e 140' };
  }

  let id = DEFAULT_DEVICE_ID;
  let thresholds; // undefined => usa limiares padrão em classify

  if (deviceId != null && deviceId !== '') {
    // O dispositivo envia o id como número (ex.: 10034); o registro guarda
    // ids como string, então normalizamos para a busca.
    const key = String(deviceId);
    const device = reg.getDevice(key);
    if (!device) {
      return { ok: false, code: 404, error: `deviceId "${key}" não registrado` };
    }
    id = device.id;
    thresholds = { warn: device.warnThreshold, crit: device.critThreshold };
  }

  // timestamp é o momento em que o dispositivo gerou a leitura — usa-se ele
  // quando válido; caso ausente/ inválido, cai para a hora do servidor.
  const ts = (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0)
    ? timestamp
    : Date.now();

  const level = classify(db, thresholds);
  const point = { db, timestamp: ts, level };
  store.add(id, point);

  return { ok: true, deviceId: id, point, level };
}

module.exports = { ingest, DEFAULT_DEVICE_ID };
