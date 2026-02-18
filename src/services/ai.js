const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CLASSIFICATION_PROMPT = `You are an AI assistant for a property management company called PropAI. Your job is to classify incoming tenant messages and determine the appropriate response.

Analyze the following message from a tenant and return a JSON object with these fields:
- classification: one of [maintenance, rent_question, general_inquiry, noise_complaint, lease_question, move_out_notice, emergency, payment_confirmation, payment_plan_request, unknown]
- priority: for maintenance/emergency messages, one of [emergency, urgent, standard, low]. null for non-maintenance.
- category: for maintenance/emergency messages, one of [plumbing, electrical, hvac, locksmith, pest, appliance, general]. null for non-maintenance.
- requires_human: boolean — true if this needs owner/manager attention
- reasoning: brief explanation of your classification

PRIORITY GUIDELINES for maintenance:
- EMERGENCY: active water leak/flood, no heat below freezing, gas smell, fire/smoke, sparking electrical, carbon monoxide, sewage backup, lockout with children/elderly inside, broken exterior door/window (security)
- URGENT: no hot water, broken lock, only toilet not working, HVAC not cooling in extreme heat, refrigerator not working (food safety), ceiling leak (not active flood)
- STANDARD: appliance issues, non-emergency plumbing, minor electrical, pest sighting, general repairs
- LOW: cosmetic issues, squeaky doors, scuff marks, non-urgent requests

When classification is emergency, requires_human MUST be true.
When classification is move_out_notice, requires_human MUST be true.
When classification is payment_confirmation, requires_human MUST be true. Use this when a tenant says they paid rent ("I paid", "payment sent", "just paid rent", "sent the check").
When classification is payment_plan_request, requires_human MUST be true. Use this when a tenant indicates financial hardship or requests a payment plan ("can't afford", "payment plan", "partial payment", "lost my job", "struggling to pay").

Return ONLY valid JSON, no markdown formatting.`;

async function classifyMessage(message, tenantInfo) {
  const tenantContext = tenantInfo
    ? `Tenant: ${tenantInfo.first_name} ${tenantInfo.last_name}, Unit ${tenantInfo.unit_number} at ${tenantInfo.address}, Rent: $${tenantInfo.rent_amount}, Lease ends: ${tenantInfo.lease_end}, Status: ${tenantInfo.status}`
    : 'Unknown tenant';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: `Tenant context: ${tenantContext}\n\nMessage: "${message}"` },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content.trim();
    // Strip potential markdown fencing
    const cleaned = content.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    const result = JSON.parse(cleaned);

    return {
      classification: result.classification || 'unknown',
      priority: result.priority || null,
      category: result.category || null,
      requires_human: result.requires_human || false,
      reasoning: result.reasoning || '',
    };
  } catch (err) {
    console.error('AI classification error:', err.message);
    return {
      classification: 'unknown',
      priority: null,
      category: null,
      requires_human: true,
      reasoning: `Classification failed: ${err.message}`,
    };
  }
}

const RESPONSE_PROMPT = `You are PropAI, a professional but friendly AI property management assistant. Generate a response to send to a tenant via text message.

Guidelines:
- Address the tenant by first name
- Acknowledge their specific issue
- Keep it concise (text message length)
- Be warm but professional
- Sign off as "Management" or "PropAI Management"

For maintenance:
- Emergency: tell them help is on the way, give safety instructions if relevant
- Urgent: tell them a work order has been created and a vendor will be contacted shortly
- Standard: tell them a work order has been created and someone will reach out to schedule
- Low: acknowledge and let them know it's been noted

For rent questions: reference their actual balance and payment info if available.
For noise complaints: acknowledge, say it will be addressed, mention quiet hours policy.
For move-out notices: confirm receipt, mention 30-day written notice requirement, explain security deposit return timeline (30 days after move-out per Maine law).
For lease questions: answer based on available policy info.
For general inquiries: answer based on available policy info.
For payment confirmations: thank the tenant, let them know their payment will be verified and their account updated.
For payment plan requests: empathize with the tenant's situation, ask how much they can pay now as an initial payment, and let them know management will review their request.

Return ONLY the response text, no JSON or formatting.`;

async function generateResponse(classification, tenantInfo, propertyPolicies, additionalContext) {
  const tenantContext = tenantInfo
    ? `Tenant: ${tenantInfo.first_name} ${tenantInfo.last_name}, Unit ${tenantInfo.unit_number} at ${tenantInfo.address}. Rent: $${tenantInfo.rent_amount}/month. Lease: ${tenantInfo.lease_start} to ${tenantInfo.lease_end}. Payment method: ${tenantInfo.payment_method}. Status: ${tenantInfo.status}.`
    : 'Unknown tenant';

  const policiesText = propertyPolicies && propertyPolicies.length > 0
    ? propertyPolicies.map(p => `${p.policy_type}: ${p.policy_text}`).join('\n')
    : 'No specific policies on file.';

  const contextStr = additionalContext || '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: RESPONSE_PROMPT },
        {
          role: 'user',
          content: `Classification: ${JSON.stringify(classification)}\n\nTenant info: ${tenantContext}\n\nProperty policies:\n${policiesText}\n\nAdditional context: ${contextStr}\n\nGenerate the response message.`,
        },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('AI response generation error:', err.message);
    // Fallback responses by classification type
    const name = tenantInfo ? tenantInfo.first_name : 'there';
    const fallbacks = {
      maintenance: `Hi ${name}, we've received your maintenance request and created a work order. Someone from our team will be in touch to schedule the repair. — Management`,
      emergency: `${name}, we've received your emergency report and are dispatching help immediately. Please ensure your safety first. — Management`,
      rent_question: `Hi ${name}, we've received your question about rent. A member of our team will follow up with your account details shortly. — Management`,
      noise_complaint: `Hi ${name}, thank you for reporting the noise issue. We take this seriously and will address it with the other tenant. As a reminder, quiet hours are 10 PM to 7 AM. — Management`,
      move_out_notice: `Hi ${name}, we've received your move-out notice. Please remember that a 30-day written notice is required. We'll be in touch with next steps regarding your security deposit and move-out inspection. — Management`,
      lease_question: `Hi ${name}, we've received your question. A member of our team will review and get back to you shortly. — Management`,
      general_inquiry: `Hi ${name}, thanks for reaching out. We'll look into your question and get back to you soon. — Management`,
      payment_confirmation: `Hi ${name}, thank you for letting us know about your payment. We'll verify it and update your account shortly. — Management`,
      payment_plan_request: `Hi ${name}, we understand times can be tough. We'd like to help work something out. Could you let us know how much you're able to pay right now? Management will review your request and get back to you. — Management`,
      unknown: `Hi ${name}, we've received your message. A member of our team will review it and respond shortly. — Management`,
    };
    return fallbacks[classification.classification] || fallbacks.unknown;
  }
}

module.exports = { classifyMessage, generateResponse };
