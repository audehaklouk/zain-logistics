import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export function seedInline(db) {
  const now = new Date().toISOString();
  const adminId = uuid();
  const teamId = uuid();

  // Users (TEXT UUID PKs — JWT compat)
  db.prepare('INSERT INTO users (id,email,password,display_name,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(adminId, 'admin@zainlogistics.com', bcrypt.hashSync('admin123', 10), 'Zain Admin', 'admin', now, now);
  db.prepare('INSERT INTO users (id,email,password,display_name,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(teamId, 'team@zainlogistics.com', bcrypt.hashSync('team123', 10), 'Sara Al-Masri', 'team', now, now);

  // Suppliers (INTEGER PK — auto-assigned)
  const iS = db.prepare('INSERT INTO suppliers (name,contact_name,contact_email,contact_phone,country,notes) VALUES (?,?,?,?,?,?)');
  iS.run('Nutland Trading Co.', 'Mehmet Yilmaz', 'mehmet@nutland.com.tr', '+90 532 111 2233', 'Turkey', null);
  iS.run('Al Baraka Foods', 'Ahmed Hassan', 'ahmed@albarakafoods.eg', '+20 100 222 3344', 'Egypt', null);
  iS.run('Mediterranean Harvest', 'Carlos Ruiz', 'carlos@medharvest.es', '+34 612 333 4455', 'Spain', null);
  iS.run('Golden Grain Imports', 'Rajesh Patel', 'rajesh@goldengrain.in', '+91 98765 43210', 'India', null);
  iS.run('Pacific Snacks Ltd', 'Somchai Prasert', 'somchai@pacsnacks.th', '+66 81 555 6677', 'Thailand', null);
  iS.run('Sahara Dates Co.', 'Khalid bin Saeed', 'khalid@saharadates.sa', '+966 55 444 7788', 'Saudi Arabia', null);
  iS.run('Anatolian Spices', 'Ayse Demir', 'ayse@anatolianspices.tr', '+90 544 222 8899', 'Turkey', null);
  iS.run('Ceylon Tea Gardens', 'Priya Fernando', 'priya@ceylontea.lk', '+94 77 333 4455', 'Sri Lanka', null);

  // Get supplier IDs
  const sup = (name) => db.prepare('SELECT id FROM suppliers WHERE name LIKE ?').get(`%${name}%`).id;

  const today = new Date();
  const d = (offset) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().split('T')[0];
  };

  // Orders
  const iO = db.prepare(`
    INSERT INTO orders
      (order_number, containers, destination, destination_custom, bank, amount, currency,
       date, category, shipping_tracking_number, expected_arrival, shipping_line, shipping_line_custom,
       tracking_source, original_docs_received, status, product_name, supplier_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // Container builder helpers — new format: [{type, number}, ...]
  const mkC = (type, number = '') => ({ type, number });

  const orders = [
    {
      n: 'ORD-2026-001',
      containers: JSON.stringify([mkC('40ft','MSKU9876543'), mkC('40ft','MSKU9876544')]),
      dest: 'aqaba', bank: 'Arab Bank', amount: 47500, currency: 'USD',
      date: d(-23), cat: 'nuts', eta: d(1), line: 'maersk', tracking: 'MAEU12345678',
      docs: 1, status: 'in_transit', prod: 'Raw Almonds (Premium Grade)', sup: sup('Nutland')
    },
    {
      n: 'ORD-2026-002',
      containers: JSON.stringify([mkC('40ft'), mkC('20ft')]),
      dest: 'aqaba', bank: 'Cairo Bank', amount: 32000, currency: 'EUR',
      date: d(-18), cat: 'other', eta: d(18), line: 'maersk', tracking: null,
      docs: 0, status: 'confirmed', prod: 'Extra Virgin Olive Oil (5L)', sup: sup('Mediterranean')
    },
    {
      n: 'ORD-2026-003',
      containers: JSON.stringify([mkC('40ft','HLXU8899001'), mkC('40ft','HLXU8899002'), mkC('40ft','HLXU8899003')]),
      dest: 'aqaba', bank: 'Arab Bank', amount: 84000, currency: 'USD',
      date: d(-28), cat: 'brands', eta: d(1), line: 'hapag_lloyd', tracking: 'HLCU99001122',
      docs: 1, status: 'in_transit', prod: 'Medjool Dates (Jumbo)', sup: sup('Sahara')
    },
    {
      n: 'ORD-2026-004',
      containers: JSON.stringify([mkC('20ft','MSCU2233445'), mkC('20ft')]),
      dest: 'ksa', bank: null, amount: 22500, currency: 'USD',
      date: d(-28), cat: 'nuts', eta: d(8), line: 'msc', tracking: 'MSCU11223344',
      docs: 0, status: 'shipped', prod: 'Basmati Rice (1121 Long Grain)', sup: sup('Golden')
    },
    {
      n: 'ORD-2026-005',
      containers: JSON.stringify([mkC('40ft')]),
      dest: 'mersin', bank: 'Jordan Bank', amount: null, currency: null,
      date: d(-1), cat: 'nuts', eta: null, line: null, tracking: null,
      docs: 0, status: 'pending', prod: 'Mixed Nuts Assortment', sup: sup('Nutland')
    },
    {
      n: 'ORD-2026-006',
      containers: JSON.stringify([mkC('40ft','MSKU7788990'), mkC('40ft','MSKU7788991'), mkC('20ft')]),
      dest: 'aqaba', bank: 'BLOM Bank', amount: 12800, currency: 'USD',
      date: d(-25), cat: 'brands', eta: d(2), line: 'maersk', tracking: 'MAEU22334455',
      docs: 1, status: 'in_transit', prod: 'Ground Cumin (500g packs)', sup: sup('Al Baraka')
    },
    {
      n: 'ORD-2026-007',
      containers: JSON.stringify([mkC('40ft','CMAU5566778')]),
      dest: 'aqaba', bank: 'Cairo Bank', amount: 15600, currency: 'USD',
      date: d(-21), cat: 'all_tasty', eta: d(3), line: 'cma_cgm', tracking: 'CMAU55667788',
      docs: 1, status: 'in_transit', prod: 'Dried Mango Slices', sup: sup('Pacific')
    },
    {
      n: 'ORD-2026-008',
      containers: JSON.stringify([mkC('40ft','HLXU5544332')]),
      dest: 'aqaba', bank: 'Arab Bank', amount: 18900, currency: 'USD',
      date: d(-41), cat: 'nuts', eta: d(-18), line: 'hapag_lloyd', tracking: 'HLCU87654321',
      docs: 1, status: 'delivered', prod: 'Dried Apricots (Sun-Dried)', sup: sup('Nutland')
    },
    {
      n: 'ORD-2026-009',
      containers: JSON.stringify([mkC('20ft','MSCU4455668'), mkC('20ft','MSCU4455669'), mkC('20ft')]),
      dest: 'lattakia', bank: null, amount: 33000, currency: 'USD',
      date: d(-24), cat: 'all_tasty', eta: d(4), line: 'msc', tracking: 'MSCU33445566',
      docs: 0, status: 'in_transit', prod: 'Basmati Rice (1121 Extra Long)', sup: sup('Golden')
    },
    {
      n: 'ORD-2026-010',
      containers: JSON.stringify([mkC('40ft'), mkC('40ft')]),
      dest: 'um_qaser', bank: 'Jordan Islamic Bank', amount: null, currency: null,
      date: d(0), cat: 'brands', eta: null, line: null, tracking: null,
      docs: 0, status: 'pending', prod: 'Earl Grey Tea Bags', sup: sup('Ceylon')
    },
  ];

  for (const o of orders) {
    iO.run(
      o.n, o.containers, o.dest, null, o.bank, o.amount, o.currency,
      o.date, o.cat, o.tracking, o.eta, o.line, null,
      o.tracking ? 'api' : 'manual', o.docs, o.status, o.prod, o.sup
    );
  }

  // Activity log entries
  const iA = db.prepare('INSERT INTO activity_log (id,action,entity_type,entity_id,details,user_id,created_at) VALUES (?,?,?,?,?,?,?)');
  iA.run(uuid(), 'created', 'order', '10', 'Order ORD-2026-010 created — Earl Grey Tea Bags', adminId, d(0) + 'T09:00:00Z');
  iA.run(uuid(), 'status_changed', 'order', '3', 'ORD-2026-003 status: confirmed → in_transit', teamId, d(-22) + 'T14:30:00Z');
  iA.run(uuid(), 'status_changed', 'order', '8', 'ORD-2026-008 status: in_transit → delivered', adminId, d(-18) + 'T11:00:00Z');
  iA.run(uuid(), 'created', 'order', '5', 'Order ORD-2026-005 created — Mixed Nuts Assortment', teamId, d(-1) + 'T10:00:00Z');
  iA.run(uuid(), 'status_changed', 'order', '4', 'ORD-2026-004 status: confirmed → shipped', adminId, d(-20) + 'T16:00:00Z');
}
