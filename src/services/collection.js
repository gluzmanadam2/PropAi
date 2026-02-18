const { getDb } = require('../db/schema');
const { sendMessage, notifyOwner } = require('./sms');
const config = require('../config/collectionConfig');

/**
 * Generate monthly rent ledger entries for all occupied units.
 * Autopay tenants (direct_deposit/online) are marked as paid.
 */
function generateMonthlyLedger(month, year) {
  const db = getDb();
  try {
    // Get all occupied units with current tenants
    const tenants = db.prepare(`
      SELECT t.id as tenant_id, t.unit_id, t.rent_amount, t.payment_method, t.first_name, t.last_name
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      WHERE t.status IN ('current', 'notice') AND u.status IN ('occupied', 'notice')
    `).all();

    let created = 0;
    let skipped = 0;

    for (const t of tenants) {
      // Check if entry already exists (idempotent)
      const existing = db.prepare(
        'SELECT id FROM rent_ledger WHERE tenant_id = ? AND month = ? AND year = ?'
      ).get(t.tenant_id, month, year);

      if (existing) {
        skipped++;
        continue;
      }

      const isAutopay = t.payment_method === 'direct_deposit' || t.payment_method === 'online';

      db.prepare(`
        INSERT INTO rent_ledger (tenant_id, unit_id, month, year, amount_due, amount_paid, date_paid, payment_method, status, late_fee, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        t.tenant_id,
        t.unit_id,
        month,
        year,
        t.rent_amount,
        isAutopay ? t.rent_amount : 0,
        isAutopay ? `${year}-${String(month).padStart(2, '0')}-01` : null,
        isAutopay ? t.payment_method : null,
        isAutopay ? 'paid' : 'unpaid',
        isAutopay ? `Auto-paid via ${t.payment_method}` : null
      );
      created++;
    }

    console.log(`[COLLECTION] Generated ledger for ${month}/${year}: ${created} created, ${skipped} skipped (already exist)`);
    return { created, skipped, total: tenants.length };
  } finally {
    db.close();
  }
}

/**
 * Main dispatcher. Uses >= checks so missed days catch up.
 */
async function runCollectionDay(dayOfMonth, month, year) {
  const results = {};

  if (dayOfMonth >= config.reminder_1_day) {
    results.reminders_1 = await sendFriendlyReminders(month, year);
  }
  if (dayOfMonth >= config.reminder_2_day) {
    results.reminders_2 = await sendSecondReminders(month, year);
  }
  if (dayOfMonth >= config.late_fee_day) {
    results.late_fees = await applyLateFees(month, year);
  }
  if (dayOfMonth >= config.reminder_3_day) {
    results.formal_notices = await sendFormalNotice(month, year);
  }
  if (dayOfMonth >= config.escalation_day) {
    results.escalations = await flagForPayOrQuit(month, year);
  }

  console.log(`[COLLECTION] Day ${dayOfMonth} of ${month}/${year} complete:`, results);
  return results;
}

/**
 * Day 1+: Send friendly reminders to unpaid tenants.
 */
async function sendFriendlyReminders(month, year) {
  const db = getDb();
  try {
    const unpaid = db.prepare(`
      SELECT rl.id as ledger_id, rl.amount_due, t.id as tenant_id, t.first_name, t.last_name, t.phone
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid')
    `).all(month, year);

    let sent = 0;
    for (const tenant of unpaid) {
      // Check if reminder_1 already sent for this month (idempotent)
      const existing = db.prepare(
        "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'reminder_1' AND month = ? AND year = ? AND notes = 'Automated first reminder'"
      ).get(tenant.tenant_id, month, year);

      if (existing) continue;

      const message = `Hi ${tenant.first_name}, this is a friendly reminder that your rent payment of $${tenant.amount_due} for ${month}/${year} is due. Please submit payment at your earliest convenience. If you have already paid, please disregard this message. — Management`;

      await sendMessage(tenant.phone, message, {
        tenantId: tenant.tenant_id,
        classification: 'rent_question',
        context: 'collection_reminder_1',
      });

      db.prepare(`
        INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
        VALUES (?, 'reminder_1', ?, datetime('now'), 0, 'Automated first reminder', ?, ?, ?)
      `).run(tenant.tenant_id, message, tenant.ledger_id, month, year);

      sent++;
    }

    console.log(`[COLLECTION] Friendly reminders: ${sent} sent`);
    return { sent, total_unpaid: unpaid.length };
  } finally {
    db.close();
  }
}

/**
 * Day 3+: Send second reminders to still-unpaid tenants.
 */
async function sendSecondReminders(month, year) {
  const db = getDb();
  try {
    const unpaid = db.prepare(`
      SELECT rl.id as ledger_id, rl.amount_due, t.id as tenant_id, t.first_name, t.last_name, t.phone
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid')
    `).all(month, year);

    let sent = 0;
    for (const tenant of unpaid) {
      const existing = db.prepare(
        "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'reminder_1' AND month = ? AND year = ? AND notes = 'Automated second reminder'"
      ).get(tenant.tenant_id, month, year);

      if (existing) continue;

      const message = `Hi ${tenant.first_name}, this is a second reminder that your rent of $${tenant.amount_due} for ${month}/${year} remains unpaid. The grace period ends on the 5th — after that, a $${config.late_fee_base} late fee will apply. Please pay as soon as possible. — Management`;

      await sendMessage(tenant.phone, message, {
        tenantId: tenant.tenant_id,
        classification: 'rent_question',
        context: 'collection_reminder_2',
      });

      db.prepare(`
        INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
        VALUES (?, 'reminder_1', ?, datetime('now'), 0, 'Automated second reminder', ?, ?, ?)
      `).run(tenant.tenant_id, message, tenant.ledger_id, month, year);

      sent++;
    }

    console.log(`[COLLECTION] Second reminders: ${sent} sent`);
    return { sent, total_unpaid: unpaid.length };
  } finally {
    db.close();
  }
}

/**
 * Day 5+: Apply late fees, update status to 'late', send late notice.
 */
async function applyLateFees(month, year) {
  const db = getDb();
  try {
    const unpaid = db.prepare(`
      SELECT rl.id as ledger_id, rl.amount_due, rl.late_fee, t.id as tenant_id, t.first_name, t.last_name, t.phone
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid') AND rl.late_fee = 0
    `).all(month, year);

    let applied = 0;
    for (const tenant of unpaid) {
      // Check if reminder_2 already logged for this month (idempotent)
      const existing = db.prepare(
        "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'reminder_2' AND month = ? AND year = ?"
      ).get(tenant.tenant_id, month, year);

      if (existing) continue;

      // Apply late fee and update status
      db.prepare(
        "UPDATE rent_ledger SET late_fee = ?, status = 'late' WHERE id = ?"
      ).run(config.late_fee_base, tenant.ledger_id);

      const totalOwed = tenant.amount_due + config.late_fee_base;
      const message = `${tenant.first_name}, a late fee of $${config.late_fee_base} has been applied to your account. Your total balance is now $${totalOwed} for ${month}/${year}. Please contact us if you need to discuss payment options. — Management`;

      await sendMessage(tenant.phone, message, {
        tenantId: tenant.tenant_id,
        classification: 'rent_question',
        context: 'collection_late_fee',
      });

      db.prepare(`
        INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
        VALUES (?, 'reminder_2', ?, datetime('now'), 0, 'Late fee applied', ?, ?, ?)
      `).run(tenant.tenant_id, message, tenant.ledger_id, month, year);

      applied++;
    }

    console.log(`[COLLECTION] Late fees applied: ${applied}`);
    return { applied, total_unpaid: unpaid.length };
  } finally {
    db.close();
  }
}

/**
 * Day 7+: Send formal notice, notify owner per tenant.
 */
async function sendFormalNotice(month, year) {
  const db = getDb();
  try {
    const delinquent = db.prepare(`
      SELECT rl.id as ledger_id, rl.amount_due, rl.late_fee, t.id as tenant_id, t.first_name, t.last_name, t.phone,
             u.unit_number, p.address
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      JOIN units u ON rl.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid', 'late')
    `).all(month, year);

    let sent = 0;
    for (const tenant of delinquent) {
      const existing = db.prepare(
        "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'reminder_3' AND month = ? AND year = ?"
      ).get(tenant.tenant_id, month, year);

      if (existing) continue;

      const totalOwed = tenant.amount_due + tenant.late_fee;
      const message = `FORMAL NOTICE: ${tenant.first_name} ${tenant.last_name}, your rent of $${totalOwed} (including fees) for ${month}/${year} is seriously past due. Failure to pay may result in further legal action under Maine law. Please contact management immediately to resolve this. — PropAI Management`;

      await sendMessage(tenant.phone, message, {
        tenantId: tenant.tenant_id,
        classification: 'rent_question',
        context: 'collection_formal_notice',
      });

      db.prepare(`
        INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
        VALUES (?, 'reminder_3', ?, datetime('now'), 0, 'Formal notice sent', ?, ?, ?)
      `).run(tenant.tenant_id, message, tenant.ledger_id, month, year);

      // Notify owner
      await notifyOwner(
        `Formal notice sent to ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number}. Owes $${totalOwed} for ${month}/${year}.`,
        { tenantId: tenant.tenant_id }
      );

      sent++;
    }

    console.log(`[COLLECTION] Formal notices: ${sent} sent`);
    return { sent, total_delinquent: delinquent.length };
  } finally {
    db.close();
  }
}

/**
 * Day 10+: Create approval_needed notification for owner. Do NOT send notice directly.
 */
async function flagForPayOrQuit(month, year) {
  const db = getDb();
  try {
    const delinquent = db.prepare(`
      SELECT rl.id as ledger_id, rl.amount_due, rl.late_fee, t.id as tenant_id, t.first_name, t.last_name, t.phone,
             u.unit_number, p.address
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      JOIN units u ON rl.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid', 'late')
    `).all(month, year);

    let flagged = 0;
    for (const tenant of delinquent) {
      const existing = db.prepare(
        "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'escalated' AND month = ? AND year = ?"
      ).get(tenant.tenant_id, month, year);

      if (existing) continue;

      const totalOwed = tenant.amount_due + tenant.late_fee;

      // Log escalation action
      db.prepare(`
        INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
        VALUES (?, 'escalated', NULL, datetime('now'), 0, 'Flagged for pay-or-quit — awaiting owner approval', ?, ?, ?)
      `).run(tenant.tenant_id, tenant.ledger_id, month, year);

      // Create notification for owner approval
      const notifMessage = `PAY-OR-QUIT APPROVAL NEEDED: ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number} owes $${totalOwed} for ${month}/${year}. Approve sending 7-day pay-or-quit notice via POST /api/collection/${tenant.tenant_id}/approve-pay-or-quit`;

      db.prepare(`
        INSERT INTO notifications (type, recipient, message, status, created_at, related_tenant_id)
        VALUES ('approval_needed', 'owner', ?, 'pending', datetime('now'), ?)
      `).run(notifMessage, tenant.tenant_id);

      // SMS the owner
      await notifyOwner(notifMessage, { tenantId: tenant.tenant_id });

      flagged++;
    }

    console.log(`[COLLECTION] Escalations flagged: ${flagged}`);
    return { flagged, total_delinquent: delinquent.length };
  } finally {
    db.close();
  }
}

/**
 * Send pay-or-quit notice (called on owner approval).
 * Generates Maine Title 14 §6002 compliant notice.
 */
async function sendPayOrQuit(tenantId, month, year) {
  const db = getDb();
  try {
    const tenant = db.prepare(`
      SELECT t.*, u.unit_number, p.address
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = ?
    `).get(tenantId);

    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const ledger = db.prepare(
      'SELECT * FROM rent_ledger WHERE tenant_id = ? AND month = ? AND year = ?'
    ).get(tenantId, month, year);

    if (!ledger) throw new Error(`No ledger entry for tenant ${tenantId} for ${month}/${year}`);

    // Check if already sent
    const existing = db.prepare(
      "SELECT id FROM collection_actions WHERE tenant_id = ? AND action_type = 'pay_or_quit' AND month = ? AND year = ?"
    ).get(tenantId, month, year);

    if (existing) {
      return { already_sent: true, action_id: existing.id };
    }

    const totalOwed = ledger.amount_due - ledger.amount_paid + ledger.late_fee;
    const cureDays = config.pay_or_quit_cure_days;

    const message = `NOTICE TO PAY RENT OR QUIT — ${tenant.first_name} ${tenant.last_name}, ${tenant.address} Unit ${tenant.unit_number}: Pursuant to Maine Title 14 §6002, you are hereby given ${cureDays} days' notice to pay the total amount of $${totalOwed} owed for ${month}/${year}, or vacate the premises. This notice is a required step before any eviction proceeding may be filed. Please contact management immediately. — PropAI Management`;

    await sendMessage(tenant.phone, message, {
      tenantId: tenant.id,
      classification: 'rent_question',
      context: 'collection_pay_or_quit',
    });

    const result = db.prepare(`
      INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, notes, ledger_id, month, year)
      VALUES (?, 'pay_or_quit', ?, datetime('now'), 0, 'Pay-or-quit notice sent (Maine Title 14 §6002, ${cureDays}-day cure)', ?, ?, ?)
    `).run(tenantId, message, ledger.id, month, year);

    console.log(`[COLLECTION] Pay-or-quit notice sent to ${tenant.first_name} ${tenant.last_name}`);
    return { sent: true, action_id: result.lastInsertRowid, tenant: `${tenant.first_name} ${tenant.last_name}` };
  } finally {
    db.close();
  }
}

/**
 * Record a payment against a ledger entry.
 */
function recordPayment(ledgerId, amount, paymentMethod, notes) {
  const db = getDb();
  try {
    const ledger = db.prepare('SELECT * FROM rent_ledger WHERE id = ?').get(ledgerId);
    if (!ledger) throw new Error(`Ledger entry ${ledgerId} not found`);

    const newPaid = ledger.amount_paid + amount;
    const totalDue = ledger.amount_due + ledger.late_fee;
    const newStatus = newPaid >= totalDue ? 'paid' : 'partial';

    db.prepare(`
      UPDATE rent_ledger SET amount_paid = ?, date_paid = datetime('now'), payment_method = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(newPaid, paymentMethod, newStatus, notes || null, ledgerId);

    console.log(`[COLLECTION] Payment recorded: $${amount} on ledger #${ledgerId} — status: ${newStatus}`);
    return {
      ledger_id: ledgerId,
      amount_paid: newPaid,
      total_due: totalDue,
      status: newStatus,
      remaining: Math.max(0, totalDue - newPaid),
    };
  } finally {
    db.close();
  }
}

/**
 * Create a payment plan for a delinquent tenant.
 */
async function createPaymentPlan(tenantId, ledgerId, initialPayment, monthlyInstallment, numInstallments, notes) {
  const db = getDb();
  try {
    const ledger = db.prepare('SELECT * FROM rent_ledger WHERE id = ?').get(ledgerId);
    if (!ledger) throw new Error(`Ledger entry ${ledgerId} not found`);

    const tenant = db.prepare(`
      SELECT t.*, u.unit_number, p.address
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = ?
    `).get(tenantId);

    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const totalOwed = ledger.amount_due - ledger.amount_paid + ledger.late_fee;

    const result = db.prepare(`
      INSERT INTO payment_plans (tenant_id, ledger_id, total_owed, initial_payment, monthly_installment, num_installments, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(tenantId, ledgerId, totalOwed, initialPayment, monthlyInstallment, numInstallments, notes || null);

    // Notify owner
    const planMessage = `Payment plan requested for ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number}. Total owed: $${totalOwed}. Initial payment: $${initialPayment}, then $${monthlyInstallment}/mo x ${numInstallments}. Plan ID: ${result.lastInsertRowid}. Notes: ${notes || 'None'}`;

    await notifyOwner(planMessage, { tenantId });

    console.log(`[COLLECTION] Payment plan created #${result.lastInsertRowid} for tenant ${tenantId}`);
    return {
      plan_id: result.lastInsertRowid,
      tenant: `${tenant.first_name} ${tenant.last_name}`,
      total_owed: totalOwed,
      initial_payment: initialPayment,
      monthly_installment: monthlyInstallment,
      num_installments: numInstallments,
    };
  } finally {
    db.close();
  }
}

/**
 * Get all delinquent tenants for a given month with collection history.
 */
function getDelinquentTenants(month, year) {
  const db = getDb();
  try {
    const delinquent = db.prepare(`
      SELECT rl.*, t.first_name, t.last_name, t.phone, t.email, t.payment_method as tenant_payment_method,
             u.unit_number, p.address, p.name as property_name
      FROM rent_ledger rl
      JOIN tenants t ON rl.tenant_id = t.id
      JOIN units u ON rl.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE rl.month = ? AND rl.year = ? AND rl.status IN ('unpaid', 'late', 'partial')
      ORDER BY rl.status, p.address, u.unit_number
    `).all(month, year);

    // Attach collection actions for each tenant
    for (const entry of delinquent) {
      entry.collection_actions = db.prepare(
        'SELECT * FROM collection_actions WHERE tenant_id = ? AND month = ? AND year = ? ORDER BY sent_at'
      ).all(entry.tenant_id, month, year);

      entry.total_owed = entry.amount_due - entry.amount_paid + entry.late_fee;
    }

    return delinquent;
  } finally {
    db.close();
  }
}

module.exports = {
  generateMonthlyLedger,
  runCollectionDay,
  sendPayOrQuit,
  recordPayment,
  createPaymentPlan,
  getDelinquentTenants,
};
