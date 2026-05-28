const express = require('express');
const router = express.Router();
const store = require('../store');
const { classify } = require('../alerts');

router.post('/noise', (req, res) => {
  const { db, timestamp } = req.body;

  if (typeof db !== 'number' || db < 0 || db > 140) {
    return res.status(400).json({ error: 'db must be a number between 0 and 140' });
  }

  const level = classify(db);
  const point = { db, timestamp: timestamp || Date.now(), level };
  store.add(point);

  res.json({ status: 'ok', level });
});

router.get('/history', (req, res) => {
  res.json(store.getAll());
});

module.exports = router;
