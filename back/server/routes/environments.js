const express = require('express');
const router = express.Router();
const reg = require('../registry');
const ah = require('../async-handler');

const TYPES = ['school', 'industrial', 'office', 'hospital'];

// Validação de formato (sem banco). Existência da organização é checada no handler.
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
    if (typeof body.orgId !== 'string' || !body.orgId) {
      errors.push('Organização é obrigatória');
    } else {
      out.orgId = body.orgId;
    }
  }

  if (typeof body.icon === 'string' && body.icon.trim()) {
    out.icon = body.icon.trim();
  } else if (out.type) {
    out.icon = reg.TYPE_ICON[out.type];
  }

  return { errors, out };
}

// Lista ambientes (opcionalmente filtrados por ?orgId) com contagem de dispositivos.
router.get('/environments', ah(async (req, res) => {
  res.json(await reg.listEnvironmentsWithCounts(req.query.orgId));
}));

router.post('/environments', ah(async (req, res) => {
  const { errors, out } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  if (!(await reg.organizationExists(out.orgId))) {
    return res.status(400).json({ errors: ['Organização inválida'] });
  }
  res.status(201).json(await reg.addEnvironment(out));
}));

router.put('/environments/:id', ah(async (req, res) => {
  const { errors, out } = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  if (out.orgId && !(await reg.organizationExists(out.orgId))) {
    return res.status(400).json({ errors: ['Organização inválida'] });
  }
  const updated = await reg.updateEnvironment(req.params.id, out);
  if (!updated) return res.status(404).json({ errors: ['Ambiente não encontrado'] });
  res.json(updated);
}));

router.delete('/environments/:id', ah(async (req, res) => {
  const r = await reg.deleteEnvironment(req.params.id);
  if (r.ok) return res.json({ status: 'ok' });
  if (r.code === 409) {
    return res.status(409).json({
      errors: ['Remova os dispositivos deste ambiente antes de excluí-lo'],
    });
  }
  res.status(404).json({ errors: ['Ambiente não encontrado'] });
}));

module.exports = router;
