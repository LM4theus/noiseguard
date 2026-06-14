// Gestão de ambientes — CRUD contra /api/environments.
// Os dispositivos de cada ambiente são gerenciados na tela ⚙️ Dispositivos.
const BASE = 'http://localhost:3000';

const TYPE_LABEL = {
  school: '🏫 Escola', industrial: '🏭 Industrial',
  office: '🏢 Escritório', hospital: '🏥 Hospital',
};

let environments = [];
let organizations = [];
let editingId = null;

// ── DOM ────────────────────────────────────────────────────────
const tbody     = document.getElementById('envs-tbody');
const panel     = document.getElementById('form-panel');
const form      = document.getElementById('env-form');
const formTitle = document.getElementById('form-title');
const errorsBox = document.getElementById('form-errors');
const orgSelect = document.getElementById('f-org');

// ── Carregamento ───────────────────────────────────────────────
async function load() {
  [environments, organizations] = await Promise.all([
    fetch(`${BASE}/api/environments`).then(r => r.json()),
    fetch(`${BASE}/api/organizations`).then(r => r.json()),
  ]);
}

function orgName(id) {
  return organizations.find(o => o.id === id)?.name ?? '—';
}

// ── Tabela ─────────────────────────────────────────────────────
function renderTable() {
  if (environments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum ambiente cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  for (const e of environments) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.icon ?? ''} ${e.name}</td>
      <td>${TYPE_LABEL[e.type] ?? e.type}</td>
      <td>${orgName(e.orgId)}</td>
      <td>${e.devices}</td>
      <td class="row-actions">
        <a class="btn-ghost btn-sm" href="environment.html?id=${e.id}">Ver</a>
        <button class="icon-btn" data-edit="${e.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-del="${e.id}" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderOrgOptions() {
  orgSelect.innerHTML = organizations
    .map(o => `<option value="${o.id}">${o.name}</option>`)
    .join('');
}

// ── Formulário ─────────────────────────────────────────────────
function openForm(env) {
  editingId = env ? env.id : null;
  formTitle.textContent = env ? 'Editar ambiente' : 'Novo ambiente';
  errorsBox.hidden = true;

  form.name.value = env ? env.name : '';
  form.orgId.value = env ? env.orgId : (organizations[0]?.id ?? '');
  form.type.value = env ? env.type : 'school';
  form.icon.value = env ? (env.icon ?? '') : '';

  panel.hidden = false;
  form.name.focus();
}

function closeForm() { panel.hidden = true; editingId = null; }

function showErrors(list) {
  errorsBox.innerHTML = list.map(e => `• ${e}`).join('<br>');
  errorsBox.hidden = false;
}

async function submitForm(e) {
  e.preventDefault();
  const payload = {
    name: form.name.value.trim(),
    orgId: form.orgId.value,
    type: form.type.value,
    icon: form.icon.value.trim(),
  };
  const isEdit = editingId !== null;
  const url = isEdit ? `${BASE}/api/environments/${editingId}` : `${BASE}/api/environments`;
  try {
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return showErrors(data.errors ?? ['Erro ao salvar.']);
    }
    await refresh();
    closeForm();
  } catch (_) {
    showErrors(['Falha de conexão com o servidor.']);
  }
}

async function deleteEnv(id) {
  const env = environments.find(e => e.id === id);
  if (!confirm(`Excluir o ambiente "${env?.name ?? id}"?`)) return;
  const res = await fetch(`${BASE}/api/environments/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert((data.errors ?? ['Não foi possível excluir.']).join('\n'));
    return;
  }
  if (editingId === id) closeForm();
  await refresh();
}

// ── Eventos ────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => openForm(null));
document.getElementById('form-close').addEventListener('click', closeForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);
form.addEventListener('submit', submitForm);

tbody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn  = e.target.closest('[data-del]');
  if (editBtn) openForm(environments.find(x => x.id === editBtn.dataset.edit));
  if (delBtn)  deleteEnv(delBtn.dataset.del);
});

// ── Bootstrap ──────────────────────────────────────────────────
async function refresh() {
  await load();
  renderTable();
}

(async () => {
  try {
    await load();
    renderOrgOptions();
    renderTable();
  } catch (_) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Não foi possível carregar. Verifique se o servidor está ativo.</td></tr>';
  }
})();
