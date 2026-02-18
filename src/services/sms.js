const twilio = require('twilio');
const { getDb } = require('../db/schema');

let twilioClient = null;

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function isTwilioConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phone = process.env.TWILIO_PHONE_NUMBER;
  return sid && sid !== 'placeholder' &&
         token && token !== 'placeholder' &&
         phone && phone !== 'placeholder';
}

function getClient() {
  if (!twilioClient && isTwilioConfigured()) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

/**
 * Send an SMS message via Twilio (or console.log if not configured).
 * @param {string} to - Recipient phone number
 * @param {string} body - Message text
 * @param {object} [options] - Optional metadata
 * @param {number} [options.tenantId] - Related tenant ID for conversation logging
 * @param {string} [options.classification] - Message classification
 * @param {string} [options.context] - What triggered this message
 * @returns {Promise<{success: boolean, sid?: string, stub?: boolean}>}
 */
async function sendMessage(to, body, options = {}) {
  const { tenantId, classification, context } = options;
  const normalizedTo = normalizePhone(to);
  const fromPhone = process.env.TWILIO_PHONE_NUMBER || 'not_configured';

  // Log to conversations table if tenantId is provided
  if (tenantId) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO conversations (tenant_id, direction, message, classification, ai_response, created_at)
        VALUES (?, 'outbound', ?, ?, ?, datetime('now'))
      `).run(tenantId, body, classification || null, body);
    } finally {
      db.close();
    }
  }

  // Log to sms_log table
  const db = getDb();
  let logId;
  try {
    const result = db.prepare(`
      INSERT INTO sms_log (to_phone, from_phone, body, context, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    `).run(normalizedTo, fromPhone, body, context || null);
    logId = result.lastInsertRowid;
  } finally {
    db.close();
  }

  if (!isTwilioConfigured()) {
    console.log(`[TWILIO STUB] Would send to ${to}: "${body}"`);
    return { success: true, stub: true };
  }

  try {
    const client = getClient();
    const result = await client.messages.create({
      body,
      from: normalizePhone(fromPhone),
      to: normalizedTo,
    });
    console.log(`[SMS SENT] To ${to}, SID: ${result.sid}`);

    // Update sms_log status
    const db2 = getDb();
    try {
      db2.prepare('UPDATE sms_log SET status = ?, twilio_sid = ? WHERE id = ?')
        .run('sent', result.sid, logId);
    } finally {
      db2.close();
    }

    return { success: true, sid: result.sid };
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send to ${to}: ${err.message}`);

    const db2 = getDb();
    try {
      db2.prepare('UPDATE sms_log SET status = ? WHERE id = ?').run('failed', logId);
    } finally {
      db2.close();
    }

    return { success: false, error: err.message };
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate TwiML XML response for Twilio webhook.
 * @param {string} body - Response message text
 * @returns {string} TwiML XML string
 */
function twimlResponse(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escapeXml(body)}</Message>\n</Response>`;
}

/**
 * Notify the property owner via SMS.
 */
async function notifyOwner(message, options = {}) {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone || ownerPhone === 'placeholder') {
    console.log(`[OWNER NOTIFY STUB] ${message}`);
    return { success: true, stub: true };
  }
  return sendMessage(ownerPhone, message, { ...options, context: 'owner_alert' });
}

/**
 * Notify the property manager via SMS.
 */
async function notifyManager(message, options = {}) {
  const managerPhone = process.env.MANAGER_PHONE;
  if (!managerPhone || managerPhone === 'placeholder') {
    console.log(`[MANAGER NOTIFY STUB] ${message}`);
    return { success: true, stub: true };
  }
  return sendMessage(managerPhone, message, { ...options, context: 'manager_alert' });
}

/**
 * Send vendor dispatch notification.
 */
async function notifyVendorDispatch({ vendor, workOrder, tenant, property, unit }) {
  const priorityLabel = (workOrder.priority || 'STANDARD').toUpperCase();
  const message = `[${priorityLabel}] Work Order #${workOrder.id} — ${workOrder.category} at ${property.address} Unit ${unit.unit_number}. Tenant: ${tenant.first_name} ${tenant.last_name}. Issue: ${workOrder.tenant_message || workOrder.description}. Please confirm availability and provide ETA by replying to this message.`;

  return sendMessage(vendor.phone, message, {
    context: 'vendor_dispatch',
  });
}

/**
 * Send tenant dispatch confirmation.
 */
async function notifyTenantDispatch({ tenant, vendor, workOrder }) {
  const etaMap = {
    emergency: '30 minutes',
    urgent: '4 hours',
    standard: '1-2 business days',
    low: '3-5 business days',
  };
  const eta = etaMap[workOrder.priority] || '1-2 business days';
  const vendorName = vendor ? vendor.company_name : 'a maintenance technician';
  const message = `Hi ${tenant.first_name}, we've dispatched ${vendorName} for your ${workOrder.category} issue. Expected response time: ${eta}. We'll update you when the technician confirms their schedule. — PropAI Management`;

  return sendMessage(tenant.phone, message, {
    tenantId: tenant.id,
    classification: workOrder.ai_classification,
    context: 'tenant_dispatch_confirmation',
  });
}

/**
 * Send owner emergency alert.
 */
async function notifyOwnerEmergency({ tenant, vendor, workOrder, property, unit }) {
  const vendorName = vendor ? vendor.company_name : 'No vendor assigned';
  const message = `\u26A0\uFE0F EMERGENCY: ${workOrder.category} issue at ${property.address} Unit ${unit.unit_number}. ${vendorName} auto-dispatched. Tenant: ${tenant.first_name} ${tenant.last_name}. Issue: ${workOrder.tenant_message || workOrder.description}`;

  return notifyOwner(message, { tenantId: tenant.id });
}

module.exports = {
  sendMessage,
  twimlResponse,
  isTwilioConfigured,
  normalizePhone,
  notifyOwner,
  notifyManager,
  notifyVendorDispatch,
  notifyTenantDispatch,
  notifyOwnerEmergency,
};
