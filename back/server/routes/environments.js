const express = require('express');
const router = express.Router();
const reg = require('../registry');

const TYPES = ['school', 'industrial', 'office', 'hospital'];

function validate(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Nome é obrigatório');
    } else {
      out.name = body.name.trim();
    }
  }

  if (!partial || 'type' in body) {
    if (!TYPES.includes(body.type)) {
      errors.push('Tipo deve ser: school, industrial, office ou hospital');
    } else {
      out.type = body.type;
    }
  }

  if (!partial || 'orgId' in body) {
    if (typeof body.orgId !== 'string' || !reg.organizationExists(body.orgId)) {
      errors.push('Organização inválida');
    } else {
      out.orgId = body.orgId;
    }
  }

  // Ícone: usa o informado ou deriva do tipo.
  if (typeof body.icon === 'string' && body.icon.trim()) {
    out.icon = body.icon.trim();
  } else if (out.type) {
    out.icon = reg.TYPE_ICON[out.type];
  }

  return { errors, out };
}

// Lista ambientes (opcionalmente filtrados por ?orgId) com contagem de dispositivos.
router.get('/environments', (req, res) => {
  const { orgId } = req.query;
  const list = reg.getRegistry().environments
    .filter(e => !orgId || e.orgId === orgId)
    .map(e => ({ ...e, devices: reg.countDevicesByEnv(e.id) }));
  res.json(list);
});

router.post('/environments', (req, res) => {
  const { errors, out } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.status(201).json(reg.addEnvironment(out));
});

router.put('/environments/:id', (req, res) => {
  const { errors, out } = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  const updated = reg.updateEnvironment(req.params.id, out);
  if (!updated) return res.status(404).json({ errors: ['Ambiente não encontrado'] });
  res.json(updated);
});

router.delete('/environments/:id', (req, res) => {
  const r = reg.deleteEnvironment(req.params.id);
  if (r.ok) return res.json({ status: 'ok' });
  if (r.code === 409) {
    return res.status(409).json({
      errors: ['Remova os dispositivos deste ambiente antes de excluí-lo'],
    });
  }
  res.status(404).json({ errors: ['Ambiente não encontrado'] });
});

module.exports = router;
