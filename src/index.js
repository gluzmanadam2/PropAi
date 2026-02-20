console.log("PropAI starting...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT env:", process.env.PORT);
console.log("OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID === 'placeholder' ? 'PLACEHOLDER (bad!)' : process.env.TWILIO_ACCOUNT_SID ? 'set' : 'not set');

try {
  // Only load .env file in development — Railway injects env vars directly
  if (process.env.NODE_ENV !== 'production') {
    try { require('dotenv').config(); } catch (e) { /* no dotenv in production */ }
  }
  const express = require('express');
  const path = require('path');
  const { initializeDatabase } = require('./db/schema');

  // Ensure database tables exist
  initializeDatabase();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check (before all other routes)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'PropAI', timestamp: new Date().toISOString() });
  });

  // Privacy policy
  app.get('/privacy', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy — Scale PM</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.7; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 32px; }
  .updated { color: #888; font-size: 14px; margin-bottom: 32px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; }
  a { color: #2563eb; }
</style>
</head>
<body>
<h1>Scale PM Privacy Policy</h1>
<p class="updated">Last updated: February 20, 2026</p>

<p>Scale PM ("we", "us", "our") operates an AI-powered property management communication platform. This Privacy Policy explains how we collect, use, and protect information from tenants and property owners who interact with our services.</p>

<h2>Information We Collect</h2>
<ul>
  <li><strong>Phone numbers:</strong> We collect tenant phone numbers provided by property owners or tenants themselves for the purpose of property management communications.</li>
  <li><strong>Text messages:</strong> We store the content of SMS messages sent to and from our platform to provide property management services, including maintenance requests, rent reminders, and general communications.</li>
  <li><strong>Property and lease information:</strong> We store tenant names, unit assignments, lease terms, and rent amounts as provided by property owners to facilitate property management.</li>
</ul>

<h2>How We Use Your Information</h2>
<ul>
  <li>To send and receive property management communications via SMS (maintenance updates, rent reminders, lease notices)</li>
  <li>To classify and route tenant requests using AI to ensure timely responses</li>
  <li>To maintain records of communications and maintenance requests</li>
  <li>To process rent collection and track payment status</li>
</ul>

<h2>Data Storage and Security</h2>
<p>Your data is stored on secure servers. We use encryption in transit (HTTPS/TLS) for all communications. Access to tenant data is restricted to authorized property management personnel.</p>

<h2>Third-Party Sharing</h2>
<p><strong>We do not sell, rent, or trade your personal information to third parties.</strong> We share data only with:</p>
<ul>
  <li><strong>Twilio:</strong> Our SMS delivery provider, used solely to send and receive text messages on our behalf.</li>
  <li><strong>OpenAI:</strong> Message content is processed by AI to classify and respond to tenant communications. No personally identifiable information is stored by OpenAI beyond the processing request.</li>
  <li><strong>Property owners/managers:</strong> Your communications and maintenance requests are shared with the property management team responsible for your property.</li>
</ul>

<h2>Opting Out</h2>
<p>You can opt out of receiving SMS communications at any time by replying <strong>STOP</strong> to any message from Scale PM. After opting out, you will no longer receive automated text messages. You may still be contacted by your property manager through other means regarding essential lease and property matters.</p>

<h2>Data Retention</h2>
<p>We retain tenant data for the duration of the tenancy and for a reasonable period afterward as required for legal and business purposes. You may request deletion of your data by contacting your property manager.</p>

<h2>Contact</h2>
<p>If you have questions about this privacy policy or your data, contact your property management office or email us at <a href="mailto:support@scalepm.com">support@scalepm.com</a>.</p>
</body>
</html>`);
  });

  // Routes
  app.use('/webhook', require('./routes/webhook'));
  app.use('/api/conversations', require('./routes/conversations'));
  app.use('/api/work-orders', require('./routes/workOrders'));
  app.use('/api/tenants', require('./routes/tenants'));
  app.use('/api/properties', require('./routes/properties'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/rent-ledger', require('./routes/rentLedger'));
  app.use('/api/vendors', require('./routes/vendors'));
  app.use('/api/applications', require('./routes/applications'));
  app.use('/api/collection', require('./routes/collection'));
  app.use('/api/test', require('./routes/testCollection'));

  // Serve React frontend (production build)
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for any non-API route
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  const { startScheduler } = require('./services/scheduler');

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PropAI server running on port ${PORT}`);
    startScheduler();
  });
} catch (err) {
  console.error("FATAL: PropAI failed to start:", err);
  process.exit(1);
}
