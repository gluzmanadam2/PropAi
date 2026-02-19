if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
}
const { getDb, initializeDatabase, DB_PATH } = require('./schema');
const fs = require('fs');

// Wipe existing DB
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

initializeDatabase();
const db = getDb();

// ── Properties ──────────────────────────────────────────────
const properties = [
  { name: '154 Essex Ave',     address: '154 Essex Ave',     city: 'Rumford',  state: 'ME', zip: '04276', units_count: 6, property_type: 'multi-family',  notes: '3-story walk-up' },
  { name: '16 Osgood Ave',     address: '16 Osgood Ave',     city: 'Rumford',  state: 'ME', zip: '04276', units_count: 4, property_type: 'multi-family',  notes: 'Victorian conversion' },
  { name: '236 Knox St',       address: '236 Knox St',       city: 'Rumford',  state: 'ME', zip: '04276', units_count: 4, property_type: 'multi-family',  notes: 'Brick building, recent roof' },
  { name: '313 Waldo St',      address: '313 Waldo St',      city: 'Rumford',  state: 'ME', zip: '04276', units_count: 3, property_type: 'multi-family',  notes: 'Near downtown' },
  { name: '429 Penobscot St',  address: '429 Penobscot St',  city: 'Rumford',  state: 'ME', zip: '04276', units_count: 5, property_type: 'multi-family',  notes: 'Updated kitchens 2024' },
  { name: '53 Osgood Ave',     address: '53 Osgood Ave',     city: 'Rumford',  state: 'ME', zip: '04276', units_count: 2, property_type: 'duplex',        notes: 'Side-by-side duplex' },
  { name: '688 Prospect Ave',  address: '688 Prospect Ave',  city: 'Rumford',  state: 'ME', zip: '04276', units_count: 4, property_type: 'multi-family',  notes: 'Hilltop location, good views' },
  { name: '321 Pine St',       address: '321 Pine St',       city: 'Mexico',   state: 'ME', zip: '04257', units_count: 3, property_type: 'multi-family',  notes: 'Near school' },
  { name: '39 Carlton Ave',    address: '39 Carlton Ave',    city: 'Mexico',   state: 'ME', zip: '04257', units_count: 4, property_type: 'multi-family',  notes: 'Corner lot, off-street parking' },
  { name: '48 Main St',        address: '48 Main St',        city: 'Mexico',   state: 'ME', zip: '04257', units_count: 4, property_type: 'mixed-use',     notes: 'Ground floor commercial, upper residential' },
  { name: '6 Dix Ave',         address: '6 Dix Ave',         city: 'Mexico',   state: 'ME', zip: '04257', units_count: 3, property_type: 'multi-family',  notes: 'Quiet neighborhood' },
  { name: '9 Dix Ave',         address: '9 Dix Ave',         city: 'Mexico',   state: 'ME', zip: '04257', units_count: 3, property_type: 'multi-family',  notes: 'Adjacent to 6 Dix' },
];

const insertProperty = db.prepare(`
  INSERT INTO properties (name, address, city, state, zip, units_count, property_type, notes)
  VALUES (@name, @address, @city, @state, @zip, @units_count, @property_type, @notes)
`);

for (const p of properties) {
  insertProperty.run(p);
}

// ── Units ───────────────────────────────────────────────────
// Generate units per property. Total = 45
const unitConfigs = [
  // Property 1: 154 Essex Ave — 6 units
  { pid: 1, units: [
    { unit_number: '1A', bedrooms: 1, bathrooms: 1, sqft: 550,  market_rent: 750,  status: 'occupied', features: 'ground floor' },
    { unit_number: '1B', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 950,  status: 'occupied', features: 'ground floor, storage' },
    { unit_number: '2A', bedrooms: 1, bathrooms: 1, sqft: 550,  market_rent: 775,  status: 'occupied', features: 'second floor' },
    { unit_number: '2B', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 975,  status: 'occupied', features: 'second floor, storage' },
    { unit_number: '3A', bedrooms: 2, bathrooms: 1, sqft: 750,  market_rent: 900,  status: 'vacant',   features: 'third floor, skylight' },
    { unit_number: '3B', bedrooms: 3, bathrooms: 1, sqft: 1000, market_rent: 1200, status: 'occupied', features: 'third floor, large' },
  ]},
  // Property 2: 16 Osgood Ave — 4 units
  { pid: 2, units: [
    { unit_number: '1', bedrooms: 1, bathrooms: 1, sqft: 600,  market_rent: 700,  status: 'occupied', features: 'garden level' },
    { unit_number: '2', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 950,  status: 'occupied', features: 'main floor, bay window' },
    { unit_number: '3', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 950,  status: 'occupied', features: 'second floor' },
    { unit_number: '4', bedrooms: 1, bathrooms: 1, sqft: 500,  market_rent: 675,  status: 'vacant',   features: 'attic unit, cozy' },
  ]},
  // Property 3: 236 Knox St — 4 units
  { pid: 3, units: [
    { unit_number: 'A', bedrooms: 2, bathrooms: 1, sqft: 900,  market_rent: 1000, status: 'occupied', features: 'washer/dryer hookup' },
    { unit_number: 'B', bedrooms: 2, bathrooms: 1, sqft: 900,  market_rent: 1000, status: 'occupied', features: 'washer/dryer hookup' },
    { unit_number: 'C', bedrooms: 3, bathrooms: 1.5, sqft: 1100, market_rent: 1300, status: 'occupied', features: 'corner unit, extra closet' },
    { unit_number: 'D', bedrooms: 1, bathrooms: 1, sqft: 650,  market_rent: 775,  status: 'occupied', features: 'updated bath' },
  ]},
  // Property 4: 313 Waldo St — 3 units
  { pid: 4, units: [
    { unit_number: '1', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 925,  status: 'occupied', features: 'front porch' },
    { unit_number: '2', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 925,  status: 'occupied', features: 'back deck' },
    { unit_number: '3', bedrooms: 3, bathrooms: 1, sqft: 1000, market_rent: 1150, status: 'occupied', features: 'top floor, storage' },
  ]},
  // Property 5: 429 Penobscot St — 5 units
  { pid: 5, units: [
    { unit_number: '101', bedrooms: 1, bathrooms: 1, sqft: 575,  market_rent: 750,  status: 'occupied', features: 'updated kitchen' },
    { unit_number: '102', bedrooms: 2, bathrooms: 1, sqft: 825,  market_rent: 975,  status: 'occupied', features: 'updated kitchen' },
    { unit_number: '201', bedrooms: 1, bathrooms: 1, sqft: 575,  market_rent: 750,  status: 'vacant',   features: 'updated kitchen' },
    { unit_number: '202', bedrooms: 2, bathrooms: 1, sqft: 825,  market_rent: 975,  status: 'occupied', features: 'updated kitchen, balcony' },
    { unit_number: '301', bedrooms: 3, bathrooms: 1.5, sqft: 1100, market_rent: 1350, status: 'occupied', features: 'penthouse, updated kitchen' },
  ]},
  // Property 6: 53 Osgood Ave — 2 units
  { pid: 6, units: [
    { unit_number: 'Left',  bedrooms: 2, bathrooms: 1, sqft: 900,  market_rent: 1050, status: 'occupied', features: 'side entrance, yard' },
    { unit_number: 'Right', bedrooms: 2, bathrooms: 1, sqft: 900,  market_rent: 1050, status: 'occupied', features: 'side entrance, yard' },
  ]},
  // Property 7: 688 Prospect Ave — 4 units
  { pid: 7, units: [
    { unit_number: '1', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 1000, status: 'occupied', features: 'mountain view' },
    { unit_number: '2', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 1000, status: 'occupied', features: 'mountain view' },
    { unit_number: '3', bedrooms: 3, bathrooms: 1.5, sqft: 1150, market_rent: 1350, status: 'occupied', features: 'mountain view, fireplace' },
    { unit_number: '4', bedrooms: 1, bathrooms: 1, sqft: 550,  market_rent: 725,  status: 'vacant',   features: 'studio-style' },
  ]},
  // Property 8: 321 Pine St — 3 units
  { pid: 8, units: [
    { unit_number: '1', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 900,  status: 'occupied', features: 'near school' },
    { unit_number: '2', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 900,  status: 'occupied', features: 'near school' },
    { unit_number: '3', bedrooms: 3, bathrooms: 1, sqft: 1050, market_rent: 1175, status: 'occupied', features: 'large yard' },
  ]},
  // Property 9: 39 Carlton Ave — 4 units
  { pid: 9, units: [
    { unit_number: 'A', bedrooms: 1, bathrooms: 1, sqft: 550,  market_rent: 725,  status: 'occupied', features: 'off-street parking' },
    { unit_number: 'B', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 925,  status: 'occupied', features: 'off-street parking' },
    { unit_number: 'C', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 925,  status: 'occupied', features: 'off-street parking, deck' },
    { unit_number: 'D', bedrooms: 3, bathrooms: 1.5, sqft: 1100, market_rent: 1300, status: 'vacant',  features: 'off-street parking, large' },
  ]},
  // Property 10: 48 Main St — 4 units
  { pid: 10, units: [
    { unit_number: '2A', bedrooms: 1, bathrooms: 1, sqft: 600,  market_rent: 750,  status: 'occupied', features: 'above commercial' },
    { unit_number: '2B', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 975,  status: 'occupied', features: 'above commercial' },
    { unit_number: '3A', bedrooms: 2, bathrooms: 1, sqft: 850,  market_rent: 975,  status: 'occupied', features: 'top floor' },
    { unit_number: '3B', bedrooms: 3, bathrooms: 1.5, sqft: 1200, market_rent: 1400, status: 'occupied', features: 'top floor, large' },
  ]},
  // Property 11: 6 Dix Ave — 3 units
  { pid: 11, units: [
    { unit_number: '1', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 900,  status: 'occupied', features: 'quiet street' },
    { unit_number: '2', bedrooms: 2, bathrooms: 1, sqft: 800,  market_rent: 900,  status: 'occupied', features: 'quiet street' },
    { unit_number: '3', bedrooms: 1, bathrooms: 1, sqft: 550,  market_rent: 700,  status: 'vacant',   features: 'quiet street, compact' },
  ]},
  // Property 12: 9 Dix Ave — 3 units
  { pid: 12, units: [
    { unit_number: '1', bedrooms: 2, bathrooms: 1, sqft: 850, market_rent: 950,  status: 'occupied', features: 'renovated 2024' },
    { unit_number: '2', bedrooms: 3, bathrooms: 1.5, sqft: 1100, market_rent: 1300, status: 'occupied', features: 'renovated 2024' },
    { unit_number: '3', bedrooms: 2, bathrooms: 1, sqft: 850, market_rent: 950,  status: 'occupied', features: 'renovated 2024, deck' },
  ]},
];

const insertUnit = db.prepare(`
  INSERT INTO units (property_id, unit_number, bedrooms, bathrooms, sqft, market_rent, status, features, notes)
  VALUES (@property_id, @unit_number, @bedrooms, @bathrooms, @sqft, @market_rent, @status, @features, NULL)
`);

// Build a flat list to reference later
const allUnits = [];
for (const config of unitConfigs) {
  for (const u of config.units) {
    const info = insertUnit.run({ property_id: config.pid, ...u });
    allUnits.push({ id: info.lastInsertRowid, property_id: config.pid, ...u });
  }
}

console.log(`Seeded ${allUnits.length} units`);

// ── Tenants ─────────────────────────────────────────────────
// Only occupied units get tenants. 39 tenants, 6 vacant.
const occupiedUnits = allUnits.filter(u => u.status === 'occupied');

const tenantNames = [
  { first_name: 'Sarah',    last_name: 'Mitchell',   phone: '+18572257226', email: 'sarah.mitchell@email.com' },
  { first_name: 'James',    last_name: 'Bouchard',   phone: '207-364-1045', email: 'james.bouchard@email.com' },
  { first_name: 'Linda',    last_name: 'Arsenault',   phone: '207-364-1078', email: 'linda.arsenault@email.com' },
  { first_name: 'Robert',   last_name: 'Theriault',   phone: '207-364-1103', email: 'robert.theriault@email.com' },
  { first_name: 'Marie',    last_name: 'Cyr',         phone: '207-364-1156', email: 'marie.cyr@email.com' },
  { first_name: 'David',    last_name: 'Pelletier',   phone: '207-364-1189', email: 'david.pelletier@email.com' },
  { first_name: 'Karen',    last_name: 'Ouellette',   phone: '207-364-1222', email: 'karen.ouellette@email.com' },
  { first_name: 'Michael',  last_name: 'Gagnon',      phone: '207-364-1255', email: 'michael.gagnon@email.com' },
  { first_name: 'Susan',    last_name: 'Dubois',      phone: '207-364-1288', email: 'susan.dubois@email.com' },
  { first_name: 'Thomas',   last_name: 'Roy',         phone: '207-364-1321', email: 'thomas.roy@email.com' },
  { first_name: 'Patricia', last_name: 'Morin',       phone: '207-364-1354', email: 'patricia.morin@email.com' },
  { first_name: 'Daniel',   last_name: 'Levesque',    phone: '207-364-1387', email: 'daniel.levesque@email.com' },
  { first_name: 'Nancy',    last_name: 'Beaulieu',    phone: '207-364-1420', email: 'nancy.beaulieu@email.com' },
  { first_name: 'Mark',     last_name: 'Poirier',     phone: '207-364-1453', email: 'mark.poirier@email.com' },
  { first_name: 'Donna',    last_name: 'Nadeau',      phone: '207-364-1486', email: 'donna.nadeau@email.com' },
  { first_name: 'Steven',   last_name: 'Thibodeau',   phone: '207-364-1519', email: 'steven.thibodeau@email.com' },
  { first_name: 'Carol',    last_name: 'Michaud',     phone: '207-364-1552', email: 'carol.michaud@email.com' },
  { first_name: 'Joseph',   last_name: 'Blais',       phone: '207-364-1585', email: 'joseph.blais@email.com' },
  { first_name: 'Betty',    last_name: 'Fortin',      phone: '207-364-1618', email: 'betty.fortin@email.com' },
  { first_name: 'Richard',  last_name: 'Lavoie',      phone: '207-364-1651', email: 'richard.lavoie@email.com' },
  { first_name: 'Helen',    last_name: 'Tardif',      phone: '207-364-1684', email: 'helen.tardif@email.com' },
  { first_name: 'George',   last_name: 'Plourde',     phone: '207-364-1717', email: 'george.plourde@email.com' },
  { first_name: 'Dorothy',  last_name: 'Caron',       phone: '207-364-1750', email: 'dorothy.caron@email.com' },
  { first_name: 'Kenneth',  last_name: 'Sirois',      phone: '207-364-1783', email: 'kenneth.sirois@email.com' },
  { first_name: 'Sandra',   last_name: 'Bernier',     phone: '207-364-1816', email: 'sandra.bernier@email.com' },
  { first_name: 'Paul',     last_name: 'Dube',        phone: '207-364-1849', email: 'paul.dube@email.com' },
  { first_name: 'Ashley',   last_name: 'Dionne',      phone: '207-364-1882', email: 'ashley.dionne@email.com' },
  { first_name: 'Brian',    last_name: 'Marquis',     phone: '207-364-1915', email: 'brian.marquis@email.com' },
  { first_name: 'Kimberly', last_name: 'Vaillancourt',phone: '207-364-1948', email: 'kimberly.vaillancourt@email.com' },
  { first_name: 'Edward',   last_name: 'Madore',      phone: '207-364-1981', email: 'edward.madore@email.com' },
  { first_name: 'Deborah',  last_name: 'Soucy',       phone: '207-364-2014', email: 'deborah.soucy@email.com' },
  { first_name: 'Ronald',   last_name: 'Pinette',     phone: '207-364-2047', email: 'ronald.pinette@email.com' },
  { first_name: 'Laura',    last_name: 'Albert',      phone: '207-364-2080', email: 'laura.albert@email.com' },
  { first_name: 'Kevin',    last_name: 'Boutin',      phone: '207-364-2113', email: 'kevin.boutin@email.com' },
  { first_name: 'Stephanie',last_name: 'Rancourt',    phone: '207-364-2146', email: 'stephanie.rancourt@email.com' },
  { first_name: 'Jason',    last_name: 'Dostie',      phone: '207-364-2179', email: 'jason.dostie@email.com' },
  { first_name: 'Rebecca',  last_name: 'Fournier',    phone: '207-364-2212', email: 'rebecca.fournier@email.com' },
  { first_name: 'Gary',     last_name: 'Parent',      phone: '207-364-2245', email: 'gary.parent@email.com' },
  { first_name: 'Melissa',  last_name: 'Vermette',    phone: '207-364-2278', email: 'melissa.vermette@email.com' },
];

const paymentMethods = ['check', 'online', 'cash', 'money_order', 'direct_deposit'];
const petOptions = [null, null, null, null, '1 cat', '1 dog (small)', '2 cats', '1 dog (medium)', null, null];
const vehicleOptions = [null, 'Honda Civic 2019', 'Ford F-150 2020', 'Toyota Camry 2018', null, 'Subaru Outback 2021', null, 'Chevy Silverado 2017', 'Hyundai Elantra 2022', null];

const insertTenant = db.prepare(`
  INSERT INTO tenants (unit_id, property_id, first_name, last_name, phone, email,
    rent_amount, deposit_amount, lease_start, lease_end, move_in_date,
    pet_info, vehicle_info, emergency_contact_name, emergency_contact_phone,
    payment_method, status, notes)
  VALUES (@unit_id, @property_id, @first_name, @last_name, @phone, @email,
    @rent_amount, @deposit_amount, @lease_start, @lease_end, @move_in_date,
    @pet_info, @vehicle_info, @emergency_contact_name, @emergency_contact_phone,
    @payment_method, @status, NULL)
`);

const allTenants = [];
for (let i = 0; i < occupiedUnits.length; i++) {
  const unit = occupiedUnits[i];
  const name = tenantNames[i];
  const rent = unit.market_rent + (Math.floor(Math.random() * 5) - 2) * 25; // slight variation
  const leaseMonth = (i % 12) + 1;
  const leaseStart = `2024-${String(leaseMonth).padStart(2, '0')}-01`;
  const leaseEnd = `2025-${String(leaseMonth).padStart(2, '0')}-01`;

  const tenant = {
    unit_id: Number(unit.id),
    property_id: unit.property_id,
    first_name: name.first_name,
    last_name: name.last_name,
    phone: name.phone,
    email: name.email,
    rent_amount: rent,
    deposit_amount: rent,
    lease_start: leaseStart,
    lease_end: leaseEnd,
    move_in_date: leaseStart,
    pet_info: petOptions[i % petOptions.length] || null,
    vehicle_info: vehicleOptions[i % vehicleOptions.length] || null,
    emergency_contact_name: `Emergency Contact for ${name.first_name}`,
    emergency_contact_phone: `207-364-${3000 + i}`,
    payment_method: paymentMethods[i % paymentMethods.length],
    status: i === 20 ? 'notice' : 'current', // one tenant on notice
  };

  const info = insertTenant.run(tenant);
  allTenants.push({ id: Number(info.lastInsertRowid), ...tenant });
}

// Update units to mark the notice one
if (allTenants[20]) {
  db.prepare('UPDATE units SET status = ? WHERE id = ?').run('notice', allTenants[20].unit_id);
}

console.log(`Seeded ${allTenants.length} tenants`);

// ── Vendors ─────────────────────────────────────────────────
const vendors = [
  { company_name: 'River Valley Plumbing',       contact_name: 'Pete Dumais',      phone: '207-364-5501', email: 'rvplumbing@email.com',    specialty: 'plumbing',    hourly_rate: 85,  emergency_available: 1, insurance_expiry: '2026-06-15', service_area: 'Rumford/Mexico', performance_score: 8.5, notes: 'Reliable, quick response' },
  { company_name: 'Western Maine Electric',       contact_name: 'Ray Cormier',      phone: '207-364-5502', email: 'wmelectric@email.com',    specialty: 'electrical',  hourly_rate: 90,  emergency_available: 1, insurance_expiry: '2026-08-01', service_area: 'Rumford/Mexico', performance_score: 9.0, notes: 'Licensed master electrician' },
  { company_name: 'Oxford Hills HVAC',            contact_name: 'Jim Therrien',     phone: '207-364-5503', email: 'oxfordhvac@email.com',    specialty: 'hvac',        hourly_rate: 95,  emergency_available: 1, insurance_expiry: '2026-04-20', service_area: 'Oxford County',  performance_score: 7.8, notes: 'All brands serviced' },
  { company_name: 'Handyman Plus',                contact_name: 'Mike Laplante',    phone: '207-364-5504', email: 'handymanplus@email.com',  specialty: 'general',     hourly_rate: 55,  emergency_available: 0, insurance_expiry: '2026-09-30', service_area: 'Rumford/Mexico', performance_score: 8.2, notes: 'Jack of all trades, great rates' },
  { company_name: 'Rumford Lock & Key',           contact_name: 'Steve Bolduc',     phone: '207-364-5505', email: 'rumfordlock@email.com',   specialty: 'locksmith',   hourly_rate: 75,  emergency_available: 1, insurance_expiry: '2026-12-01', service_area: 'Rumford/Mexico', performance_score: 8.8, notes: '24/7 emergency service' },
  { company_name: 'Maine Pest Solutions',          contact_name: 'Dave Martin',      phone: '207-364-5506', email: 'mainepest@email.com',     specialty: 'pest',        hourly_rate: 70,  emergency_available: 0, insurance_expiry: '2026-07-15', service_area: 'Oxford County',  performance_score: 7.5, notes: 'Monthly treatment plans available' },
  { company_name: 'Appliance Rescue',             contact_name: 'Tom Bilodeau',     phone: '207-364-5507', email: 'appliancerescue@email.com',specialty: 'appliance',  hourly_rate: 80,  emergency_available: 0, insurance_expiry: '2026-05-10', service_area: 'Rumford/Mexico', performance_score: 8.0, notes: 'All major brands' },
];

const insertVendor = db.prepare(`
  INSERT INTO vendors (company_name, contact_name, phone, email, specialty, hourly_rate,
    emergency_available, insurance_expiry, service_area, performance_score, notes)
  VALUES (@company_name, @contact_name, @phone, @email, @specialty, @hourly_rate,
    @emergency_available, @insurance_expiry, @service_area, @performance_score, @notes)
`);

for (const v of vendors) {
  insertVendor.run(v);
}
console.log(`Seeded ${vendors.length} vendors`);

// ── Work Orders ─────────────────────────────────────────────
const workOrders = [
  { tenant_id: 1, unit_id: 1,  property_id: 1, vendor_id: 1, category: 'plumbing',    priority: 'standard', status: 'completed',   description: 'Leaking kitchen faucet',             tenant_message: 'My kitchen faucet has been dripping all week',               ai_classification: 'maintenance', cost: 150, created_at: '2026-01-15 09:00:00', dispatched_at: '2026-01-15 10:00:00', completed_at: '2026-01-16 14:00:00' },
  { tenant_id: 5, unit_id: 7,  property_id: 2, vendor_id: 2, category: 'electrical',  priority: 'urgent',   status: 'completed',   description: 'Outlet not working in bedroom',      tenant_message: 'None of the outlets on one wall in my bedroom work anymore', ai_classification: 'maintenance', cost: 200, created_at: '2026-01-20 15:00:00', dispatched_at: '2026-01-20 15:30:00', completed_at: '2026-01-21 11:00:00' },
  { tenant_id: 10, unit_id: 16, property_id: 4, vendor_id: 3, category: 'hvac',       priority: 'standard', status: 'in_progress', description: 'Furnace making loud banging noise',  tenant_message: 'My furnace started making a loud banging noise last night',  ai_classification: 'maintenance', cost: null, created_at: '2026-02-10 08:00:00', dispatched_at: '2026-02-10 09:00:00', completed_at: null },
  { tenant_id: 15, unit_id: 21, property_id: 5, vendor_id: 4, category: 'general',    priority: 'low',      status: 'new',         description: 'Squeaky front door',                 tenant_message: 'My front door squeaks really loud every time I open it',     ai_classification: 'maintenance', cost: null, created_at: '2026-02-14 12:00:00', dispatched_at: null, completed_at: null },
  { tenant_id: 22, unit_id: 29, property_id: 7, vendor_id: 1, category: 'plumbing',   priority: 'emergency', status: 'dispatched', description: 'Pipe burst under kitchen sink',       tenant_message: 'HELP water is spraying everywhere under my kitchen sink!!!', ai_classification: 'emergency',   cost: null, created_at: '2026-02-17 22:00:00', dispatched_at: '2026-02-17 22:15:00', completed_at: null },
  { tenant_id: 30, unit_id: 37, property_id: 9, vendor_id: 6, category: 'pest',       priority: 'standard', status: 'dispatched',  description: 'Mouse sighting in kitchen',          tenant_message: 'I saw a mouse in my kitchen this morning',                   ai_classification: 'maintenance', cost: null, created_at: '2026-02-12 07:30:00', dispatched_at: '2026-02-13 08:00:00', completed_at: null },
  { tenant_id: 35, unit_id: 42, property_id: 11, vendor_id: 7, category: 'appliance', priority: 'urgent',   status: 'in_progress', description: 'Refrigerator stopped cooling',       tenant_message: 'My fridge is warm inside, everything is going to spoil',     ai_classification: 'maintenance', cost: null, created_at: '2026-02-16 16:00:00', dispatched_at: '2026-02-16 17:00:00', completed_at: null },
];

const insertWorkOrder = db.prepare(`
  INSERT INTO work_orders (tenant_id, unit_id, property_id, vendor_id, category, priority, status,
    description, tenant_message, ai_classification, cost, created_at, dispatched_at, completed_at, notes)
  VALUES (@tenant_id, @unit_id, @property_id, @vendor_id, @category, @priority, @status,
    @description, @tenant_message, @ai_classification, @cost, @created_at, @dispatched_at, @completed_at, NULL)
`);

for (const wo of workOrders) {
  insertWorkOrder.run(wo);
}
console.log(`Seeded ${workOrders.length} work orders`);

// ── Rent Ledger (February 2026) ─────────────────────────────
const insertLedger = db.prepare(`
  INSERT INTO rent_ledger (tenant_id, unit_id, month, year, amount_due, amount_paid, date_paid,
    payment_method, status, late_fee, notes)
  VALUES (@tenant_id, @unit_id, @month, @year, @amount_due, @amount_paid, @date_paid,
    @payment_method, @status, @late_fee, @notes)
`);

const unpaidTenantIndices = [7, 18, 33]; // three unpaid tenants

for (let i = 0; i < allTenants.length; i++) {
  const t = allTenants[i];
  const isUnpaid = unpaidTenantIndices.includes(i);
  const isLate = i === 12; // one paid late

  let status, amount_paid, date_paid, late_fee;
  if (isUnpaid) {
    status = 'unpaid';
    amount_paid = 0;
    date_paid = null;
    late_fee = 0;
  } else if (isLate) {
    status = 'late';
    amount_paid = t.rent_amount;
    date_paid = '2026-02-08';
    late_fee = 50;
  } else {
    status = 'paid';
    amount_paid = t.rent_amount;
    date_paid = `2026-02-0${1 + (i % 5)}`;
    late_fee = 0;
  }

  insertLedger.run({
    tenant_id: t.id,
    unit_id: t.unit_id,
    month: 2,
    year: 2026,
    amount_due: t.rent_amount,
    amount_paid,
    date_paid,
    payment_method: isUnpaid ? null : t.payment_method,
    status,
    late_fee,
    notes: isUnpaid ? 'No payment received' : null,
  });
}
console.log(`Seeded ${allTenants.length} rent ledger entries`);

// ── Notifications ───────────────────────────────────────────
const notifications = [
  { type: 'emergency', recipient: 'owner', message: 'EMERGENCY: Pipe burst at 688 Prospect Ave Unit 1 (tenant: Dorothy Caron). Vendor dispatched.', related_work_order_id: 5, status: 'sent', created_at: '2026-02-17 22:00:00', sent_at: '2026-02-17 22:01:00' },
  { type: 'approval_needed', recipient: 'owner', message: 'Work order #3 (HVAC - furnace banging) at 313 Waldo St Unit 3 may exceed $500. Approve?', related_work_order_id: 3, status: 'pending', created_at: '2026-02-10 09:30:00', sent_at: null },
  { type: 'info', recipient: 'manager', message: '3 tenants have unpaid rent for February 2026. Review collection actions.', related_work_order_id: null, status: 'pending', created_at: '2026-02-10 08:00:00', sent_at: null },
];

const insertNotification = db.prepare(`
  INSERT INTO notifications (type, recipient, message, related_work_order_id, status, created_at, sent_at)
  VALUES (@type, @recipient, @message, @related_work_order_id, @status, @created_at, @sent_at)
`);

for (const n of notifications) {
  insertNotification.run(n);
}
console.log(`Seeded ${notifications.length} notifications`);

// ── Conversations ───────────────────────────────────────────
const conversations = [
  { tenant_id: 22, direction: 'inbound',  message: 'HELP water is spraying everywhere under my kitchen sink!!!', classification: 'emergency', ai_response: null, created_at: '2026-02-17 22:00:00' },
  { tenant_id: 22, direction: 'outbound', message: 'Dorothy, this is an emergency and we are responding immediately. A plumber has been dispatched and should arrive within 30 minutes. In the meantime, please turn off the water shut-off valve under the sink if you can safely do so. — Management', classification: 'emergency', ai_response: null, created_at: '2026-02-17 22:02:00' },
  { tenant_id: 1,  direction: 'inbound',  message: 'My kitchen faucet has been dripping all week', classification: 'maintenance', ai_response: null, created_at: '2026-01-15 09:00:00' },
  { tenant_id: 1,  direction: 'outbound', message: 'Hi Sarah, thanks for letting us know about the dripping faucet. We\'ve created a work order and will have our plumber out to take a look. You can expect someone within 1-2 business days. — Management', classification: 'maintenance', ai_response: null, created_at: '2026-01-15 09:05:00' },
];

const insertConversation = db.prepare(`
  INSERT INTO conversations (tenant_id, direction, message, classification, ai_response, created_at)
  VALUES (@tenant_id, @direction, @message, @classification, @ai_response, @created_at)
`);

for (const c of conversations) {
  insertConversation.run(c);
}
console.log(`Seeded ${conversations.length} conversations`);

// ── Property Policies ───────────────────────────────────────
const policyTypes = [
  { policy_type: 'late_fee',    policy_text: 'Rent is due on the 1st of each month. A $50 late fee will be assessed for any payment received after the 5-day grace period (after the 5th). Additional $10/day may apply after 15 days past due.' },
  { policy_type: 'pet',         policy_text: 'Pets are allowed with prior written approval. A pet deposit of $250 is required per pet. Maximum 2 pets per unit. Aggressive breeds are not permitted. Tenants are responsible for all pet-related damage and cleaning. Pets must be leashed in common areas.' },
  { policy_type: 'quiet_hours', policy_text: 'Quiet hours are from 10:00 PM to 7:00 AM daily. During these hours, tenants should keep noise to a minimum. Loud music, parties, and disruptive activities are not allowed during quiet hours. Repeated violations may result in lease action.' },
  { policy_type: 'parking',     policy_text: 'Each unit is assigned one parking space where available. Additional vehicles must be parked on the street in accordance with local regulations. No commercial vehicles, unregistered vehicles, or vehicles in disrepair may be parked on the property. Snow removal: vehicles must be moved when plowing is scheduled.' },
  { policy_type: 'smoking',     policy_text: 'All buildings are smoke-free. Smoking is not permitted inside any unit or common area. Smoking is permitted outdoors at least 25 feet from any building entrance. This includes tobacco, e-cigarettes, and marijuana.' },
  { policy_type: 'insurance',   policy_text: 'Renters insurance is strongly recommended for all tenants. The landlord\'s insurance does not cover tenant personal property. Tenants are responsible for any damage to their personal belongings.' },
  { policy_type: 'general',     policy_text: 'Tenants are responsible for keeping their units clean and reporting any maintenance issues promptly. Common areas should be kept clean and free of personal belongings. Trash must be placed in designated containers. Recycling is encouraged. Any alterations to the unit require written landlord approval.' },
];

const insertPolicy = db.prepare(`
  INSERT INTO property_policies (property_id, policy_type, policy_text)
  VALUES (@property_id, @policy_type, @policy_text)
`);

// Apply policies to all properties
for (const prop of properties) {
  const propRow = db.prepare('SELECT id FROM properties WHERE address = ?').get(prop.address);
  for (const pol of policyTypes) {
    insertPolicy.run({ property_id: propRow.id, ...pol });
  }
}
console.log(`Seeded ${properties.length * policyTypes.length} property policies`);

// ── Collection Actions ──────────────────────────────────────
// Add reminder_1 for the 3 unpaid tenants
const insertCollection = db.prepare(`
  INSERT INTO collection_actions (tenant_id, action_type, message_sent, sent_at, tenant_responded, response, notes)
  VALUES (@tenant_id, @action_type, @message_sent, @sent_at, @tenant_responded, @response, @notes)
`);

for (const idx of unpaidTenantIndices) {
  const t = allTenants[idx];
  insertCollection.run({
    tenant_id: t.id,
    action_type: 'reminder_1',
    message_sent: `Hi ${t.first_name}, this is a friendly reminder that your rent payment of $${t.rent_amount} for February is still outstanding. Please submit payment at your earliest convenience. If you have already paid, please disregard this message. — Management`,
    sent_at: '2026-02-08 09:00:00',
    tenant_responded: 0,
    response: null,
    notes: 'Automated first reminder',
  });
}
console.log('Seeded collection actions');

// ── Applications ──────────────────────────────────────────
// Vacant unit IDs from the seed: 5, 10, 20, 28, 35, 42
const applications = [
  // 154 Essex Ave Unit 3A (unit 5) — 2 apps, one under review, one submitted
  { unit_id: 5, property_id: 1, applicant_name: 'Chris Demers', applicant_phone: '207-555-1001', applicant_email: 'chris.demers@email.com', desired_move_in: '2026-03-01', monthly_income: 3200, credit_score: 710, background_check: 'passed', status: 'under_review', submitted_at: '2026-02-05 10:00:00', notes: 'Works at Boise Cascade mill' },
  { unit_id: 5, property_id: 1, applicant_name: 'Amy Tremblay', applicant_phone: '207-555-1002', applicant_email: 'amy.tremblay@email.com', desired_move_in: '2026-03-15', monthly_income: 2800, credit_score: 680, background_check: 'pending', status: 'submitted', submitted_at: '2026-02-12 14:30:00', notes: 'Single parent, 1 child' },

  // 16 Osgood Ave Unit 4 (unit 10) — 1 app, approved
  { unit_id: 10, property_id: 2, applicant_name: 'Tyler Gaudet', applicant_phone: '207-555-1003', applicant_email: 'tyler.gaudet@email.com', desired_move_in: '2026-03-01', monthly_income: 2400, credit_score: 730, background_check: 'passed', status: 'approved', submitted_at: '2026-01-28 09:00:00', reviewed_at: '2026-02-03 11:00:00', notes: 'Lease signing scheduled for Feb 20' },

  // 429 Penobscot St Unit 201 (unit 20) — 3 apps, mixed statuses
  { unit_id: 20, property_id: 5, applicant_name: 'Michelle Cote', applicant_phone: '207-555-1004', applicant_email: 'michelle.cote@email.com', desired_move_in: '2026-03-01', monthly_income: 2600, credit_score: 650, background_check: 'failed', status: 'denied', submitted_at: '2026-01-20 16:00:00', reviewed_at: '2026-01-25 10:00:00', denied_reason: 'Prior eviction on record', notes: null },
  { unit_id: 20, property_id: 5, applicant_name: 'Derek Fontaine', applicant_phone: '207-555-1005', applicant_email: 'derek.fontaine@email.com', desired_move_in: '2026-03-01', monthly_income: 3500, credit_score: 740, background_check: 'passed', status: 'under_review', submitted_at: '2026-02-08 11:15:00', notes: 'IT professional, works remotely' },
  { unit_id: 20, property_id: 5, applicant_name: 'Sara Boucher', applicant_phone: '207-555-1006', applicant_email: 'sara.boucher@email.com', desired_move_in: '2026-04-01', monthly_income: 2900, credit_score: 695, background_check: 'pending', status: 'submitted', submitted_at: '2026-02-14 08:45:00', notes: 'Relocating from Lewiston' },

  // 688 Prospect Ave Unit 4 (unit 28) — no applications (stays empty)

  // 39 Carlton Ave Unit D (unit 35) — 1 app, submitted
  { unit_id: 35, property_id: 9, applicant_name: 'Jake Pelchat', applicant_phone: '207-555-1007', applicant_email: 'jake.pelchat@email.com', desired_move_in: '2026-04-01', monthly_income: 4200, credit_score: 760, background_check: 'pending', status: 'submitted', submitted_at: '2026-02-16 13:00:00', notes: 'Young couple, no pets' },

  // 6 Dix Ave Unit 3 (unit 42) — 1 app, withdrawn
  { unit_id: 42, property_id: 11, applicant_name: 'Lisa Ouellette', applicant_phone: '207-555-1008', applicant_email: 'lisa.ouellette@email.com', desired_move_in: '2026-03-01', monthly_income: 2200, credit_score: 700, background_check: 'waived', status: 'withdrawn', submitted_at: '2026-02-01 10:00:00', reviewed_at: '2026-02-10 09:00:00', notes: 'Applicant found another unit' },
];

const insertApplication = db.prepare(`
  INSERT INTO applications (unit_id, property_id, applicant_name, applicant_phone, applicant_email,
    desired_move_in, monthly_income, credit_score, background_check, status, submitted_at, reviewed_at, denied_reason, notes)
  VALUES (@unit_id, @property_id, @applicant_name, @applicant_phone, @applicant_email,
    @desired_move_in, @monthly_income, @credit_score, @background_check, @status, @submitted_at,
    @reviewed_at, @denied_reason, @notes)
`);

for (const app of applications) {
  insertApplication.run({
    reviewed_at: null,
    denied_reason: null,
    notes: null,
    ...app,
  });
}
console.log(`Seeded ${applications.length} applications`);

db.close();
console.log('\nDatabase seeded successfully!');
