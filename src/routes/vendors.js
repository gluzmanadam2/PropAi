const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/vendors — list all with performance scores
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const vendors = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.vendor_id = v.id) as total_jobs,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.vendor_id = v.id AND wo.status = 'completed') as completed_jobs,
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.vendor_id = v.id AND wo.status IN ('new','dispatched','in_progress')) as active_jobs
      FROM vendors v
      ORDER BY v.performance_score DESC
    `).all();

    res.json({ count: vendors.length, vendors });
  } finally {
    db.close();
  }
});

module.exports = router;
