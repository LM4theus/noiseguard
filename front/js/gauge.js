// Arc: 270° from 135° to 405° (=45°) clockwise. r=85, center=(100,100)
// Total arc length = 0.75 * 2π * 85 ≈ 400.55
const TOTAL_ARC = 0.75 * 2 * Math.PI * 85;

const arcEl  = document.getElementById('gauge-arc');
const valueEl = document.getElementById('gauge-value');

const COLORS = {
  OK:      '#27AE60',
  ATENCAO: '#F1C40F',
  CRITICO: '#E74C3C',
};

export function updateGauge(db, level) {
  const fraction = Math.min(1, Math.max(0, db / 120));
  const dashLen = fraction * TOTAL_ARC;

  arcEl.setAttribute('stroke-dasharray', `${dashLen.toFixed(2)} 999`);
  arcEl.setAttribute('stroke', COLORS[level] ?? COLORS.OK);

  valueEl.textContent = Math.round(db);

  if (level === 'CRITICO') {
    arcEl.classList.add('pulse');
  } else {
    arcEl.classList.remove('pulse');
  }
}
