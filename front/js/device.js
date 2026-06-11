import { connect, fetchHistory } from './api.js';
import { updateGauge }          from './gauge.js';
import { initChart, pushPoint, loadHistory } from './chart.js';
import { startMicrophone, stopMicrophone, isMicActive } from './microphone.js';
import { loadRegistry, findDevice } from './data.js';
import './theme.js';

const MAX_EVENTS = 10;

let statsBuffer  = [];
let events       = [];
let lastLevel    = null;
let lastTimestamp = null;
let audioCtx     = null;

// ── Identifica o dispositivo pela query (?id=) ─────────────────
const deviceId    = new URLSearchParams(location.search).get('id');
const backLink    = document.getElementById('back-link');
const deviceTitle = document.getElementById('device-title');

async function identifyDevice() {
  try {
    await loadRegistry();
    const found = findDevice(deviceId);
    if (found) {
      document.title = `NoiseGuard — ${found.device.name}`;
      deviceTitle.textContent = found.device.name;
      backLink.textContent = `← ${found.env.name}`;
      backLink.href = `environment.html?id=${found.env.id}`;
      return;
    }
  } catch (_) { /* mantém título genérico se o registro não carregar */ }
  deviceTitle.textContent = 'Dispositivo';
}

// ── DOM refs ───────────────────────────────────────────────────
const connDot     = document.getElementById('conn-dot');
const connText    = document.getElementById('conn-text');
const alertToggle = document.getElementById('alert-toggle');
const btnMic      = document.getElementById('btn-mic');
const statCurrent = document.getElementById('stat-current');
const statAvg     = document.getElementById('stat-avg');
const statPeak    = document.getElementById('stat-peak');
const badge       = document.getElementById('status-badge');
const badgeIcon   = document.getElementById('badge-icon');
const badgeText   = document.getElementById('badge-text');
const eventsBody  = document.getElementById('events-tbody');

// ── Sound toggle ───────────────────────────────────────────────
let soundEnabled = localStorage.getItem('alertSound') !== 'false';
renderAlertToggle();

alertToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('alertSound', String(soundEnabled));
  renderAlertToggle();
});

function renderAlertToggle() {
  alertToggle.textContent = soundEnabled ? '🔔 Alerta ON' : '🔕 Alerta OFF';
  alertToggle.classList.toggle('off', !soundEnabled);
}

// ── Microphone toggle ──────────────────────────────────────────
function renderMicBtn(state) {
  btnMic.className = `mic-btn${state === 'on' ? ' on' : state === 'error' ? ' error' : ''}`;
  btnMic.textContent =
    state === 'on'    ? '🎤 Microfone ON'   :
    state === 'error' ? '🎤 Sem permissão'  :
                        '🎤 Microfone OFF';
}

btnMic.addEventListener('click', async () => {
  if (isMicActive()) {
    stopMicrophone();
    renderMicBtn('off');
  } else {
    await startMicrophone({
      onPermissionDenied: () => renderMicBtn('error'),
      deviceId,
    });
    if (isMicActive()) renderMicBtn('on');
  }
});

// ── Connection status ──────────────────────────────────────────
function setConnectionStatus(status) {
  const map = {
    connected:    { dot: 'green',  text: 'CONECTADO' },
    disconnected: { dot: 'red',    text: 'DESCONECTADO' },
    reconnecting: { dot: 'yellow', text: 'RECONECTANDO...' },
    connecting:   { dot: 'yellow', text: 'CONECTANDO...' },
  };
  const s = map[status] ?? map.connecting;
  connDot.className = `conn-dot ${s.dot}`;
  connText.textContent = s.text;
}

// ── Badge ──────────────────────────────────────────────────────
const BADGE_STATES = {
  OK:      { icon: '✅', text: 'AMBIENTE OK',  cls: 'ok' },
  ATENCAO: { icon: '⚠️',  text: 'ATENÇÃO',      cls: 'warn' },
  CRITICO: { icon: '🚨', text: 'NÍVEL CRÍTICO', cls: 'crit' },
};

function setBadge(level) {
  const s = BADGE_STATES[level] ?? BADGE_STATES.OK;
  badgeIcon.textContent = s.icon;
  badgeText.textContent = s.text;
  badge.className = `badge ${s.cls}`;
}

// ── Stats ──────────────────────────────────────────────────────
function addStat(db) {
  statsBuffer.push(db);
  if (statsBuffer.length > 60) statsBuffer.shift();
  renderStats();
}

function renderStats() {
  if (statsBuffer.length === 0) return;
  const current = statsBuffer[statsBuffer.length - 1];
  const avg  = statsBuffer.reduce((a, b) => a + b, 0) / statsBuffer.length;
  const peak = Math.max(...statsBuffer);
  animateValue(statCurrent, current.toFixed(1));
  animateValue(statAvg,     avg.toFixed(1));
  animateValue(statPeak,    peak.toFixed(1));
}

function animateValue(el, val) {
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = val;
    el.style.opacity = '1';
  }, 100);
}

// ── Events table ───────────────────────────────────────────────
function checkThreshold(point) {
  const { level } = point;
  if (level !== 'OK' && level !== lastLevel) {
    events.unshift(point);
    if (events.length > MAX_EVENTS) events.pop();
    renderEvents();
  }
  lastLevel = level;
}

function renderEvents() {
  if (events.length === 0) {
    eventsBody.innerHTML = '<tr class="events-empty"><td colspan="3">Nenhum evento registrado</td></tr>';
    return;
  }

  eventsBody.innerHTML = '';

  events.forEach((evt, idx) => {
    const d = new Date(evt.timestamp);
    const time =
      `${String(d.getHours()).padStart(2,'0')}:` +
      `${String(d.getMinutes()).padStart(2,'0')}:` +
      `${String(d.getSeconds()).padStart(2,'0')}`;
    const levelLabel = evt.level === 'ATENCAO' ? '⚠️ ATENÇÃO' : '🚨 CRÍTICO';
    const cls = evt.level.toLowerCase();

    const tr = document.createElement('tr');
    tr.className = `event-row ${cls}${idx === 0 ? ' new' : ''}`;
    tr.innerHTML =
      `<td>${time}</td>` +
      `<td>${evt.db.toFixed(1)}</td>` +
      `<td>${levelLabel}</td>`;
    eventsBody.appendChild(tr);
  });
}

// ── Sound alert ────────────────────────────────────────────────
function playBeep() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (_) {}
}

// ── Point handler ──────────────────────────────────────────────
function onPoint(point) {
  // Deduplicate polling-mode repeats
  if (point.timestamp === lastTimestamp) return;
  lastTimestamp = point.timestamp;

  const { db, level } = point;
  updateGauge(db, level);
  setBadge(level);
  addStat(db);
  pushPoint(point);
  checkThreshold(point);

  if (level === 'CRITICO') playBeep();
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  identifyDevice();
  initChart(document.getElementById('noise-chart'));
  connect(onPoint, setConnectionStatus, deviceId);

  try {
    const history = await fetchHistory(deviceId);
    if (history.length > 0) {
      loadHistory(history);
      statsBuffer = history.slice(-60).map(p => p.db);
      renderStats();
      const last = history[history.length - 1];
      updateGauge(last.db, last.level);
      setBadge(last.level);
      lastLevel     = last.level;
      lastTimestamp = last.timestamp;
    }
  } catch (_) {}
});
