const { Router } = require('express');
const { getDb } = require('../db/schema');
const { recordPayment, getDelinquentTenants } = require('../services/collection');

const router = Router();

// GET /api/rent-ledger/current — current month summary + entries
router.get('/current', (req, res) => {
  const db = getDb();
  try {
    const month = 2; // February 2026
    const year = 2026;

    const entries = db.prepare(`
      SELECT rl.*, t.first_name, t.last_name, t.phone, t.payment_method as tenant_payment_method,
             u.unit_number, p.address as property_address
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      JOIN units u ON rl.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE rl.month = ? AND rl.year = ?
      ORDER BY rl.status DESC, p.address, u.unit_number
    `).all(month, year);

    const summary = {
      month,
      year,
      total_entries: entries.length,
      total_due: entries.reduce((sum, e) => sum + e.amount_due, 0),
      total_collected: entries.reduce((sum, e) => sum + e.amount_paid, 0),
      paid: entries.filter(e => e.status === 'paid').length,
      unpaid: entries.filter(e => e.status === 'unpaid').length,
      late: entries.filter(e => e.status === 'late').length,
      partial: entries.filter(e => e.status === 'partial').length,
    };

    res.json({ summary, entries });
  } finally {
    db.close();
  }
});

// GET /api/rent-ledger/delinquent — unpaid/late/partial tenants with collection history
router.get('/delinquent', (req, res) => {
  const month = parseInt(req.query.month) || 2;
  const year = parseInt(req.query.year) || 2026;

  const delinquent = getDelinquentTenants(month, year);

  res.json({
    month,
    year,
    count: delinquent.length,
    total_owed: delinquent.reduce((sum, e) => sum + e.total_owed, 0),
    tenants: delinquent,
  });
});

// GET /api/rent-ledger/tenant/:id — full rent history + collection actions + payment plans
router.get('/tenant/:id', (req, res) => {
  const db = getDb();
  try {
    const tenantId = parseInt(req.params.id);

    const tenant = db.prepare(`
      SELECT t.*, u.unit_number, p.address, p.name as property_name
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = ?
    `).get(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const ledger = db.prepare(
      'SELECT * FROM rent_ledger WHERE tenant_id = ? ORDER BY year DESC, month DESC'
    ).all(tenantId);

    const collectionActions = db.prepare(
      'SELECT * FROM collection_actions WHERE tenant_id = ? ORDER BY sent_at DESC'
    ).all(tenantId);

    const paymentPlans = db.prepare(
      'SELECT * FROM payment_plans WHERE tenant_id = ? ORDER BY created_at DESC'
    ).all(tenantId);

    res.json({ tenant, ledger, collection_actions: collectionActions, payment_plans: paymentPlans });
  } finally {
    db.close();
  }
});

// GET /api/rent-ledger — current month rent status (original endpoint)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const entries = db.prepare(`
      SELECT rl.*, t.first_name, t.last_name, t.phone, t.payment_method as tenant_payment_method,
             u.unit_number, p.address as property_address
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      JOIN units u ON rl.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE rl.month = ? AND rl.year = ?
      ORDER BY rl.status DESC, p.address, u.unit_number
    `).all(month, year);

    const summary = {
      month,
      year,
      total_entries: entries.length,
      total_due: entries.reduce((sum, e) => sum + e.amount_due, 0),
      total_collected: entries.reduce((sum, e) => sum + e.amount_paid, 0),
      paid: entries.filter(e => e.status === 'paid').length,
      unpaid: entries.filter(e => e.status === 'unpaid').length,
      late: entries.filter(e => e.status === 'late').length,
      partial: entries.filter(e => e.status === 'partial').length,
    };

    res.json({ summary, entries });
  } finally {
    db.close();
  }
});

// POST /api/rent-ledger/:id/record-payment
router.post('/:id/record-payment', (req, res) => {
  try {
    const ledgerId = parseInt(req.params.id);
    const { amount, payment_method, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const result = recordPayment(ledgerId, amount, payment_method || 'manual', notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
