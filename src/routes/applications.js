const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/applications — list all, with optional ?unit_id or ?status filter
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let sql = `
      SELECT a.*, u.unit_number, u.market_rent, u.bedrooms, u.bathrooms, u.sqft,
             p.address as property_address, p.name as property_name
      FROM applications a
      JOIN units u ON a.unit_id = u.id
      JOIN properties p ON a.property_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.unit_id) {
      sql += ' AND a.unit_id = ?';
      params.push(req.query.unit_id);
    }
    if (req.query.status) {
      sql += ' AND a.status = ?';
      params.push(req.query.status);
    }
    if (req.query.property_id) {
      sql += ' AND a.property_id = ?';
      params.push(req.query.property_id);
    }

    sql += ' ORDER BY a.submitted_at DESC';

    const applications = db.prepare(sql).all(...params);
    res.json({ count: applications.length, applications });
  } finally {
    db.close();
  }
});

// POST /api/applications/:id/approve
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  try {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'under_review' && app.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot approve application with status "${app.status}"` });
    }

    db.prepare("UPDATE applications SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?")
      .run(req.params.id);

    const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    res.json({ message: 'Application approved', application: updated });
  } finally {
    db.close();
  }
});

// POST /api/applications/:id/deny
router.post('/:id/deny', (req, res) => {
  const db = getDb();
  try {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'under_review' && app.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot deny application with status "${app.status}"` });
    }

    const { reason } = req.body || {};
    db.prepare("UPDATE applications SET status = 'denied', reviewed_at = datetime('now'), denied_reason = ? WHERE id = ?")
      .run(reason || null, req.params.id);

    const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    res.json({ message: 'Application denied', application: updated });
  } finally {
    db.close();
  }
});

// POST /api/applications/:id/review — move to under_review
router.post('/:id/review', (req, res) => {
  const db = getDb();
  try {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    db.prepare("UPDATE applications SET status = 'under_review' WHERE id = ?")
      .run(req.params.id);

    const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    res.json({ message: 'Application moved to review', application: updated });
  } finally {
    db.close();
  }
});

module.exports = router;
