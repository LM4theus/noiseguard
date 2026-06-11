// ATENÇÃO: este simulador foi substituído pela captura de microfone no frontend.
// Para usar o microfone: npm start → abrir http://localhost:3000 → clicar em 🎤 Microfone
// Este arquivo pode ser usado como fallback com: node server/simulator.js
// Para simular um dispositivo específico: DEVICE_ID=s101 node server/simulator.js

const http = require('http');

const DEVICE_ID = process.env.DEVICE_ID || null;

const BASE_DB = 55;
const NOISE_RANGE = 10;
const SPIKE_PROB = 0.05;
const SPIKE_MAX = 85;
const INTERVAL_MS = 750;

function randomNormal() {
  // Box-Muller transform for gaussian noise
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function nextDb() {
  if (Math.random() < SPIKE_PROB) {
    return +(Math.random() * (SPIKE_MAX - 70) + 70).toFixed(1);
  }
  const value = BASE_DB + randomNormal() * (NOISE_RANGE / 2);
  return +Math.min(Math.max(value, 30), 69).toFixed(1);
}

function postReading(db) {
  const body = JSON.stringify(DEVICE_ID ? { deviceId: DEVICE_ID, db } : { db });
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: '/api/noise',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = http.request(options, (res) => {
    res.resume();
  });
  req.on('error', (err) => {
    console.error('Simulator error:', err.message);
  });
  req.write(body);
  req.end();
}

console.log(`NoiseGuard Simulator started — sending readings every ${INTERVAL_MS}ms`);
console.log(DEVICE_ID ? `Device: ${DEVICE_ID}` : 'Device: (default — sem deviceId)');
console.log('Press Ctrl+C to stop.\n');

setInterval(() => {
  const db = nextDb();
  process.stdout.write(`\r  dB: ${db.toFixed(1).padStart(5)}   `);
  postReading(db);
}, INTERVAL_MS);
