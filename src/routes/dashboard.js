const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  const db = getDb();
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const totalUnits = db.prepare('SELECT COUNT(*) as count FROM units').get().count;
    const occupiedUnits = db.prepare("SELECT COUNT(*) as count FROM units WHERE status = 'occupied'").get().count;
    const vacantUnits = db.prepare("SELECT COUNT(*) as count FROM units WHERE status = 'vacant'").get().count;
    const noticeUnits = db.prepare("SELECT COUNT(*) as count FROM units WHERE status = 'notice'").get().count;

    const occupancyRate = totalUnits > 0 ? ((occupiedUnits + noticeUnits) / totalUnits * 100).toFixed(1) : 0;

    const totalTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status IN ('current', 'notice')").get().count;

    // Work order stats
    const activeWorkOrders = db.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('new', 'dispatched', 'in_progress')").get().count;
    const emergencyWorkOrders = db.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('new', 'dispatched', 'in_progress') AND priority = 'emergency'").get().count;
    const newWorkOrders = db.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'new'").get().count;

    // Rent collection for current month
    const rentStats = db.prepare(`
      SELECT
        COUNT(*) as total_entries,
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_collected,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(late_fee) as total_late_fees
      FROM rent_ledger
      WHERE month = ? AND year = ?
    `).get(currentMonth, currentYear);

    const collectionRate = rentStats.total_due > 0
      ? (rentStats.total_collected / rentStats.total_due * 100).toFixed(1)
      : 0;

    // Pending notifications
    const pendingNotifications = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'").get().count;

    // Revenue summary
    const monthlyRevenuePotential = db.prepare(`
      SELECT SUM(market_rent) as total FROM units WHERE status != 'vacant'
    `).get().total || 0;

    res.json({
      portfolio: {
        total_properties: db.prepare('SELECT COUNT(*) as count FROM properties').get().count,
        total_units: totalUnits,
        occupied_units: occupiedUnits,
        vacant_units: vacantUnits,
        notice_units: noticeUnits,
        occupancy_rate: parseFloat(occupancyRate),
        total_tenants: totalTenants,
      },
      work_orders: {
        active: activeWorkOrders,
        emergency: emergencyWorkOrders,
        awaiting_approval: newWorkOrders,
      },
      rent_collection: {
        month: currentMonth,
        year: currentYear,
        total_due: rentStats.total_due || 0,
        total_collected: rentStats.total_collected || 0,
        collection_rate: parseFloat(collectionRate),
        paid: rentStats.paid_count || 0,
        unpaid: rentStats.unpaid_count || 0,
        late: rentStats.late_count || 0,
        partial: rentStats.partial_count || 0,
        late_fees_assessed: rentStats.total_late_fees || 0,
      },
      notifications: {
        pending: pendingNotifications,
      },
      monthly_revenue_potential: monthlyRevenuePotential,
    });
  } finally {
    db.close();
  }
});

module.exports = router;
