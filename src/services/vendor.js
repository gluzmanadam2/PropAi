const { getDb } = require('../db/schema');

function matchVendor(category, propertyId, priority) {
  const db = getDb();

  try {
    // Map category to vendor specialty
    const specialty = category;

    let vendors;
    if (priority === 'emergency') {
      // For emergencies, prioritize vendors who handle emergencies, sorted by performance
      vendors = db.prepare(`
        SELECT * FROM vendors
        WHERE specialty = ?
        ORDER BY emergency_available DESC, performance_score DESC
        LIMIT 5
      `).all(specialty);
    } else {
      // For non-emergencies, sort by performance score
      vendors = db.prepare(`
        SELECT * FROM vendors
        WHERE specialty = ?
        ORDER BY performance_score DESC
        LIMIT 5
      `).all(specialty);
    }

    // If no specialty match, try general maintenance vendors
    if (vendors.length === 0) {
      vendors = db.prepare(`
        SELECT * FROM vendors
        WHERE specialty = 'general'
        ORDER BY performance_score DESC
        LIMIT 3
      `).all();
    }

    return vendors.length > 0 ? vendors[0] : null;
  } finally {
    db.close();
  }
}

module.exports = { matchVendor };
