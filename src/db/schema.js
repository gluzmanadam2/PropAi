const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'propai.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      units_count INTEGER NOT NULL DEFAULT 0,
      property_type TEXT NOT NULL DEFAULT 'residential',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      unit_number TEXT NOT NULL,
      bedrooms INTEGER NOT NULL DEFAULT 1,
      bathrooms REAL NOT NULL DEFAULT 1,
      sqft INTEGER,
      market_rent REAL,
      status TEXT NOT NULL DEFAULT 'vacant' CHECK(status IN ('occupied','vacant','notice','turnover')),
      features TEXT,
      notes TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER,
      property_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      rent_amount REAL,
      deposit_amount REAL,
      lease_start TEXT,
      lease_end TEXT,
      move_in_date TEXT,
      pet_info TEXT,
      vehicle_info TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'current' CHECK(status IN ('current','notice','past')),
      notes TEXT,
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      specialty TEXT NOT NULL,
      hourly_rate REAL,
      emergency_available INTEGER NOT NULL DEFAULT 0,
      insurance_expiry TEXT,
      service_area TEXT,
      performance_score REAL DEFAULT 5.0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      unit_id INTEGER,
      property_id INTEGER,
      vendor_id INTEGER,
      category TEXT CHECK(category IN ('plumbing','electrical','hvac','locksmith','pest','appliance','general')),
      priority TEXT CHECK(priority IN ('emergency','urgent','standard','low')),
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','dispatched','in_progress','completed','cancelled')),
      description TEXT,
      tenant_message TEXT,
      ai_classification TEXT,
      vendor_eta TEXT,
      cost REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      dispatched_at TEXT,
      completed_at TEXT,
      notes TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
      message TEXT NOT NULL,
      classification TEXT CHECK(classification IN ('maintenance','rent_question','general_inquiry','noise_complaint','lease_question','move_out_notice','emergency','unknown','payment_confirmation','payment_plan_request')),
      ai_response TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS rent_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount_due REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      date_paid TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('paid','partial','unpaid','late')),
      late_fee REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('emergency','approval_needed','info')),
      recipient TEXT NOT NULL CHECK(recipient IN ('owner','manager')),
      message TEXT NOT NULL,
      related_work_order_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','acknowledged')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      FOREIGN KEY (related_work_order_id) REFERENCES work_orders(id)
    );

    CREATE TABLE IF NOT EXISTS collection_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN ('reminder_1','reminder_2','reminder_3','pay_or_quit','escalated')),
      message_sent TEXT,
      sent_at TEXT,
      tenant_responded INTEGER DEFAULT 0,
      response TEXT,
      notes TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS property_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      policy_type TEXT NOT NULL CHECK(policy_type IN ('late_fee','pet','quiet_hours','parking','smoking','insurance','general')),
      policy_text TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS sms_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_phone TEXT NOT NULL,
      from_phone TEXT NOT NULL,
      body TEXT NOT NULL,
      context TEXT,
      twilio_sid TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      applicant_name TEXT NOT NULL,
      applicant_phone TEXT,
      applicant_email TEXT,
      desired_move_in TEXT,
      monthly_income REAL,
      credit_score INTEGER,
      background_check TEXT DEFAULT 'pending' CHECK(background_check IN ('pending','passed','failed','waived')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','approved','denied','withdrawn')),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      denied_reason TEXT,
      notes TEXT,
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS payment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      ledger_id INTEGER NOT NULL,
      total_owed REAL NOT NULL,
      initial_payment REAL DEFAULT 0,
      monthly_installment REAL NOT NULL,
      num_installments INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','completed','defaulted')),
      approved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at TEXT,
      next_due_date TEXT,
      notes TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (ledger_id) REFERENCES rent_ledger(id)
    );
  `);

  // Add columns via ALTER TABLE (safe to fail if they already exist)
  const alterStatements = [
    "ALTER TABLE collection_actions ADD COLUMN ledger_id INTEGER REFERENCES rent_ledger(id)",
    "ALTER TABLE collection_actions ADD COLUMN month INTEGER",
    "ALTER TABLE collection_actions ADD COLUMN year INTEGER",
    "ALTER TABLE notifications ADD COLUMN related_tenant_id INTEGER REFERENCES tenants(id)",
  ];

  for (const sql of alterStatements) {
    try {
      db.exec(sql);
    } catch (e) {
      // Column already exists — ignore
    }
  }

  db.close();
}

module.exports = { getDb, initializeDatabase, DB_PATH };
