const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/tenants — list all tenants
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const tenants = db.prepare(`
      SELECT t.*, u.unit_number, p.address as property_address, p.name as property_name
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      ORDER BY t.last_name, t.first_name
    `).all();

    res.json({ count: tenants.length, tenants });
  } finally {
    db.close();
  }
});

// GET /api/tenants/:id — tenant detail with conversations and payments
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const tenant = db.prepare(`
      SELECT t.*, u.unit_number, u.bedrooms, u.bathrooms, u.sqft,
             p.address as property_address, p.name as property_name, p.city, p.state
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const conversations = db.prepare(`
      SELECT * FROM conversations WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);

    const payments = db.prepare(`
      SELECT * FROM rent_ledger WHERE tenant_id = ? ORDER BY year DESC, month DESC LIMIT 12
    `).all(req.params.id);

    const workOrders = db.prepare(`
      SELECT wo.*, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN vendors v ON wo.vendor_id = v.id
      WHERE wo.tenant_id = ?
      ORDER BY wo.created_at DESC LIMIT 10
    `).all(req.params.id);

    const collectionActions = db.prepare(`
      SELECT * FROM collection_actions WHERE tenant_id = ? ORDER BY sent_at DESC
    `).all(req.params.id);

    res.json({
      ...tenant,
      conversations,
      payment_history: payments,
      work_orders: workOrders,
      collection_actions: collectionActions,
    });
  } finally {
    db.close();
  }
});

module.exports = router;
