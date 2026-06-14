// Leituras (série temporal) persistidas no Postgres + emitter para o tempo real.
const EventEmitter = require('events');
const pool = require('./db/pool');

const CAPACITY = 120; // pontos retornados no histórico por dispositivo

const emitter = new EventEmitter();

async function add(deviceId, point) {
  await pool.query(
    'INSERT INTO readings(device_id, db, level, ts) VALUES ($1,$2,$3,$4)',
    [deviceId, point.db, point.level, point.timestamp],
  );
  emitter.emit('data', { deviceId, point });
}

// Histórico de um dispositivo, em ordem cronológica (mais antigo → mais novo).
async function getAll(deviceId) {
  const { rows } = await pool.query(
    'SELECT db, level, ts FROM readings WHERE device_id=$1 ORDER BY ts DESC LIMIT $2',
    [deviceId, CAPACITY],
  );
  return rows
    .map(r => ({ db: r.db, timestamp: Number(r.ts), level: r.level }))
    .reverse();
}

// Última leitura de cada dispositivo: { [deviceId]: { db, level, timestamp } }.
async function getLatestAll() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (device_id) device_id, db, level, ts
    FROM readings
    ORDER BY device_id, ts DESC
  `);
  const map = {};
  for (const r of rows) {
    map[r.device_id] = { db: r.db, level: r.level, timestamp: Number(r.ts) };
  }
  return map;
}

module.exports = { add, getAll, getLatestAll, emitter };
