const { Router } = require('express');
const { getDb } = require('../db/schema');
const { classifyMessage, generateResponse } = require('../services/ai');
const { matchVendor } = require('../services/vendor');
const { sendMessage, twimlResponse, notifyVendorDispatch, notifyTenantDispatch, notifyOwnerEmergency, notifyOwner } = require('../services/sms');

const router = Router();

// POST /webhook/inbound — receives inbound messages (Twilio + JSON)
router.post('/inbound', async (req, res) => {
  const { From, Body, from, body } = req.body;
  const phone = From || from;
  const message = Body || body;

  // Detect if this is a real Twilio webhook (vs JSON test request)
  const isTwilioRequest = !!(req.body.AccountSid || req.body.MessageSid);

  if (!phone || !message) {
    if (isTwilioRequest) {
      return res.type('text/xml').send(twimlResponse('Invalid request. Please send a text message.'));
    }
    return res.status(400).json({ error: 'Missing "from" (phone) and "body" (message) fields' });
  }

  const db = getDb();

  try {
    // Look up tenant by phone
    const tenant = db.prepare(`
      SELECT t.*, u.unit_number, p.address, p.name as property_name, p.id as prop_id
      FROM tenants t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON t.property_id = p.id
      WHERE t.phone = ?
    `).get(phone);

    if (!tenant) {
      console.log(`[WEBHOOK] Unknown sender: ${phone}`);
      const unknownResponse = 'Thank you for reaching out. This number is for current tenants of our managed properties. If you\'re interested in leasing, please visit https://propai.example.com/leasing or reply LEASING for more information.';

      if (isTwilioRequest) {
        return res.type('text/xml').send(twimlResponse(unknownResponse));
      }
      return res.status(200).json({
        status: 'received',
        note: 'Sender not recognized as a tenant',
        phone,
      });
    }

    console.log(`\n[INBOUND] From: ${tenant.first_name} ${tenant.last_name} (${phone})`);
    console.log(`[INBOUND] Message: "${message}"`);

    // Step 1: Classify the message with AI
    const classification = await classifyMessage(message, {
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      unit_number: tenant.unit_number,
      address: tenant.address,
      rent_amount: tenant.rent_amount,
      lease_end: tenant.lease_end,
      status: tenant.status,
    });

    console.log(`[AI] Classification: ${classification.classification}, Priority: ${classification.priority}, Category: ${classification.category}`);
    console.log(`[AI] Reasoning: ${classification.reasoning}`);
    console.log(`[AI] Requires human: ${classification.requires_human}`);

    // Step 2: Log inbound conversation
    db.prepare(`
      INSERT INTO conversations (tenant_id, direction, message, classification, ai_response, created_at)
      VALUES (?, 'inbound', ?, ?, NULL, datetime('now'))
    `).run(tenant.id, message, classification.classification);

    // Step 3: Build additional context for response generation
    let additionalContext = '';

    if (classification.classification === 'rent_question') {
      const ledger = db.prepare(`
        SELECT * FROM rent_ledger
        WHERE tenant_id = ? AND month = ? AND year = ?
      `).get(tenant.id, new Date().getMonth() + 1, new Date().getFullYear());

      if (ledger) {
        additionalContext = `Current month rent status: $${ledger.amount_due} due, $${ledger.amount_paid} paid, status: ${ledger.status}. Late fee: $${ledger.late_fee}.`;
      }
    }

    if (classification.classification === 'payment_confirmation') {
      const ledger = db.prepare(`
        SELECT * FROM rent_ledger
        WHERE tenant_id = ? AND month = ? AND year = ?
      `).get(tenant.id, new Date().getMonth() + 1, new Date().getFullYear());

      if (ledger) {
        additionalContext = `Current month rent status: $${ledger.amount_due} due, $${ledger.amount_paid} paid, status: ${ledger.status}. Late fee: $${ledger.late_fee}.`;
      }

      // Mark any open collection actions as responded
      db.prepare(
        "UPDATE collection_actions SET tenant_responded = 1, response = ? WHERE tenant_id = ? AND tenant_responded = 0"
      ).run(message, tenant.id);

      // Create notification for manual payment verification
      db.prepare(`
        INSERT INTO notifications (type, recipient, message, status, created_at, related_tenant_id)
        VALUES ('approval_needed', 'owner', ?, 'pending', datetime('now'), ?)
      `).run(
        `PAYMENT VERIFICATION NEEDED: ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number} says they paid rent. Message: "${message}". Please verify payment and update ledger.`,
        tenant.id
      );
    }

    if (classification.classification === 'payment_plan_request') {
      const ledger = db.prepare(`
        SELECT * FROM rent_ledger
        WHERE tenant_id = ? AND month = ? AND year = ?
      `).get(tenant.id, new Date().getMonth() + 1, new Date().getFullYear());

      const totalOwed = ledger
        ? `$${ledger.amount_due - ledger.amount_paid + ledger.late_fee}`
        : 'unknown';

      if (ledger) {
        additionalContext = `Current month rent status: $${ledger.amount_due} due, $${ledger.amount_paid} paid, status: ${ledger.status}. Late fee: $${ledger.late_fee}. Total owed: ${totalOwed}.`;
      }

      // Mark any open collection actions as responded
      db.prepare(
        "UPDATE collection_actions SET tenant_responded = 1, response = ? WHERE tenant_id = ? AND tenant_responded = 0"
      ).run(message, tenant.id);

      // Create notification for owner with tenant's message
      db.prepare(`
        INSERT INTO notifications (type, recipient, message, status, created_at, related_tenant_id)
        VALUES ('approval_needed', 'owner', ?, 'pending', datetime('now'), ?)
      `).run(
        `PAYMENT PLAN REQUEST: ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number} is requesting a payment plan. Total owed: ${totalOwed}. Tenant message: "${message}". Create plan via POST /api/collection/${tenant.id}/payment-plan`,
        tenant.id
      );
    }

    // Get property policies
    const policies = db.prepare(`
      SELECT * FROM property_policies WHERE property_id = ?
    `).all(tenant.property_id);

    // Step 4: Generate AI response
    const responseText = await generateResponse(classification, {
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      unit_number: tenant.unit_number,
      address: tenant.address,
      rent_amount: tenant.rent_amount,
      lease_start: tenant.lease_start,
      lease_end: tenant.lease_end,
      payment_method: tenant.payment_method,
      status: tenant.status,
    }, policies, additionalContext);

    console.log(`[OUTBOUND] Response: "${responseText}"`);

    // Step 5: Send AI response to tenant via SMS (also logs to conversations table)
    await sendMessage(phone, responseText, {
      tenantId: tenant.id,
      classification: classification.classification,
      context: 'tenant_response',
    });

    // Step 6: Handle maintenance / emergency — create work order
    let workOrder = null;
    let matchedVendor = null;

    if (classification.classification === 'maintenance' || classification.classification === 'emergency') {
      matchedVendor = matchVendor(
        classification.category || 'general',
        tenant.property_id,
        classification.priority || 'standard'
      );

      const woStatus = classification.priority === 'emergency' ? 'dispatched' : 'new';
      const dispatchedAt = classification.priority === 'emergency' ? new Date().toISOString() : null;

      const result = db.prepare(`
        INSERT INTO work_orders (tenant_id, unit_id, property_id, vendor_id, category, priority,
          status, description, tenant_message, ai_classification, created_at, dispatched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        tenant.id,
        tenant.unit_id,
        tenant.property_id,
        matchedVendor ? matchedVendor.id : null,
        classification.category || 'general',
        classification.priority || 'standard',
        woStatus,
        `${classification.category || 'general'} issue reported by tenant`,
        message,
        classification.classification,
        dispatchedAt
      );

      workOrder = {
        id: result.lastInsertRowid,
        status: woStatus,
        vendor: matchedVendor ? matchedVendor.company_name : null,
      };

      console.log(`[WORK ORDER] Created #${workOrder.id} — ${woStatus} — Vendor: ${workOrder.vendor || 'unassigned'}`);

      // Send dispatch SMS for auto-dispatched work orders (emergencies)
      if (woStatus === 'dispatched' && matchedVendor) {
        const woData = {
          id: workOrder.id,
          category: classification.category || 'general',
          priority: classification.priority,
          tenant_message: message,
          description: `${classification.category || 'general'} issue reported by tenant`,
          ai_classification: classification.classification,
        };
        const propertyInfo = { address: tenant.address };
        const unitInfo = { unit_number: tenant.unit_number };

        // Notify vendor of dispatch
        await notifyVendorDispatch({
          vendor: matchedVendor,
          workOrder: woData,
          tenant,
          property: propertyInfo,
          unit: unitInfo,
        });

        // Notify tenant that vendor has been dispatched
        await notifyTenantDispatch({
          tenant,
          vendor: matchedVendor,
          workOrder: woData,
        });

        // For emergencies, also notify owner
        if (classification.priority === 'emergency') {
          await notifyOwnerEmergency({
            tenant,
            vendor: matchedVendor,
            workOrder: woData,
            property: propertyInfo,
            unit: unitInfo,
          });
        }
      }
    }

    // Step 7: Create notifications if needed + send owner SMS
    if (classification.requires_human) {
      const notifType = classification.classification === 'emergency' ? 'emergency' : 'approval_needed';
      const notifMessage = classification.classification === 'emergency'
        ? `EMERGENCY: ${classification.category || 'Issue'} at ${tenant.address} Unit ${tenant.unit_number} (${tenant.first_name} ${tenant.last_name}). Message: "${message}". Vendor ${matchedVendor ? matchedVendor.company_name + ' dispatched' : 'needs assignment'}.`
        : `Attention needed: ${classification.classification} from ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number}. Message: "${message}"`;

      const notifResult = db.prepare(`
        INSERT INTO notifications (type, recipient, message, related_work_order_id, status, created_at)
        VALUES (?, 'owner', ?, ?, 'pending', datetime('now'))
      `).run(notifType, notifMessage, workOrder ? Number(workOrder.id) : null);

      // Send SMS to owner
      const smsResult = await notifyOwner(notifMessage, { tenantId: tenant.id });

      // Mark notification as sent if SMS was delivered
      if (smsResult && smsResult.success) {
        db.prepare('UPDATE notifications SET status = ?, sent_at = datetime(\'now\') WHERE id = ?')
          .run('sent', notifResult.lastInsertRowid);
      }

      console.log(`[NOTIFICATION] ${notifType} notification created and sent for owner`);
    }

    // Step 8: Handle move-out notice
    if (classification.classification === 'move_out_notice') {
      db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run('notice', tenant.id);
      db.prepare('UPDATE units SET status = ? WHERE id = ?').run('notice', tenant.unit_id);
      console.log(`[TENANT] ${tenant.first_name} ${tenant.last_name} marked as notice`);

      // Notify owner of move-out
      await notifyOwner(
        `Move-out notice received from ${tenant.first_name} ${tenant.last_name} at ${tenant.address} Unit ${tenant.unit_number}. Lease ends: ${tenant.lease_end}.`,
        { tenantId: tenant.id }
      );
    }

    // Return response based on request type
    if (isTwilioRequest) {
      res.type('text/xml').send(twimlResponse(responseText));
    } else {
      res.json({
        status: 'processed',
        tenant: `${tenant.first_name} ${tenant.last_name}`,
        classification: classification.classification,
        priority: classification.priority,
        category: classification.category,
        requires_human: classification.requires_human,
        reasoning: classification.reasoning,
        response_sent: responseText,
        work_order: workOrder,
        vendor_assigned: matchedVendor ? matchedVendor.company_name : null,
      });
    }
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    if (isTwilioRequest) {
      res.type('text/xml').send(twimlResponse('We encountered an error processing your message. Please try again or call our office directly.'));
    } else {
      res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  } finally {
    db.close();
  }
});

module.exports = router;
