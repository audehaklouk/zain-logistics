import { getDb } from './database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = getDb();

db.exec(`
  DELETE FROM activity_log;
  DELETE FROM notifications;
  DELETE FROM notification_settings;
  DELETE FROM documents;
  DELETE FROM document_types;
  DELETE FROM order_status_log;
  DELETE FROM orders;
  DELETE FROM suppliers;
  DELETE FROM users;
`);

// ── Users ──
const adminId = uuid();
const teamId = uuid();
const team2Id = uuid();
const now = new Date().toISOString();
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(adminId, 'admin@zainlogistics.com', bcrypt.hashSync('admin123', 10), 'Zain Admin', 'admin', now, now);
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(teamId, 'team@zainlogistics.com', bcrypt.hashSync('team123', 10), 'Sara Al-Masri', 'team', now, now);
db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(team2Id, 'omar@zainlogistics.com', bcrypt.hashSync('team123', 10), 'Omar Khaled', 'team', now, now);

// ── Suppliers ──
const suppliers = [
  { id: uuid(), company_name: 'Nutland Trading Co.', contact_person: 'Mehmet Yilmaz', email: 'mehmet@nutland.com.tr', phone: '+90 532 111 2233', country: 'Turkey', notes: 'Premium nuts and dried fruits. Reliable quality.' },
  { id: uuid(), company_name: 'Al Baraka Foods', contact_person: 'Ahmed Hassan', email: 'ahmed@albarakafoods.eg', phone: '+20 100 222 3344', country: 'Egypt', notes: 'Spices and herbs. Competitive pricing.' },
  { id: uuid(), company_name: 'Mediterranean Harvest', contact_person: 'Carlos Ruiz', email: 'carlos@medharvest.es', phone: '+34 612 333 4455', country: 'Spain', notes: 'Olive oil and olives. Organic certified.' },
  { id: uuid(), company_name: 'Golden Grain Imports', contact_person: 'Rajesh Patel', email: 'rajesh@goldengrain.in', phone: '+91 98765 43210', country: 'India', notes: 'Basmati rice and pulses. Large volume capability.' },
  { id: uuid(), company_name: 'Pacific Snacks Ltd', contact_person: 'Somchai Prasert', email: 'somchai@pacsnacks.th', phone: '+66 81 555 6677', country: 'Thailand', notes: 'Snack products and dried tropical fruits.' },
  { id: uuid(), company_name: 'Sahara Dates Co.', contact_person: 'Khalid bin Saeed', email: 'khalid@saharadates.sa', phone: '+966 55 444 7788', country: 'Saudi Arabia', notes: 'Premium Medjool and Ajwa dates.' },
  { id: uuid(), company_name: 'Anatolian Spices', contact_person: 'Ayse Demir', email: 'ayse@anatolianspices.tr', phone: '+90 544 222 8899', country: 'Turkey', notes: 'Cumin, sumac, za\'atar — wholesale.' },
  { id: uuid(), company_name: 'Ceylon Tea Gardens', contact_person: 'Priya Fernando', email: 'priya@ceylontea.lk', phone: '+94 77 333 4455', country: 'Sri Lanka', notes: 'Black and green tea, bulk export.' },
  { id: uuid(), company_name: 'Rio Coffee Exports', contact_person: 'Lucas Ferreira', email: 'lucas@riocoffee.br', phone: '+55 21 5555 6677', country: 'Brazil', notes: 'Arabica coffee beans, fair trade.' },
];

const insertSupplier = db.prepare('INSERT INTO suppliers (id, company_name, contact_person, email, phone, country, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
for (const s of suppliers) insertSupplier.run(s.id, s.company_name, s.contact_person, s.email, s.phone, s.country, s.notes);

// ── Helper to get supplier by name ──
const sup = (name) => suppliers.find(s => s.company_name.includes(name)).id;

// ── Orders — 25 realistic orders ──
const users = [adminId, teamId, team2Id];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const orders = [
  // ─── In Transit — arriving this week (the 19 the user wants to see) ───
  { n: 'ZL-2026-0001', s: sup('Nutland'), date: '2026-03-10', eta: '2026-04-03', product: 'Raw Almonds (Premium Grade)', qty: 500, unit: '10kg cartons', cur: 'USD', amt: 47500, status: 'In Transit', booking: 'MAEU12345678', line: 'Maersk', container: 'MSKU9876543', vessel: 'Maersk Seletar' },
  { n: 'ZL-2026-0006', s: sup('Al Baraka'), date: '2026-03-08', eta: '2026-04-04', product: 'Ground Cumin (500g packs)', qty: 800, unit: '500g retail packs (24/carton)', cur: 'USD', amt: 12800, status: 'In Transit', booking: 'MAEU22334455', line: 'Maersk', container: 'MSKU1122334', vessel: 'Maersk Eindhoven' },
  { n: 'ZL-2026-0007', s: sup('Pacific'), date: '2026-03-12', eta: '2026-04-05', product: 'Dried Mango Slices', qty: 300, unit: '1kg bags (12/carton)', cur: 'USD', amt: 15600, status: 'In Transit', booking: 'EGLV55667788', line: 'Evergreen', container: 'EGLU4455667', vessel: 'Ever Golden' },
  { n: 'ZL-2026-0008', s: sup('Sahara'), date: '2026-03-05', eta: '2026-04-03', product: 'Medjool Dates (Jumbo)', qty: 400, unit: '5kg boxes', cur: 'SAR', amt: 84000, status: 'In Transit', booking: 'HLCU99001122', line: 'Hapag-Lloyd', container: 'HLXU8899001', vessel: 'Tihama' },
  { n: 'ZL-2026-0009', s: sup('Golden'), date: '2026-03-09', eta: '2026-04-06', product: 'Basmati Rice (1121 Extra Long)', qty: 600, unit: '25kg bags', cur: 'USD', amt: 33000, status: 'In Transit', booking: 'MSCU33445566', line: 'MSC', container: 'MSCU2233445', vessel: 'MSC Gulsun' },
  { n: 'ZL-2026-0010', s: sup('Anatolian'), date: '2026-03-11', eta: '2026-04-04', product: 'Sumac Powder (Bulk)', qty: 200, unit: '10kg sacks', cur: 'USD', amt: 9200, status: 'In Transit', booking: 'CMAU11223344', line: 'CMA CGM', container: 'CMAU5566778', vessel: 'CMA CGM Titus' },
  { n: 'ZL-2026-0011', s: sup('Ceylon'), date: '2026-03-07', eta: '2026-04-05', product: 'Ceylon Black Tea (BOPF)', qty: 350, unit: '1kg packs (20/carton)', cur: 'USD', amt: 28700, status: 'In Transit', booking: 'MAEU44556677', line: 'Maersk', container: 'MSKU3344556', vessel: 'Maersk Seletar' },
  { n: 'ZL-2026-0012', s: sup('Nutland'), date: '2026-03-14', eta: '2026-04-07', product: 'Roasted Pistachios (Salted)', qty: 250, unit: '5kg cartons', cur: 'USD', amt: 52500, status: 'In Transit', booking: 'HLCU33445566', line: 'Hapag-Lloyd', container: 'HLXU6677889', vessel: 'Berlin Express' },
  { n: 'ZL-2026-0013', s: sup('Mediterranean'), date: '2026-03-06', eta: '2026-04-06', product: 'Kalamata Olives (Pitted)', qty: 180, unit: '3kg jars (4/carton)', cur: 'EUR', amt: 14400, status: 'In Transit', booking: 'CMAU55667788', line: 'CMA CGM', container: 'CMAU9900112', vessel: 'CMA CGM Marco Polo' },
  { n: 'ZL-2026-0014', s: sup('Rio'), date: '2026-03-01', eta: '2026-04-08', product: 'Arabica Coffee Beans (Medium Roast)', qty: 400, unit: '5kg bags', cur: 'USD', amt: 46000, status: 'In Transit', booking: 'MSCU77889900', line: 'MSC', container: 'MSCU6677889', vessel: 'MSC Oscar' },
  { n: 'ZL-2026-0015', s: sup('Al Baraka'), date: '2026-03-10', eta: '2026-04-04', product: 'Za\'atar Mix (Premium)', qty: 500, unit: '250g packs (48/carton)', cur: 'USD', amt: 18500, status: 'In Transit', booking: 'MAEU66778899', line: 'Maersk', container: 'MSKU7788990', vessel: 'Maersk Eindhoven' },
  { n: 'ZL-2026-0016', s: sup('Sahara'), date: '2026-03-08', eta: '2026-04-03', product: 'Ajwa Dates (Premium)', qty: 150, unit: '1kg gift boxes (12/carton)', cur: 'SAR', amt: 67500, status: 'In Transit', booking: 'HLCU11223399', line: 'Hapag-Lloyd', container: 'HLXU1122339', vessel: 'Tihama' },
  { n: 'ZL-2026-0017', s: sup('Pacific'), date: '2026-03-13', eta: '2026-04-07', product: 'Coconut Chips (Toasted)', qty: 200, unit: '500g bags (20/carton)', cur: 'THB', amt: 340000, status: 'In Transit', booking: 'EGLV99001133', line: 'Evergreen', container: 'EGLU8899002', vessel: 'Ever Golden' },
  { n: 'ZL-2026-0018', s: sup('Golden'), date: '2026-03-07', eta: '2026-04-05', product: 'Red Lentils (Split)', qty: 800, unit: '25kg bags', cur: 'USD', amt: 24000, status: 'In Transit', booking: 'CMAU99887766', line: 'CMA CGM', container: 'CMAU1122335', vessel: 'CMA CGM Titus' },
  { n: 'ZL-2026-0019', s: sup('Nutland'), date: '2026-03-15', eta: '2026-04-08', product: 'Dried Figs (Smyrna)', qty: 300, unit: '5kg cartons', cur: 'USD', amt: 21000, status: 'In Transit', booking: 'MAEU88990011', line: 'Maersk', container: 'MSKU8899001', vessel: 'Maersk Seletar' },
  { n: 'ZL-2026-0020', s: sup('Anatolian'), date: '2026-03-09', eta: '2026-04-06', product: 'Paprika Flakes (Mild)', qty: 150, unit: '5kg sacks', cur: 'TRY', amt: 52500, status: 'In Transit', booking: 'CMAU22334466', line: 'CMA CGM', container: 'CMAU3344557', vessel: 'CMA CGM Marco Polo' },
  { n: 'ZL-2026-0021', s: sup('Mediterranean'), date: '2026-03-11', eta: '2026-04-04', product: 'Extra Virgin Olive Oil (Organic)', qty: 100, unit: '5L tins (4/carton)', cur: 'EUR', amt: 22000, status: 'In Transit', booking: 'MSCU55667700', line: 'MSC', container: 'MSCU4455668', vessel: 'MSC Gulsun' },
  { n: 'ZL-2026-0022', s: sup('Ceylon'), date: '2026-03-06', eta: '2026-04-07', product: 'Green Tea (Gunpowder)', qty: 200, unit: '500g tins (24/carton)', cur: 'USD', amt: 16800, status: 'In Transit', booking: 'HLCU44556688', line: 'Hapag-Lloyd', container: 'HLXU2233448', vessel: 'Hamburg Express' },
  { n: 'ZL-2026-0023', s: sup('Rio'), date: '2026-03-03', eta: '2026-04-08', product: 'Robusta Coffee Beans (Dark Roast)', qty: 300, unit: '5kg bags', cur: 'USD', amt: 27000, status: 'In Transit', booking: 'MAEU99001122', line: 'Maersk', container: 'MSKU9900113', vessel: 'Maersk Sentosa' },

  // ─── Confirmed — pending shipment (no booking yet) ───
  { n: 'ZL-2026-0002', s: sup('Mediterranean'), date: '2026-03-15', eta: '2026-04-20', product: 'Extra Virgin Olive Oil (5L)', qty: 200, unit: '5L bottles (4/carton)', cur: 'EUR', amt: 32000, status: 'Confirmed', booking: null, line: null, container: null, vessel: null },
  { n: 'ZL-2026-0024', s: sup('Sahara'), date: '2026-03-20', eta: '2026-04-25', product: 'Sukkari Dates (Bulk)', qty: 250, unit: '10kg cartons', cur: 'SAR', amt: 56250, status: 'Confirmed', booking: null, line: null, container: null, vessel: null },

  // ─── Delivered ───
  { n: 'ZL-2026-0003', s: sup('Nutland'), date: '2026-02-20', eta: '2026-03-15', product: 'Dried Apricots (Sun-Dried)', qty: 300, unit: '5kg cartons', cur: 'USD', amt: 18900, status: 'Delivered', booking: 'HLCU87654321', line: 'Hapag-Lloyd', container: 'HLXU5544332', vessel: 'Berlin Express' },
  { n: 'ZL-2026-0025', s: sup('Al Baraka'), date: '2026-02-10', eta: '2026-03-05', product: 'Turmeric Powder (Organic)', qty: 400, unit: '1kg packs (12/carton)', cur: 'USD', amt: 14400, status: 'Delivered', booking: 'CMAU77889955', line: 'CMA CGM', container: 'CMAU6677882', vessel: 'CMA CGM Titus' },

  // ─── Overdue — Sent long ago, not confirmed ───
  { n: 'ZL-2026-0004', s: sup('Golden'), date: '2026-03-05', eta: '2026-04-10', product: 'Basmati Rice (1121 Long Grain)', qty: 150, unit: '25kg bags', cur: 'USD', amt: 22500, status: 'Sent', booking: 'MSCU11223344', line: 'MSC', container: null, vessel: null },
  { n: 'ZL-2026-0026', s: sup('Pacific'), date: '2026-03-01', eta: '2026-03-30', product: 'Tapioca Starch (Industrial)', qty: 500, unit: '50kg bags', cur: 'USD', amt: 17500, status: 'Sent', booking: null, line: null, container: null, vessel: null },

  // ─── Overdue — past ETA but not delivered ───
  { n: 'ZL-2026-0027', s: sup('Anatolian'), date: '2026-02-15', eta: '2026-03-25', product: 'Oregano Dried (Bulk)', qty: 100, unit: '10kg sacks', cur: 'USD', amt: 7800, status: 'In Transit', booking: 'MAEU55443322', line: 'Maersk', container: 'MSKU5544332', vessel: 'Maersk Seletar' },
  { n: 'ZL-2026-0028', s: sup('Golden'), date: '2026-02-18', eta: '2026-03-28', product: 'Chickpeas (Kabuli)', qty: 400, unit: '25kg bags', cur: 'USD', amt: 16000, status: 'Shipped', booking: 'MSCU88776655', line: 'MSC', container: 'MSCU7766554', vessel: 'MSC Oscar' },

  // ─── Draft ───
  { n: 'ZL-2026-0005', s: sup('Nutland'), date: '2026-04-01', eta: null, product: 'Mixed Nuts Assortment', qty: 100, unit: '2kg retail packs (6/carton)', cur: 'USD', amt: 8500, status: 'Draft', booking: null, line: null, container: null, vessel: null },
  { n: 'ZL-2026-0029', s: sup('Rio'), date: '2026-04-02', eta: null, product: 'Decaf Arabica Beans', qty: 100, unit: '1kg bags (12/carton)', cur: 'USD', amt: 13200, status: 'Draft', booking: null, line: null, container: null, vessel: null },
  { n: 'ZL-2026-0030', s: sup('Ceylon'), date: '2026-04-02', eta: null, product: 'Earl Grey Tea Bags', qty: 500, unit: '100-count boxes (12/carton)', cur: 'USD', amt: 19500, status: 'Draft', booking: null, line: null, container: null, vessel: null },
];

const insertOrder = db.prepare(`INSERT INTO orders (id, order_number, supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency, total_amount, status, booking_number, shipping_line, container_number, vessel_name, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertLog = db.prepare('INSERT INTO order_status_log (id, order_id, from_status, to_status, changed_by, changed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');

const STATUS_FLOW = ['Draft', 'Sent', 'Confirmed', 'Shipped', 'In Transit', 'Delivered'];

for (const o of orders) {
  const oid = uuid();
  o.id = oid;
  const user = pick(users);
  insertOrder.run(oid, o.n, o.s, o.date, o.eta, o.product, o.qty, o.unit, o.cur, o.amt, o.status, o.booking, o.line, o.container, o.vessel, user, null);

  // Generate status logs up to current status
  const targetIdx = STATUS_FLOW.indexOf(o.status);
  let d = new Date(o.date);
  for (let i = 0; i <= targetIdx; i++) {
    const from = i === 0 ? null : STATUS_FLOW[i - 1];
    insertLog.run(uuid(), oid, from, STATUS_FLOW[i], pick(users), d.toISOString(), `Status: ${STATUS_FLOW[i]}`);
    d = new Date(d.getTime() + (1 + Math.random() * 3) * 86400000); // 1-4 days between each
  }
}

// ── Document types ──
const docTypes = ['Commercial Invoice', 'Packing List', 'Bill of Lading', 'Certificate of Origin', 'Shipping Advice', 'Purchase Order', 'Delivery Note', 'Customs Declaration', 'Insurance Certificate', 'Other'];
const insertDocType = db.prepare('INSERT INTO document_types (id, name) VALUES (?, ?)');
const docTypeIds = {};
for (const dt of docTypes) { const id = uuid(); insertDocType.run(id, dt); docTypeIds[dt] = id; }

// ── Documents for orders that have booking numbers ──
const insertDoc = db.prepare('INSERT INTO documents (id, order_id, document_type_id, file_name, original_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
for (const o of orders) {
  if (o.status === 'Draft' || o.status === 'Sent') continue;
  // Confirmed orders missing docs for ZL-2026-0002 specifically
  if (o.n === 'ZL-2026-0002' || o.n === 'ZL-2026-0024') continue;

  insertDoc.run(uuid(), o.id, docTypeIds['Purchase Order'], `po_${o.n}.pdf`, `PO_${o.n}.pdf`, 98000 + Math.floor(Math.random() * 50000), 'application/pdf', pick(users));
  if (o.booking) {
    insertDoc.run(uuid(), o.id, docTypeIds['Commercial Invoice'], `ci_${o.n}.pdf`, `Invoice_${o.n}.pdf`, 120000 + Math.floor(Math.random() * 80000), 'application/pdf', pick(users));
    insertDoc.run(uuid(), o.id, docTypeIds['Bill of Lading'], `bl_${o.n}.pdf`, `BL_${o.booking}.pdf`, 150000 + Math.floor(Math.random() * 60000), 'application/pdf', pick(users));
  }
  if (o.status === 'Delivered') {
    insertDoc.run(uuid(), o.id, docTypeIds['Delivery Note'], `dn_${o.n}.pdf`, `DeliveryNote_${o.n}.pdf`, 85000 + Math.floor(Math.random() * 30000), 'application/pdf', pick(users));
    insertDoc.run(uuid(), o.id, docTypeIds['Customs Declaration'], `cd_${o.n}.pdf`, `Customs_${o.n}.pdf`, 95000, 'application/pdf', pick(users));
  }
}

// ── Notification settings ──
const insertNS = db.prepare('INSERT INTO notification_settings (id, type, enabled, threshold_days) VALUES (?, ?, ?, ?)');
insertNS.run(uuid(), 'order_confirmed', 1, 0);
insertNS.run(uuid(), 'shipment_departed', 1, 0);
insertNS.run(uuid(), 'shipment_delayed', 1, 0);
insertNS.run(uuid(), 'shipment_arrived', 1, 0);
insertNS.run(uuid(), 'missing_documents', 1, 5);
insertNS.run(uuid(), 'overdue_shipment', 1, 7);

// ── Activity log ──
const insertActivity = db.prepare('INSERT INTO activity_log (id, action, entity_type, entity_id, details, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
const recentOrders = orders.slice(0, 15);
const activities = [
  { a: 'created', d: `Order ZL-2026-0030 created (Draft) — Earl Grey Tea`, t: '2026-04-02T10:15:00Z' },
  { a: 'created', d: `Order ZL-2026-0029 created (Draft) — Decaf Arabica Beans`, t: '2026-04-02T09:30:00Z' },
  { a: 'status_changed', d: `19 shipments now In Transit — fleet en route to Aqaba`, t: '2026-04-01T16:00:00Z' },
  { a: 'document_uploaded', d: `Bill of Lading uploaded for ZL-2026-0001 (Maersk Seletar)`, t: '2026-03-21T10:00:00Z' },
  { a: 'status_changed', d: `Order ZL-2026-0001 departed Mersin — In Transit`, t: '2026-03-20T14:00:00Z' },
  { a: 'document_uploaded', d: `Commercial Invoice uploaded for ZL-2026-0008 (Medjool Dates)`, t: '2026-03-20T11:00:00Z' },
  { a: 'status_changed', d: `Order ZL-2026-0002 confirmed by Mediterranean Harvest`, t: '2026-03-18T09:00:00Z' },
  { a: 'document_uploaded', d: `BL uploaded for ZL-2026-0009 (Basmati Rice — MSC Gulsun)`, t: '2026-03-17T14:30:00Z' },
  { a: 'status_changed', d: `Order ZL-2026-0003 delivered — cleared Aqaba customs`, t: '2026-03-15T10:00:00Z' },
  { a: 'created', d: `Order ZL-2026-0015 created — Za'atar Mix from Al Baraka`, t: '2026-03-10T08:30:00Z' },
  { a: 'status_changed', d: `Bulk update: 8 orders moved to Shipped`, t: '2026-03-09T16:00:00Z' },
  { a: 'created', d: `Order ZL-2026-0014 created — Arabica Coffee from Rio`, t: '2026-03-01T09:00:00Z' },
  { a: 'document_uploaded', d: `Customs Declaration uploaded for ZL-2026-0025 (Turmeric)`, t: '2026-03-06T11:00:00Z' },
  { a: 'status_changed', d: `Order ZL-2026-0025 delivered — Turmeric Powder cleared`, t: '2026-03-05T10:00:00Z' },
  { a: 'status_changed', d: `Order ZL-2026-0004 PO sent to Golden Grain — awaiting confirmation`, t: '2026-03-05T14:00:00Z' },
];
for (const act of activities) {
  insertActivity.run(uuid(), act.a, 'order', orders[0].id, act.d, pick(users), act.t);
}

console.log('Database seeded successfully!');
console.log(`  - 3 users`);
console.log(`  - ${suppliers.length} suppliers`);
console.log(`  - ${orders.length} orders`);
console.log(`  - ${docTypes.length} document types`);
console.log(`  - 19 shipments arriving this week (In Transit)`);
console.log(`  - 2 overdue shipments (past ETA)`);
console.log(`  - 2 confirmed (pending shipment, missing docs)`);
console.log(`  - 2 delivered, 2 sent (overdue confirmation), 3 drafts`);
console.log(`  - Demo login: admin@zainlogistics.com / admin123`);
console.log(`  - Demo login: team@zainlogistics.com / team123`);

process.exit(0);
