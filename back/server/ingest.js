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
    const device = reg.getDevice(deviceId);
    if (!device) {
      return { ok: false, code: 404, error: `deviceId "${deviceId}" não registrado` };
    }
    id = device.id;
    thresholds = { warn: device.warnThreshold, crit: device.critThreshold };
  }

  const level = classify(db, thresholds);
  const point = { db, timestamp: timestamp || Date.now(), level };
  store.add(id, point);

  return { ok: true, deviceId: id, point, level };
}

module.exports = { ingest, DEFAULT_DEVICE_ID };
