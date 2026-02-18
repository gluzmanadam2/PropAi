/**
 * PropAI Webhook Simulation Test
 *
 * Sends various message scenarios to POST /webhook/inbound and displays
 * the AI classification and response for each.
 *
 * Usage:
 *   1. Start the server: npm start
 *   2. In another terminal: npm test
 *
 * Requires the server to be running on the configured PORT (default 3000).
 * Requires a valid OPENAI_API_KEY in .env for AI classification/response.
 * If the API key is "placeholder", classification will fall back to defaults.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const scenarios = [
  {
    name: 'EMERGENCY — Pipe burst (active water leak)',
    from: '207-364-1012', // Sarah Mitchell
    body: 'HELP! Water is spraying everywhere from under my kitchen sink, the floor is flooding!',
  },
  {
    name: 'URGENT — Refrigerator not working',
    from: '207-364-1045', // James Bouchard
    body: 'My refrigerator stopped working overnight. Everything inside is getting warm and I\'m worried about my food spoiling.',
  },
  {
    name: 'STANDARD — Leaky faucet',
    from: '207-364-1078', // Linda Arsenault
    body: 'Hey, my bathroom faucet has been dripping for a few days now. Not an emergency but it\'s annoying and probably wasting water.',
  },
  {
    name: 'LOW — Cosmetic / squeaky door',
    from: '207-364-1103', // Robert Theriault
    body: 'The hinges on my bedroom door squeak every time I open it. Could someone come oil them when they get a chance?',
  },
  {
    name: 'ELECTRICAL — Sparking outlet (emergency)',
    from: '207-364-1156', // Marie Cyr
    body: 'I just saw sparks come out of the outlet in my living room when I plugged something in! I\'m scared to use it.',
  },
  {
    name: 'RENT QUESTION — Balance inquiry',
    from: '207-364-1189', // David Pelletier
    body: 'Hi, can you tell me if my rent payment went through for this month? I sent it last week but want to make sure.',
  },
  {
    name: 'NOISE COMPLAINT',
    from: '207-364-1222', // Karen Ouellette
    body: 'The tenant above me has been playing extremely loud music every night past midnight. I can\'t sleep. This has been going on for a week.',
  },
  {
    name: 'LEASE QUESTION',
    from: '207-364-1255', // Michael Gagnon
    body: 'My lease is coming up for renewal. What are the terms for renewing? Will my rent go up?',
  },
  {
    name: 'MOVE-OUT NOTICE',
    from: '207-364-1288', // Susan Dubois
    body: 'I wanted to let you know that I will be moving out at the end of March. Please consider this my 30-day notice.',
  },
  {
    name: 'GENERAL INQUIRY — Pet policy',
    from: '207-364-1321', // Thomas Roy
    body: 'I\'m thinking about getting a dog. What\'s the pet policy here? Is there an extra deposit?',
  },
  {
    name: 'PEST — Mouse sighting',
    from: '207-364-1354', // Patricia Morin
    body: 'I found mouse droppings in my kitchen cupboard this morning. I think we might have mice.',
  },
  {
    name: 'HVAC — No heat',
    from: '207-364-1387', // Daniel Levesque
    body: 'My heat stopped working and it\'s supposed to be below zero tonight. My apartment is already getting cold.',
  },
  {
    name: 'LOCKSMITH — Broken lock',
    from: '207-364-1420', // Nancy Beaulieu
    body: 'The deadbolt on my front door is broken. I can\'t lock my apartment properly. This is a security issue.',
  },
  {
    name: 'UNKNOWN SENDER',
    from: '207-555-0000',
    body: 'Hey is this the landlord? I saw your ad about the apartment.',
  },
];

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorPriority(priority) {
  if (!priority) return 'N/A';
  const map = {
    emergency: COLORS.red + COLORS.bright + priority + COLORS.reset,
    urgent: COLORS.yellow + priority + COLORS.reset,
    standard: COLORS.cyan + priority + COLORS.reset,
    low: COLORS.green + priority + COLORS.reset,
  };
  return map[priority] || priority;
}

async function runScenario(scenario, index) {
  const divider = '='.repeat(80);
  console.log(`\n${divider}`);
  console.log(`${COLORS.bright}SCENARIO ${index + 1}: ${scenario.name}${COLORS.reset}`);
  console.log(`From: ${scenario.from}`);
  console.log(`Message: "${scenario.body}"`);
  console.log('-'.repeat(80));

  try {
    const res = await fetch(`${BASE_URL}/webhook/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: scenario.from, body: scenario.body }),
    });

    const data = await res.json();

    if (data.note) {
      // Unknown sender
      console.log(`${COLORS.yellow}Result: ${data.note}${COLORS.reset}`);
      return;
    }

    console.log(`Tenant:         ${data.tenant}`);
    console.log(`Classification: ${COLORS.magenta}${data.classification}${COLORS.reset}`);
    console.log(`Priority:       ${colorPriority(data.priority)}`);
    console.log(`Category:       ${data.category || 'N/A'}`);
    console.log(`Requires Human: ${data.requires_human ? COLORS.red + 'YES' + COLORS.reset : 'No'}`);
    console.log(`Reasoning:      ${data.reasoning}`);
    console.log(`\n${COLORS.green}AI Response:${COLORS.reset}`);
    console.log(`  "${data.response_sent}"`);

    if (data.work_order) {
      console.log(`\n${COLORS.blue}Work Order:${COLORS.reset} #${data.work_order.id} — Status: ${data.work_order.status} — Vendor: ${data.work_order.vendor || 'unassigned'}`);
    }
    if (data.vendor_assigned) {
      console.log(`Vendor:         ${data.vendor_assigned}`);
    }
  } catch (err) {
    console.error(`${COLORS.red}ERROR: ${err.message}${COLORS.reset}`);
    if (err.cause && err.cause.code === 'ECONNREFUSED') {
      console.error('Is the server running? Start it with: npm start');
      process.exit(1);
    }
  }
}

async function main() {
  console.log(`${COLORS.bright}${COLORS.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             PropAI Webhook Simulation Test                  ║');
  console.log('║                                                            ║');
  console.log('║  Sending test messages to POST /webhook/inbound            ║');
  console.log('║  Each message will be classified by AI and responded to.   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${COLORS.reset}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Scenarios: ${scenarios.length}`);

  // Check server is reachable
  try {
    await fetch(`${BASE_URL}/health`);
  } catch {
    console.error(`\n${COLORS.red}Cannot reach server at ${BASE_URL}. Start it with: npm start${COLORS.reset}`);
    process.exit(1);
  }

  for (let i = 0; i < scenarios.length; i++) {
    await runScenario(scenarios[i], i);
    // Small delay between requests to avoid rate limiting
    if (i < scenarios.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`${COLORS.bright}${COLORS.green}All ${scenarios.length} scenarios completed.${COLORS.reset}`);
  console.log('='.repeat(80));

  // Print summary from API
  console.log(`\n${COLORS.bright}Post-test Dashboard Summary:${COLORS.reset}`);
  try {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`);
    const dashboard = await res.json();
    console.log(`  Properties:     ${dashboard.portfolio.total_properties}`);
    console.log(`  Units:          ${dashboard.portfolio.total_units} (${dashboard.portfolio.occupancy_rate}% occupancy)`);
    console.log(`  Active WOs:     ${dashboard.work_orders.active}`);
    console.log(`  Emergency WOs:  ${dashboard.work_orders.emergency}`);
    console.log(`  Rent collected: $${dashboard.rent_collection.total_collected} / $${dashboard.rent_collection.total_due} (${dashboard.rent_collection.collection_rate}%)`);
    console.log(`  Pending notifs: ${dashboard.notifications.pending}`);
  } catch {
    // Ignore dashboard fetch errors
  }
}

main();
