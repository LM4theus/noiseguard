const MAX_POINTS = 60;
const Y_MAX = 120;
const PAD = { top: 16, right: 16, bottom: 36, left: 42 };
const THRESHOLDS = [94, 110];

let canvas = null;
let ctx = null;
let points = [];
let observer = null;

export function initChart(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');

  observer = new ResizeObserver(() => {
    resize();
    draw();
  });
  observer.observe(canvas.parentElement);
  resize();
}

export function pushPoint(point) {
  points.push(point);
  if (points.length > MAX_POINTS) points.shift();
  draw();
}

export function loadHistory(historyPoints) {
  points = historyPoints.slice(-MAX_POINTS);
  draw();
}

// ── internals ─────────────────────────────────────────────────

function resize() {
  const parent = canvas.parentElement;
  const cs = getComputedStyle(parent);
  const pw = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const ph = parseFloat(cs.paddingTop)  + parseFloat(cs.paddingBottom);
  const w = parent.clientWidth  - pw;
  const h = parent.clientHeight - ph;
  if (w > 0 && h > 0) {
    canvas.width  = Math.floor(w);
    canvas.height = Math.floor(h);
  }
}

function yPos(db, ch) {
  return ch - (db / Y_MAX) * ch;
}

function xPos(i, count, cw) {
  if (count <= 1) return cw;
  return (i / (count - 1)) * cw;
}

function draw() {
  if (!ctx || canvas.width === 0 || canvas.height === 0) return;

  const W  = canvas.width;
  const H  = canvas.height;
  const px = PAD.left;
  const py = PAD.top;
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  drawBands(px, py, cw, ch);
  drawGrid(px, py, cw, ch);
  drawAxes(px, py, cw, ch);

  if (points.length >= 2) {
    drawArea(px, py, cw, ch);
    drawLine(px, py, cw, ch);
  }
}

function drawBands(px, py, cw, ch) {
  const y94    = py + yPos(94, ch);
  const y110   = py + yPos(110, ch);
  const yBot   = py + ch;

  ctx.fillStyle = 'rgba(39, 174, 96, 0.05)';
  ctx.fillRect(px, y94, cw, yBot - y94);

  ctx.fillStyle = 'rgba(241, 196, 15, 0.05)';
  ctx.fillRect(px, y110, cw, y94 - y110);

  ctx.fillStyle = 'rgba(231, 76, 60, 0.05)';
  ctx.fillRect(px, py, cw, y110 - py);
}

function drawGrid(px, py, cw, ch) {
  ctx.save();
  ctx.strokeStyle = 'rgba(127, 140, 154, 0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);

  for (const t of THRESHOLDS) {
    const y = py + yPos(t, ch);
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + cw, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAxes(px, py, cw, ch) {
  ctx.save();
  ctx.fillStyle = '#7F8C9A';
  ctx.font = `10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

  // Y labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const val of [0, 94, 110, 120]) {
    ctx.fillText(`${val}`, px - 6, py + yPos(val, ch));
  }

  // X labels — 5 evenly spaced
  if (points.length > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const n = points.length;
    const indices = n <= 5
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];

    for (const idx of indices) {
      const pt = points[idx];
      if (!pt) continue;
      const x = px + xPos(idx, n, cw);
      const y = py + ch + 6;
      const d = new Date(pt.timestamp);
      const label =
        `${String(d.getHours()).padStart(2,'0')}:` +
        `${String(d.getMinutes()).padStart(2,'0')}:` +
        `${String(d.getSeconds()).padStart(2,'0')}`;
      ctx.fillText(label, x, y);
    }
  }

  ctx.restore();
}

function drawArea(px, py, cw, ch) {
  const n = points.length;
  const grad = ctx.createLinearGradient(0, py, 0, py + ch);
  grad.addColorStop(0,   'rgba(245, 166, 35, 0.30)');
  grad.addColorStop(1,   'rgba(245, 166, 35, 0)');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(px + xPos(0, n, cw), py + ch);

  for (let i = 0; i < n; i++) {
    ctx.lineTo(px + xPos(i, n, cw), py + yPos(points[i].db, ch));
  }

  ctx.lineTo(px + xPos(n - 1, n, cw), py + ch);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLine(px, py, cw, ch) {
  const n = points.length;
  ctx.save();
  ctx.strokeStyle = '#F5A623';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  for (let i = 0; i < n; i++) {
    const x = px + xPos(i, n, cw);
    const y = py + yPos(points[i].db, ch);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.restore();
}
