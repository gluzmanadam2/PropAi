const { Router } = require('express');
const { runCollectionDay, generateMonthlyLedger } = require('../services/collection');

const router = Router();

// POST /api/test/run-collection-day?day=N
router.post('/run-collection-day', async (req, res) => {
  try {
    const day = parseInt(req.query.day);
    const { month, year } = req.body;

    if (!day || day < 1 || day > 31) {
      return res.status(400).json({ error: 'day query parameter must be between 1 and 31' });
    }

    const m = month || 2;
    const y = year || 2026;

    const results = await runCollectionDay(day, m, y);
    res.json({ day, month: m, year: y, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/test/generate-ledger
router.post('/generate-ledger', (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const result = generateMonthlyLedger(month, year);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
