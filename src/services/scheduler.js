const cron = require('node-cron');
const { generateMonthlyLedger, runCollectionDay } = require('./collection');
const config = require('../config/collectionConfig');

function startScheduler() {
  // Midnight on the 1st of each month: generate new ledger entries
  cron.schedule(config.cron_monthly, () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    console.log(`[SCHEDULER] Monthly ledger generation for ${month}/${year}`);
    generateMonthlyLedger(month, year);
  });

  // 9 AM daily: run collection day logic
  cron.schedule(config.cron_daily, async () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    console.log(`[SCHEDULER] Running collection day ${day} for ${month}/${year}`);
    await runCollectionDay(day, month, year);
  });

  console.log('[SCHEDULER] Collection scheduler started');
  console.log(`  - Monthly ledger: ${config.cron_monthly}`);
  console.log(`  - Daily collection: ${config.cron_daily}`);
}

module.exports = { startScheduler };
