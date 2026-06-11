const EventEmitter = require('events');

const CAPACITY = 120; // pontos retidos por dispositivo (sem persistência)

const emitter = new EventEmitter();

// deviceId -> buffer circular { buf, head, size }
const buffers = new Map();

function bufferFor(deviceId) {
  let b = buffers.get(deviceId);
  if (!b) {
    b = { buf: [], head: 0, size: 0 };
    buffers.set(deviceId, b);
  }
  return b;
}

function add(deviceId, point) {
  const b = bufferFor(deviceId);
  b.buf[b.head] = point;
  b.head = (b.head + 1) % CAPACITY;
  if (b.size < CAPACITY) b.size++;
  emitter.emit('data', { deviceId, point });
}

function getAll(deviceId) {
  const b = buffers.get(deviceId);
  if (!b || b.size === 0) return [];
  if (b.size < CAPACITY) return b.buf.slice(0, b.size);
  return [...b.buf.slice(b.head), ...b.buf.slice(0, b.head)];
}

function getLast(deviceId) {
  const b = buffers.get(deviceId);
  if (!b || b.size === 0) return null;
  return b.buf[(b.head - 1 + CAPACITY) % CAPACITY];
}

function getStats(deviceId) {
  const all = getAll(deviceId);
  if (all.length === 0) return { avg: 0, peak: 0, current: 0 };
  const values = all.map(p => p.db);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const peak = Math.max(...values);
  const current = values[values.length - 1];
  return { avg: +avg.toFixed(1), peak: +peak.toFixed(1), current: +current.toFixed(1) };
}

module.exports = { add, getAll, getLast, getStats, emitter };
