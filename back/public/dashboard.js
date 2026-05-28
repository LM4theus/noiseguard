/* ── Constants ── */
const MAX_DB = 120;
const THRESHOLD_OK = 50;
const THRESHOLD_ATENCAO = 70;
const MAX_HISTORY_POINTS = 120;
const GAUGE_START_DEG = 210;
const GAUGE_END_DEG = 330; // total sweep = 300°

/* ── State ── */
const events = [];
let sseOk = false;
let audioCtx = null;

/* ── DOM refs ── */
const connDot   = document.getElementById('conn-dot');
const connLabel = document.getElementById('conn-label');
const gaugeDb   = document.getElementById('gauge-db');
const gaugeFill = document.getElementById('gauge-fill');
const gaugeBg   = document.getElementById('gauge-bg');
const statusBadge   = document.getElementById('status-badge');
const statCurrent   = document.getElementById('stat-current');
const statAvg       = document.getElementById('stat-avg');
const statPeak      = document.getElementById('stat-peak');
const eventsBody    = document.getElementById('events-body');
const soundToggle   = document.getElementById('sound-toggle');

/* ── Gauge SVG arc math ── */
const SVG_W = 180, SVG_H = 110, CX = 90, CY = 95, R = 72;

function polarToCart(angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
}

function arcPath(startDeg, endDeg) {
  const [sx, sy] = polarToCart(startDeg);
  const [ex, ey] = polarToCart(endDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
}

const FULL_SWEEP = GAUGE_END_DEG - GAUGE_START_DEG + 360; // 300°
// Total arc length for R=72, 300° sweep
const ARC_LEN = 2 * Math.PI * R * (300 / 360);

gaugeBg.setAttribute('d', arcPath(GAUGE_START_DEG, GAUGE_START_DEG + 300));
gaugeBg.style.strokeDasharray = ARC_LEN;
gaugeBg.style.strokeDashoffset = 0;

gaugeFill.setAttribute('d', arcPath(GAUGE_START_DEG, GAUGE_START_DEG + 300));
gaugeFill.style.strokeDasharray = ARC_LEN;
gaugeFill.style.strokeDashoffset = ARC_LEN; // start empty

function updateGauge(db) {
  const frac = Math.min(Math.max(db / MAX_DB, 0), 1);
  const offset = ARC_LEN * (1 - frac);
  gaugeFill.style.strokeDashoffset = offset;

  const color = db < THRESHOLD_OK ? '#2ECC71'
              : db <= THRESHOLD_ATENCAO ? '#F1C40F'
              : '#E74C3C';
  gaugeFill.style.stroke = color;
}

/* ── Chart.js setup ── */
const ctx = document.getElementById('history-chart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'dB',
        data: [],
        borderColor: '#F5A623',
        backgroundColor: 'rgba(245,166,35,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Limiar ATENÇÃO',
        data: [],
        borderColor: '#F1C40F',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Limiar CRÍTICO',
        data: [],
        borderColor: '#E74C3C',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { labels: { color: '#8EA5BC', boxWidth: 14 } } },
    scales: {
      x: {
        ticks: { color: '#8EA5BC', maxTicksLimit: 8, maxRotation: 0 },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
      y: {
        min: 0,
        max: MAX_DB,
        ticks: { color: '#8EA5BC' },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  },
});

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateChart(history) {
  const labels = history.map(p => formatTime(p.timestamp));
  const values = history.map(p => p.db);
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.data.datasets[1].data = values.map(() => THRESHOLD_OK);
  chart.data.datasets[2].data = values.map(() => THRESHOLD_ATENCAO);
  chart.update('none');
}

/* ── UI update ── */
function applyPoint(point) {
  const { db, timestamp, level } = point;

  gaugeDb.textContent = db.toFixed(1);
  updateGauge(db);

  statusBadge.textContent = level === 'ATENCAO' ? 'ATENÇÃO' : level;
  statusBadge.className = level;

  if (level === 'CRITICO' && soundToggle.checked) {
    playBeep();
  }

  // Events table: only non-OK
  if (level !== 'OK') {
    events.unshift({ db, timestamp, level });
    if (events.length > 10) events.pop();
    renderEvents();
  }
}

function renderEvents() {
  if (events.length === 0) {
    eventsBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center">Sem eventos ainda</td></tr>';
    return;
  }
  eventsBody.innerHTML = events.map(e => {
    const cls = e.level === 'ATENCAO' ? 'level-atencao' : 'level-critico';
    const label = e.level === 'ATENCAO' ? 'ATENÇÃO' : 'CRÍTICO';
    return `<tr>
      <td>${formatTime(e.timestamp)}</td>
      <td>${e.db.toFixed(1)}</td>
      <td class="${cls}">${label}</td>
    </tr>`;
  }).join('');
}

function updateStats(stats) {
  statCurrent.textContent = stats.current.toFixed(1);
  statAvg.textContent     = stats.avg.toFixed(1);
  statPeak.textContent    = stats.peak.toFixed(1);
}

/* ── Sound ── */
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (_) {}
}

/* ── Connection status ── */
function setConnected(ok) {
  connDot.className = 'conn-dot' + (ok ? '' : ' off');
  connLabel.textContent = ok ? 'Conectado' : 'Offline';
}

/* ── Load history on startup ── */
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const history = await res.json();
    if (history.length === 0) return;
    updateChart(history);
    const last = history[history.length - 1];
    applyPoint(last);
    // Compute stats locally from history
    const values = history.map(p => p.db);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const peak = Math.max(...values);
    updateStats({ current: last.db, avg, peak });
  } catch (_) {}
}

/* ── SSE ── */
let historyBuffer = [];

function startSSE() {
  const es = new EventSource('/events');

  es.onopen = () => { sseOk = true; setConnected(true); };
  es.onerror = () => {
    sseOk = false;
    setConnected(false);
    es.close();
    setTimeout(startSSE, 3000);
  };

  es.onmessage = (e) => {
    try {
      const point = JSON.parse(e.data);
      applyPoint(point);

      historyBuffer.push(point);
      if (historyBuffer.length > MAX_HISTORY_POINTS) historyBuffer.shift();
      updateChart(historyBuffer);

      const values = historyBuffer.map(p => p.db);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const peak = Math.max(...values);
      updateStats({ current: point.db, avg, peak });
    } catch (_) {}
  };
}

/* ── Polling fallback ── */
let pollTimer = null;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (sseOk) return;
    try {
      const res = await fetch('/api/history');
      const history = await res.json();
      if (history.length === 0) return;
      historyBuffer = history.slice(-MAX_HISTORY_POINTS);
      updateChart(historyBuffer);
      const last = history[history.length - 1];
      applyPoint(last);
      const values = historyBuffer.map(p => p.db);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const peak = Math.max(...values);
      updateStats({ current: last.db, avg, peak });
      setConnected(true);
    } catch (_) { setConnected(false); }
  }, 1000);
}

/* ── Boot ── */
loadHistory().then(() => {
  startSSE();
  startPolling();
});
