// Tela de gestão de dispositivos — CRUD contra /api/devices.
const BASE = 'http://localhost:3000';

let environments = [];
let devices = [];
let editingId = null; // null = criando; id = editando

// ── DOM ────────────────────────────────────────────────────────
const tbody      = document.getElementById('devices-tbody');
const panel      = document.getElementById('form-panel');
const form       = document.getElementById('device-form');
const formTitle  = document.getElementById('form-title');
const errorsBox  = document.getElementById('form-errors');
const envSelect  = document.getElementById('f-env');
const fId        = document.getElementById('f-id');

const DEFAULTS = { base: 55, warnThreshold: 70, critThreshold: 85, intervalMs: 1000, active: true };

// ── Carregamento ───────────────────────────────────────────────
async function loadRegistry() {
  const res = await fetch(`${BASE}/api/registry`);
  const reg = await res.json();
  environments = reg.environments;
  devices = reg.devices;
}

function envName(id) {
  return environments.find(e => e.id === id)?.name ?? '—';
}

// ── Renderização da tabela ─────────────────────────────────────
function renderTable() {
  if (devices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum dispositivo cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  for (const d of devices) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${d.id}</code></td>
      <td>${d.name}</td>
      <td>${envName(d.envId)}</td>
      <td>${d.warnThreshold} dB</td>
      <td>${d.critThreshold} dB</td>
      <td>${d.intervalMs} ms</td>
      <td><span class="status-pill ${d.active ? 'on' : 'off'}">${d.active ? 'Ativo' : 'Inativo'}</span></td>
      <td class="row-actions">
        <button class="icon-btn" data-edit="${d.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-del="${d.id}" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderEnvOptions() {
  envSelect.innerHTML = environments
    .map(e => `<option value="${e.id}">${e.name}</option>`)
    .join('');
}

// ── Formulário ─────────────────────────────────────────────────
function openForm(device) {
  editingId = device ? device.id : null;
  formTitle.textContent = device ? 'Editar dispositivo' : 'Novo dispositivo';
  errorsBox.hidden = true;
  errorsBox.textContent = '';

  const d = device ?? { id: '', name: '', envId: environments[0]?.id ?? '', ...DEFAULTS };
  fId.value = d.id;
  fId.disabled = !!device; // DeviceID não muda na edição
  form.name.value = d.name;
  form.envId.value = d.envId;
  form.warnThreshold.value = d.warnThreshold;
  form.critThreshold.value = d.critThreshold;
  form.base.value = d.base;
  form.intervalMs.value = d.intervalMs;
  form.active.checked = d.active !== false;

  panel.hidden = false;
  (device ? form.name : fId).focus();
}

function closeForm() {
  panel.hidden = true;
  editingId = null;
}

function showErrors(list) {
  errorsBox.innerHTML = list.map(e => `• ${e}`).join('<br>');
  errorsBox.hidden = false;
}

function formPayload() {
  return {
    id: fId.value.trim(),
    name: form.name.value.trim(),
    envId: form.envId.value,
    base: Number(form.base.value),
    warnThreshold: Number(form.warnThreshold.value),
    critThreshold: Number(form.critThreshold.value),
    intervalMs: Number(form.intervalMs.value),
    active: form.active.checked,
  };
}

async function submitForm(e) {
  e.preventDefault();
  const payload = formPayload();
  const isEdit = editingId !== null;
  const url = isEdit ? `${BASE}/api/devices/${editingId}` : `${BASE}/api/devices`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showErrors(data.errors ?? ['Erro ao salvar.']);
      return;
    }
    await refresh();
    closeForm();
  } catch (_) {
    showErrors(['Falha de conexão com o servidor.']);
  }
}

async function deleteDevice(id) {
  if (!confirm(`Excluir o dispositivo "${id}"?`)) return;
  try {
    const res = await fetch(`${BASE}/api/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    if (editingId === id) closeForm();
    await refresh();
  } catch (_) {}
}

// ── Eventos ────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => openForm(null));
document.getElementById('form-close').addEventListener('click', closeForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);
form.addEventListener('submit', submitForm);

tbody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn  = e.target.closest('[data-del]');
  if (editBtn) openForm(devices.find(d => d.id === editBtn.dataset.edit));
  if (delBtn)  deleteDevice(delBtn.dataset.del);
});

// ── Bootstrap ──────────────────────────────────────────────────
async function refresh() {
  await loadRegistry();
  renderTable();
}

(async () => {
  try {
    await loadRegistry();
    renderEnvOptions();
    renderTable();
  } catch (_) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Não foi possível carregar. Verifique se o servidor está ativo.</td></tr>';
  }
})();
