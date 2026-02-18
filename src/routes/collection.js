const { Router } = require('express');
const { sendPayOrQuit, createPaymentPlan } = require('../services/collection');

const router = Router();

// POST /api/collection/:tenantId/approve-pay-or-quit
router.post('/:tenantId/approve-pay-or-quit', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const result = await sendPayOrQuit(tenantId, month, year);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/collection/:tenantId/payment-plan
router.post('/:tenantId/payment-plan', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const { ledger_id, initial_payment, monthly_installment, num_installments, notes } = req.body;

    if (!ledger_id || !monthly_installment || !num_installments) {
      return res.status(400).json({ error: 'ledger_id, monthly_installment, and num_installments are required' });
    }

    const result = await createPaymentPlan(
      tenantId,
      ledger_id,
      initial_payment || 0,
      monthly_installment,
      num_installments,
      notes
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
