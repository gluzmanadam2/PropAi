const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/conversations — recent conversations (activity feed)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const limit = parseInt(req.query.limit) || 20;
    const conversations = db.prepare(`
      SELECT c.*, t.first_name, t.last_name, u.unit_number, p.address as property_address
      FROM conversations c
      JOIN tenants t ON c.tenant_id = t.id
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(limit);

    res.json({ count: conversations.length, conversations });
  } finally {
    db.close();
  }
});

// GET /api/conversations/:tenantId
router.get('/:tenantId', (req, res) => {
  const db = getDb();
  try {
    const tenant = db.prepare('SELECT id, first_name, last_name FROM tenants WHERE id = ?')
      .get(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const conversations = db.prepare(`
      SELECT * FROM conversations
      WHERE tenant_id = ?
      ORDER BY created_at ASC
    `).all(req.params.tenantId);

    res.json({
      tenant: `${tenant.first_name} ${tenant.last_name}`,
      count: conversations.length,
      conversations,
    });
  } finally {
    db.close();
  }
});

module.exports = router;
