const express = require('express');
const router = express.Router();
const store = require('../store');
const { ingest, DEFAULT_DEVICE_ID } = require('../ingest');
const ah = require('../async-handler');

router.post('/noise', ah(async (req, res) => {
  const { deviceid, deviceId, db, timestamp } = req.body;
  // Dispositivos enviam `deviceid` (minúsculo, numérico); o teste de
  // microfone do front usa `deviceId`. Aceitamos os dois.
  const result = await ingest({ deviceId: deviceid ?? deviceId, db, timestamp });
  if (!result.ok) return res.status(result.code).json({ error: result.error });
  res.json({ status: 'ok', deviceId: result.deviceId, level: result.level });
}));

router.get('/history', ah(async (req, res) => {
  const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
  res.json(await store.getAll(deviceId));
}));

// Última leitura de cada dispositivo — consumido pelas telas de lista.
router.get('/readings/latest', ah(async (req, res) => {
  res.json(await store.getLatestAll());
}));

module.exports = router;
