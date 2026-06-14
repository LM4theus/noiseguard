// Simulador de dispositivos — envia leituras REAIS ao servidor (POST /api/noise),
// que as grava no banco. Serve para popular as telas enquanto não há ESP32 físico.
//
// Uso:
//   SERVER_URL=http://localhost:3000 node server/simulator.js   (todos os dispositivos)
//   DEVICE_ID=s101 node server/simulator.js                     (um dispositivo só)
//
// No Docker: `docker compose --profile dev up` (SERVER_URL já aponta p/ o serviço server).

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ONLY_DEVICE = process.env.DEVICE_ID || null;
const INTERVAL_MS = Number(process.env.INTERVAL_MS) || 1000;

function randomNormal() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Estado do random-walk por dispositivo (em torno do `base` cadastrado).
const lastDb = new Map();

function nextDb(device) {
  const base = device.base ?? 55;
  const prev = lastDb.has(device.id) ? lastDb.get(device.id) : base;
  // Pequena chance de pico, senão passeio gaussiano em torno do base.
  let value;
  if (Math.random() < 0.04) {
    value = base + 15 + Math.random() * 15;
  } else {
    value = prev + randomNormal() * 2;
    value = Math.max(base - 8, Math.min(base + 8, value));
  }
  value = Math.max(0, Math.min(120, value));
  lastDb.set(device.id, value);
  return +value.toFixed(1);
}

async function fetchDevices() {
  try {
    const res = await fetch(`${SERVER_URL}/api/devices`);
    const all = await res.json();
    const active = all.filter(d => d.active !== false);
    return ONLY_DEVICE ? active.filter(d => d.id === ONLY_DEVICE) : active;
  } catch (err) {
    console.error('Não foi possível obter os dispositivos:', err.message);
    return [];
  }
}

async function postReading(device) {
  const body = JSON.stringify({ deviceid: device.id, db: nextDb(device), timestamp: Date.now() });
  try {
    await fetch(`${SERVER_URL}/api/noise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    console.error(`POST falhou (${device.id}):`, err.message);
  }
}

let devices = [];

async function tick() {
  if (devices.length === 0) return;
  await Promise.all(devices.map(postReading));
  process.stdout.write(`\r  ${new Date().toLocaleTimeString()} — ${devices.length} dispositivo(s) enviando…   `);
}

async function main() {
  console.log(`NoiseGuard Simulator → ${SERVER_URL} (intervalo ${INTERVAL_MS}ms)`);
  console.log(ONLY_DEVICE ? `Dispositivo: ${ONLY_DEVICE}` : 'Dispositivos: todos os cadastrados');

  devices = await fetchDevices();
  if (devices.length === 0) {
    console.log('Aguardando dispositivos no servidor…');
  }

  // Reobtém a lista periodicamente (pega novos cadastros).
  setInterval(async () => { devices = await fetchDevices(); }, 15000);
  setInterval(tick, INTERVAL_MS);
}

main();
