// Tela 2 — Detalhe do ambiente (planta baixa).
import {
  loadRegistry, refreshReadings, getEnvironment, getOrganization, typeLabel,
  deviceDb, band,
} from './data.js';

const params = new URLSearchParams(location.search);
const envId  = params.get('id');

const titleEl  = document.getElementById('env-title');
const typeEl   = document.getElementById('env-type');
const grid     = document.getElementById('floor-grid');
const backLink = document.getElementById('back-link');

let env = null;

(async () => {
  try {
    await loadRegistry();
  } catch (_) {
    titleEl.textContent = 'Erro de conexão';
    typeEl.textContent  = '';
    grid.innerHTML = '<p class="empty-msg">Não foi possível carregar os dados. Verifique se o servidor está ativo.</p>';
    return;
  }

  env = getEnvironment(envId);
  if (!env) {
    titleEl.textContent = 'Ambiente não encontrado';
    typeEl.textContent  = '';
    grid.innerHTML = '<p class="empty-msg">Esse ambiente não existe. <a href="index.html">Voltar</a>.</p>';
    return;
  }

  document.title = `NoiseGuard — ${env.name}`;
  titleEl.textContent = `${env.icon} ${env.name}`;
  typeEl.textContent  = `Tipo: ${typeLabel(env.type)}`;

  // Volta para a lista de ambientes da organização deste ambiente.
  const org = getOrganization(env.orgId);
  if (org) {
    backLink.textContent = `← ${org.name}`;
    backLink.href = `organization.html?id=${org.id}`;
  }

  await refreshReadings();
  render();
  setInterval(async () => { await refreshReadings(); render(); }, 2000);
})();

function render() {
  grid.innerHTML = '';

  for (const device of env.devices) {
    const db = deviceDb(device);
    const hasData = db != null;
    const cls = hasData ? band(db) : 'nd';

    const a = document.createElement('a');
    a.className = `floor-card ${cls}`;
    a.href = `device.html?id=${device.id}`;
    a.innerHTML = `
      <div class="floor-name">${device.name}</div>
      <div class="floor-db"><span>${hasData ? Math.round(db) : '—'}</span><small>dB</small></div>
      <span class="band-dot ${cls}"></span>
    `;
    grid.appendChild(a);
  }
}
