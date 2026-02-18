const { Router } = require('express');
const { getDb } = require('../db/schema');
const { notifyVendorDispatch, notifyTenantDispatch, notifyOwnerEmergency } = require('../services/sms');

const router = Router();

// GET /api/work-orders — list with optional filters
router.get('/', (req, res) => {
  const { status, priority, property_id } = req.query;
  const db = getDb();

  try {
    let sql = `
      SELECT wo.*, t.first_name, t.last_name, t.phone as tenant_phone,
             u.unit_number, p.address as property_address,
             v.company_name as vendor_name, v.phone as vendor_phone
      FROM work_orders wo
      LEFT JOIN tenants t ON wo.tenant_id = t.id
      LEFT JOIN units u ON wo.unit_id = u.id
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN vendors v ON wo.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND wo.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND wo.priority = ?';
      params.push(priority);
    }
    if (property_id) {
      sql += ' AND wo.property_id = ?';
      params.push(property_id);
    }

    sql += ' ORDER BY wo.created_at DESC';

    const workOrders = db.prepare(sql).all(...params);
    res.json({ count: workOrders.length, work_orders: workOrders });
  } finally {
    db.close();
  }
});

// GET /api/work-orders/:id — single work order
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const wo = db.prepare(`
      SELECT wo.*, t.first_name, t.last_name, t.phone as tenant_phone, t.email as tenant_email,
             u.unit_number, p.address as property_address, p.name as property_name,
             v.company_name as vendor_name, v.contact_name as vendor_contact, v.phone as vendor_phone
      FROM work_orders wo
      LEFT JOIN tenants t ON wo.tenant_id = t.id
      LEFT JOIN units u ON wo.unit_id = u.id
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN vendors v ON wo.vendor_id = v.id
      WHERE wo.id = ?
    `).get(req.params.id);

    if (!wo) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    res.json(wo);
  } finally {
    db.close();
  }
});

// PUT /api/work-orders/:id — update work order
router.put('/:id', (req, res) => {
  const { status, vendor_id, notes, cost, vendor_eta } = req.body;
  const db = getDb();

  try {
    const existing = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'dispatched') {
        updates.push("dispatched_at = datetime('now')");
      }
      if (status === 'completed') {
        updates.push("completed_at = datetime('now')");
      }
    }
    if (vendor_id !== undefined) {
      updates.push('vendor_id = ?');
      params.push(vendor_id);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (cost !== undefined) {
      updates.push('cost = ?');
      params.push(cost);
    }
    if (vendor_eta !== undefined) {
      updates.push('vendor_eta = ?');
      params.push(vendor_eta);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } finally {
    db.close();
  }
});

// POST /api/work-orders/:id/approve — approve for dispatch
router.post('/:id/approve', async (req, res) => {
  const db = getDb();

  try {
    const wo = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
    if (!wo) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    if (wo.status !== 'new') {
      return res.status(400).json({ error: `Cannot approve work order with status "${wo.status}"` });
    }

    db.prepare(`
      UPDATE work_orders SET status = 'dispatched', dispatched_at = datetime('now') WHERE id = ?
    `).run(req.params.id);

    // If no vendor assigned, try to match one
    if (!wo.vendor_id) {
      const { matchVendor } = require('../services/vendor');
      const vendor = matchVendor(wo.category, wo.property_id, wo.priority);
      if (vendor) {
        db.prepare('UPDATE work_orders SET vendor_id = ? WHERE id = ?').run(vendor.id, req.params.id);
      }
    }

    const updated = db.prepare(`
      SELECT wo.*, v.company_name as vendor_name, v.phone as vendor_phone
      FROM work_orders wo
      LEFT JOIN vendors v ON wo.vendor_id = v.id
      WHERE wo.id = ?
    `).get(req.params.id);

    console.log(`[APPROVED] Work order #${req.params.id} dispatched`);

    // Send dispatch SMS notifications
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(wo.tenant_id);
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(wo.unit_id);
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(wo.property_id);
    const vendor = updated.vendor_id
      ? db.prepare('SELECT * FROM vendors WHERE id = ?').get(updated.vendor_id)
      : null;

    if (vendor && tenant) {
      const woData = {
        id: updated.id,
        category: updated.category,
        priority: updated.priority,
        tenant_message: updated.tenant_message,
        description: updated.description,
        ai_classification: updated.ai_classification,
      };

      await notifyVendorDispatch({ vendor, workOrder: woData, tenant, property, unit });
      await notifyTenantDispatch({ tenant, vendor, workOrder: woData });

      if (updated.priority === 'emergency') {
        await notifyOwnerEmergency({ tenant, vendor, workOrder: woData, property, unit });
      }
    }

    res.json({ message: 'Work order approved and dispatched', work_order: updated });
  } finally {
    db.close();
  }
});

module.exports = router;
