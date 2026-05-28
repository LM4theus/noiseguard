const EventEmitter = require('events');

const CAPACITY = 120;

const emitter = new EventEmitter();
const buffer = [];
let head = 0;
let size = 0;

function add(point) {
  if (size < CAPACITY) {
    buffer[head] = point;
    head = (head + 1) % CAPACITY;
    size++;
  } else {
    buffer[head] = point;
    head = (head + 1) % CAPACITY;
  }
  emitter.emit('data', point);
}

function getAll() {
  if (size < CAPACITY) return buffer.slice(0, size);
  const tail = head;
  return [...buffer.slice(tail), ...buffer.slice(0, tail)];
}

function getLast() {
  if (size === 0) return null;
  return buffer[(head - 1 + CAPACITY) % CAPACITY];
}

function getStats() {
  const all = getAll();
  if (all.length === 0) return { avg: 0, peak: 0, current: 0 };
  const values = all.map(p => p.db);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const peak = Math.max(...values);
  const current = values[values.length - 1];
  return { avg: +avg.toFixed(1), peak: +peak.toFixed(1), current: +current.toFixed(1) };
}

module.exports = { add, getAll, getLast, getStats, emitter };
