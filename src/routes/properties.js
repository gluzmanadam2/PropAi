const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/properties — list all with unit counts and occupancy
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const properties = db.prepare(`
      SELECT p.*,
        COUNT(u.id) as total_units,
        SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
        SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
        SUM(CASE WHEN u.status = 'notice' THEN 1 ELSE 0 END) as notice_units,
        SUM(CASE WHEN u.status = 'turnover' THEN 1 ELSE 0 END) as turnover_units,
        SUM(CASE WHEN u.status != 'vacant' THEN u.market_rent ELSE 0 END) as monthly_rent
      FROM properties p
      LEFT JOIN units u ON p.id = u.property_id
      GROUP BY p.id
      ORDER BY p.city, p.address
    `).all();

    // Attach vacant unit details for each property with vacancies
    const vacantUnitsStmt = db.prepare(`
      SELECT id, unit_number, bedrooms, bathrooms, sqft, market_rent
      FROM units WHERE property_id = ? AND status = 'vacant'
      ORDER BY unit_number
    `);

    for (const prop of properties) {
      if (prop.vacant_units > 0) {
        prop.vacant_unit_details = vacantUnitsStmt.all(prop.id);
      }
    }

    res.json({ count: properties.length, properties });
  } finally {
    db.close();
  }
});

module.exports = router;
