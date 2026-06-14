// Detalhe de uma organização: seus ambientes monitorados (escopado por ?id=).
import {
  loadRegistry, getOrganization, getEnvironmentsByOrg, typeLabel,
  environmentAvg, band, simulateStep,
} from './data.js';

const grid    = document.getElementById('env-grid');
const titleEl = document.getElementById('env-page-title');
const orgId   = new URLSearchParams(location.search).get('id');

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function render() {
  grid.innerHTML = '';

  const envs = getEnvironmentsByOrg(orgId);
  if (envs.length === 0) {
    grid.innerHTML = '<p class="empty-msg">Esta organização ainda não tem ambientes. <a href="environments.html">Gerenciar</a>.</p>';
    return;
  }

  for (const env of envs) {
    const avg = environmentAvg(env);
    const cls = band(avg);
    const activeDevices = env.devices.length;

    const a = document.createElement('a');
    a.className = `env-card ${cls}`;
    a.href = `environment.html?id=${env.id}`;
    a.innerHTML = `
      <div class="env-card-top">
        <span class="env-icon">${env.icon}</span>
        <div class="env-id">
          <div class="env-name">${env.name}</div>
          <div class="env-type">${typeLabel(env.type)}</div>
        </div>
      </div>
      <div class="env-card-metric">
        <span class="env-db">${avg.toFixed(1)}</span>
        <span class="env-db-unit">dB</span>
        <span class="band-dot ${cls}"></span>
      </div>
      <div class="env-card-foot">
        <span>${activeDevices} dispositivos ativos</span>
        <span>Atualizado ${timeNow()}</span>
      </div>
    `;
    grid.appendChild(a);
  }
}

(async () => {
  try {
    await loadRegistry();
  } catch (_) {
    grid.innerHTML = '<p class="empty-msg">Não foi possível carregar os ambientes. Verifique se o servidor está ativo.</p>';
    return;
  }

  const org = getOrganization(orgId);
  if (!org) {
    titleEl.textContent = 'Organização não encontrada';
    grid.innerHTML = '<p class="empty-msg">Essa organização não existe. <a href="index.html">Voltar</a>.</p>';
    return;
  }

  document.title = `NoiseGuard — ${org.name}`;
  titleEl.textContent = `${org.name} — Ambientes`;
  render();
  setInterval(() => { simulateStep(); render(); }, 2000);
})();
