const express = require('express');
const router = express.Router();
const reg = require('../registry');

const ID_RE = /^[A-Za-z0-9_-]{2,32}$/;

// Valida/normaliza o corpo. Em modo `partial`, só valida campos presentes.
function validate(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || 'id' in body) {
    if (typeof body.id !== 'string' || !ID_RE.test(body.id)) {
      errors.push('DeviceID deve ter 2–32 caracteres (letras, números, _ ou -)');
    } else {
      out.id = body.id;
    }
  }

  if (!partial || 'name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('Nome é obrigatório');
    } else {
      out.name = body.name.trim();
    }
  }

  if (!partial || 'envId' in body) {
    if (typeof body.envId !== 'string' || !reg.environmentExists(body.envId)) {
      errors.push('Ambiente inválido');
    } else {
      out.envId = body.envId;
    }
  }

  const numFields = [
    ['base',          0,   140],
    ['warnThreshold', 0,   140],
    ['critThreshold', 0,   140],
    ['intervalMs',    100, 60000],
  ];
  for (const [key, min, max] of numFields) {
    if (!partial || key in body) {
      const v = Number(body[key]);
      if (!Number.isFinite(v) || v < min || v > max) {
        errors.push(`${key} deve ser um número entre ${min} e ${max}`);
      } else {
        out[key] = v;
      }
    }
  }

  if (out.warnThreshold != null && out.critThreshold != null &&
      out.critThreshold < out.warnThreshold) {
    errors.push('Limiar crítico deve ser ≥ limiar de atenção');
  }

  if (!partial || 'active' in body) {
    out.active = body.active !== false;
  }

  return { errors, out };
}

// Registro completo (ambientes + dispositivos) — consumido por toda a interface.
router.get('/registry', (req, res) => {
  res.json(reg.getRegistry());
});

router.get('/devices', (req, res) => {
  res.json(reg.getRegistry().devices);
});

router.post('/devices', (req, res) => {
  const { errors, out } = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  if (reg.getDevice(out.id)) {
    return res.status(409).json({ errors: ['Já existe um dispositivo com esse DeviceID'] });
  }
  res.status(201).json(reg.addDevice(out));
});

router.put('/devices/:id', (req, res) => {
  const { errors, out } = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });
  const updated = reg.updateDevice(req.params.id, out);
  if (!updated) return res.status(404).json({ errors: ['Dispositivo não encontrado'] });
  res.json(updated);
});

router.delete('/devices/:id', (req, res) => {
  const ok = reg.deleteDevice(req.params.id);
  if (!ok) return res.status(404).json({ errors: ['Dispositivo não encontrado'] });
  res.json({ status: 'ok' });
});

module.exports = router;
