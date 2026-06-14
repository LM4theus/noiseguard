const express = require('express');
const router = express.Router();
const reg = require('../registry');

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

  if (!partial || 'active' in body) {
    out.active = body.active !== false;
  }

  return { errors, out };
}

// Lista organizações com contagem de ambientes e dispositivos.
router.get('/organizations', (req, res) => {
  const orgs = reg.getRegistry().organizations.map(o => ({
    ...o,
    environments: reg.countEnvironments(o.id),
    devices: reg.countDevicesByOrg(o.id),
  }));
  res.json(orgs);
});

router.post('/organizations', (req, res) => {
  const { errors, out } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  res.status(201).json(reg.addOrganization(out));
});

router.put('/organizations/:id', (req, res) => {
  const { errors, out } = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  const updated = reg.updateOrganization(req.params.id, out);
  if (!updated) return res.status(404).json({ errors: ['Organização não encontrada'] });
  res.json(updated);
});

router.delete('/organizations/:id', (req, res) => {
  const r = reg.deleteOrganization(req.params.id);
  if (r.ok) return res.json({ status: 'ok' });
  if (r.code === 409) {
    return res.status(409).json({
      errors: ['Remova ou reatribua os ambientes desta organização antes de excluí-la'],
    });
  }
  res.status(404).json({ errors: ['Organização não encontrada'] });
});

module.exports = router;
