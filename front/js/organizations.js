// Gestão de organizações (e dos ambientes de cada organização).
// Hierarquia: Organização → Ambientes → Dispositivos (estes na tela ⚙️).
const BASE = 'http://localhost:3000';

const TYPE_LABEL = {
  school: '🏫 Escola', industrial: '🏭 Industrial',
  office: '🏢 Escritório', hospital: '🏥 Hospital',
};

let orgs = [];
let envs = [];            // ambientes da organização selecionada (com contagem)
let selectedOrgId = null;
let editingOrgId = null;
let editingEnvId = null;

// ── DOM ────────────────────────────────────────────────────────
const orgsTbody   = document.getElementById('orgs-tbody');
const orgPanel    = document.getElementById('org-form-panel');
const orgForm     = document.getElementById('org-form');
const orgTitle    = document.getElementById('org-form-title');
const orgErrors   = document.getElementById('org-form-errors');

const envSection  = document.getElementById('env-section');
const envTitle    = document.getElementById('env-section-title');
const envsTbody   = document.getElementById('envs-tbody');
const envPanel    = document.getElementById('env-form-panel');
const envForm     = document.getElementById('env-form');
const envFormTitle = document.getElementById('env-form-title');
const envErrors   = document.getElementById('env-form-errors');

// ── Fetch helpers ──────────────────────────────────────────────
async function fetchOrgs() {
  orgs = await (await fetch(`${BASE}/api/organizations`)).json();
}
async function fetchEnvs(orgId) {
  envs = await (await fetch(`${BASE}/api/environments?orgId=${encodeURIComponent(orgId)}`)).json();
}

function showErrors(box, list) {
  box.innerHTML = list.map(e => `• ${e}`).join('<br>');
  box.hidden = false;
}

async function apiSend(url, method, payload) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, errors: data.errors ?? ['Erro ao salvar.'] };
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════
// ORGANIZAÇÕES
// ════════════════════════════════════════════════════════════════
function renderOrgs() {
  if (orgs.length === 0) {
    orgsTbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhuma organização cadastrada.</td></tr>';
    return;
  }
  orgsTbody.innerHTML = '';
  for (const o of orgs) {
    const tr = document.createElement('tr');
    if (o.id === selectedOrgId) tr.classList.add('row-selected');
    tr.innerHTML = `
      <td>${o.name}</td>
      <td>${o.environments}</td>
      <td>${o.devices}</td>
      <td><span class="status-pill ${o.active ? 'on' : 'off'}">${o.active ? 'Ativa' : 'Inativa'}</span></td>
      <td class="row-actions">
        <button class="btn-ghost btn-sm" data-envs="${o.id}">Ambientes</button>
        <button class="icon-btn" data-edit-org="${o.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-del-org="${o.id}" title="Excluir">🗑️</button>
      </td>
    `;
    orgsTbody.appendChild(tr);
  }
}

function openOrgForm(org) {
  editingOrgId = org ? org.id : null;
  orgTitle.textContent = org ? 'Editar organização' : 'Nova organização';
  orgErrors.hidden = true;
  orgForm.name.value = org ? org.name : '';
  orgForm.active.checked = org ? org.active !== false : true;
  orgPanel.hidden = false;
  orgForm.name.focus();
}

function closeOrgForm() { orgPanel.hidden = true; editingOrgId = null; }

async function submitOrg(e) {
  e.preventDefault();
  const payload = { name: orgForm.name.value.trim(), active: orgForm.active.checked };
  const isEdit = editingOrgId !== null;
  const url = isEdit ? `${BASE}/api/organizations/${editingOrgId}` : `${BASE}/api/organizations`;
  const r = await apiSend(url, isEdit ? 'PUT' : 'POST', payload);
  if (!r.ok) return showErrors(orgErrors, r.errors);
  closeOrgForm();
  await refreshOrgs();
}

async function deleteOrg(id) {
  const org = orgs.find(o => o.id === id);
  if (!confirm(`Excluir a organização "${org?.name ?? id}"?`)) return;
  const res = await fetch(`${BASE}/api/organizations/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert((data.errors ?? ['Não foi possível excluir.']).join('\n'));
    return;
  }
  if (selectedOrgId === id) { selectedOrgId = null; envSection.hidden = true; }
  await refreshOrgs();
}

// ════════════════════════════════════════════════════════════════
// AMBIENTES (da organização selecionada)
// ════════════════════════════════════════════════════════════════
async function selectOrg(id) {
  selectedOrgId = id;
  const org = orgs.find(o => o.id === id);
  envTitle.textContent = `Ambientes — ${org?.name ?? ''}`;
  closeEnvForm();
  await refreshEnvs();
  envSection.hidden = false;
  renderOrgs(); // realça a linha selecionada
  envSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderEnvs() {
  if (envs.length === 0) {
    envsTbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum ambiente nesta organização.</td></tr>';
    return;
  }
  envsTbody.innerHTML = '';
  for (const e of envs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.icon ?? ''} ${e.name}</td>
      <td>${TYPE_LABEL[e.type] ?? e.type}</td>
      <td>${e.devices}</td>
      <td class="row-actions">
        <a class="btn-ghost btn-sm" href="environment.html?id=${e.id}">Ver</a>
        <button class="icon-btn" data-edit-env="${e.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-del-env="${e.id}" title="Excluir">🗑️</button>
      </td>
    `;
    envsTbody.appendChild(tr);
  }
}

function openEnvForm(env) {
  editingEnvId = env ? env.id : null;
  envFormTitle.textContent = env ? 'Editar ambiente' : 'Novo ambiente';
  envErrors.hidden = true;
  envForm.name.value = env ? env.name : '';
  envForm.type.value = env ? env.type : 'school';
  envPanel.hidden = false;
  envForm.name.focus();
}

function closeEnvForm() { envPanel.hidden = true; editingEnvId = null; }

async function submitEnv(e) {
  e.preventDefault();
  if (!selectedOrgId) return;
  const payload = {
    name: envForm.name.value.trim(),
    type: envForm.type.value,
    orgId: selectedOrgId,
  };
  const isEdit = editingEnvId !== null;
  const url = isEdit ? `${BASE}/api/environments/${editingEnvId}` : `${BASE}/api/environments`;
  const r = await apiSend(url, isEdit ? 'PUT' : 'POST', payload);
  if (!r.ok) return showErrors(envErrors, r.errors);
  closeEnvForm();
  await refreshEnvs();
  await refreshOrgs(); // atualiza contagem de ambientes na tabela de orgs
}

async function deleteEnv(id) {
  const env = envs.find(e => e.id === id);
  if (!confirm(`Excluir o ambiente "${env?.name ?? id}"?`)) return;
  const res = await fetch(`${BASE}/api/environments/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert((data.errors ?? ['Não foi possível excluir.']).join('\n'));
    return;
  }
  await refreshEnvs();
  await refreshOrgs();
}

// ── Refresh ────────────────────────────────────────────────────
async function refreshOrgs() { await fetchOrgs(); renderOrgs(); }
async function refreshEnvs() {
  if (!selectedOrgId) return;
  await fetchEnvs(selectedOrgId);
  renderEnvs();
}

// ── Eventos ────────────────────────────────────────────────────
document.getElementById('btn-new-org').addEventListener('click', () => openOrgForm(null));
document.getElementById('org-form-close').addEventListener('click', closeOrgForm);
document.getElementById('org-form-cancel').addEventListener('click', closeOrgForm);
orgForm.addEventListener('submit', submitOrg);

document.getElementById('btn-new-env').addEventListener('click', () => openEnvForm(null));
document.getElementById('env-form-close').addEventListener('click', closeEnvForm);
document.getElementById('env-form-cancel').addEventListener('click', closeEnvForm);
envForm.addEventListener('submit', submitEnv);

orgsTbody.addEventListener('click', (e) => {
  const envsBtn = e.target.closest('[data-envs]');
  const editBtn = e.target.closest('[data-edit-org]');
  const delBtn  = e.target.closest('[data-del-org]');
  if (envsBtn) selectOrg(envsBtn.dataset.envs);
  if (editBtn) openOrgForm(orgs.find(o => o.id === editBtn.dataset.editOrg));
  if (delBtn)  deleteOrg(delBtn.dataset.delOrg);
});

envsTbody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit-env]');
  const delBtn  = e.target.closest('[data-del-env]');
  if (editBtn) openEnvForm(envs.find(x => x.id === editBtn.dataset.editEnv));
  if (delBtn)  deleteEnv(delBtn.dataset.delEnv);
});

// ── Bootstrap ──────────────────────────────────────────────────
(async () => {
  try {
    await refreshOrgs();
  } catch (_) {
    orgsTbody.innerHTML = '<tr><td colspan="5" class="table-empty">Não foi possível carregar. Verifique se o servidor está ativo.</td></tr>';
  }
})();
