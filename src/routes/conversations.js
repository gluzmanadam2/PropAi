const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

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
