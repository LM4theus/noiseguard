// Home — lista de organizações (topo da hierarquia).
import {
  loadRegistry, refreshReadings, getOrganizations, orgAvg,
  orgEnvCount, orgDeviceCount, band,
} from './data.js';

const grid = document.getElementById('org-grid');

function render() {
  const orgs = getOrganizations();
  if (orgs.length === 0) {
    grid.innerHTML = '<p class="empty-msg">Nenhuma organização cadastrada. <a href="organizations.html">Cadastrar</a>.</p>';
    return;
  }

  grid.innerHTML = '';
  for (const org of orgs) {
    const avg = orgAvg(org);
    const hasData = avg != null;
    const cls = hasData ? band(avg) : 'nd';

    const a = document.createElement('a');
    a.className = `env-card ${cls}`;
    a.href = `organization.html?id=${org.id}`;
    a.innerHTML = `
      <div class="env-card-top">
        <span class="env-icon">🏢</span>
        <div class="env-id">
          <div class="env-name">${org.name}</div>
          <div class="env-type">${org.active === false ? 'Inativa' : 'Organização'}</div>
        </div>
      </div>
      <div class="env-card-metric">
        <span class="env-db">${hasData ? avg.toFixed(1) : '—'}</span>
        <span class="env-db-unit">dB médio</span>
        <span class="band-dot ${cls}"></span>
      </div>
      <div class="env-card-foot">
        <span>${orgEnvCount(org)} ambientes</span>
        <span>${orgDeviceCount(org)} dispositivos</span>
      </div>
    `;
    grid.appendChild(a);
  }
}

(async () => {
  try {
    await loadRegistry();
    await refreshReadings();
    render();
    setInterval(async () => { await refreshReadings(); render(); }, 2000);
  } catch (_) {
    grid.innerHTML = '<p class="empty-msg">Não foi possível carregar as organizações. Verifique se o servidor está ativo.</p>';
  }
})();
