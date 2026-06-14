const express = require('express');
const router = express.Router();
const store = require('../store');
const { ingest, DEFAULT_DEVICE_ID } = require('../ingest');

router.post('/noise', (req, res) => {
  const { deviceid, deviceId, db, timestamp } = req.body;
  // Dispositivos enviam `deviceid` (minúsculo, numérico); o teste de
  // microfone do front usa `deviceId`. Aceitamos os dois.
  const result = ingest({ deviceId: deviceid ?? deviceId, db, timestamp });
  if (!result.ok) return res.status(result.code).json({ error: result.error });
  res.json({ status: 'ok', deviceId: result.deviceId, level: result.level });
});

router.get('/history', (req, res) => {
  const deviceId = req.query.deviceId || DEFAULT_DEVICE_ID;
  res.json(store.getAll(deviceId));
});

module.exports = router;
