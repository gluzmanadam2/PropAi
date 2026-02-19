require('dotenv').config();
const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./db/schema');

// Ensure database tables exist
initializeDatabase();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PropAI', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for any non-API route
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const { startScheduler } = require('./services/scheduler');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PropAI server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Dashboard:    http://localhost:${PORT}/api/dashboard/summary`);
  startScheduler();
});
