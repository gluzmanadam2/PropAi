const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/notifications — pending notifications for owner
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const { status } = req.query;
    let sql = `
      SELECT n.*, wo.category as wo_category, wo.priority as wo_priority
      FROM notifications n
      LEFT JOIN work_orders wo ON n.related_work_order_id = wo.id
    `;
    const params = [];

    if (status) {
      sql += ' WHERE n.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY n.created_at DESC';

    const notifications = db.prepare(sql).all(...params);
    res.json({ count: notifications.length, notifications });
  } finally {
    db.close();
  }
});

// POST /api/notifications/:id/acknowledge
router.post('/:id/acknowledge', (req, res) => {
  const db = getDb();
  try {
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare("UPDATE notifications SET status = 'acknowledged' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Notification acknowledged', id: req.params.id });
  } finally {
    db.close();
  }
});

module.exports = router;
