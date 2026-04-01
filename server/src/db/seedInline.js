import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export function seedInline(db) {
  const now = new Date().toISOString();
  const adminId = uuid(), teamId = uuid(), team2Id = uuid();

  db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(adminId, 'admin@zainlogistics.com', bcrypt.hashSync('admin123', 10), 'Zain Admin', 'admin', now, now);
  db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(teamId, 'team@zainlogistics.com', bcrypt.hashSync('team123', 10), 'Sara Al-Masri', 'team', now, now);
  db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)").run(team2Id, 'omar@zainlogistics.com', bcrypt.hashSync('team123', 10), 'Omar Khaled', 'team', now, now);

  const suppliers = [
    { id: uuid(), n: 'Nutland Trading Co.', c: 'Mehmet Yilmaz', e: 'mehmet@nutland.com.tr', p: '+90 532 111 2233', co: 'Turkey' },
    { id: uuid(), n: 'Al Baraka Foods', c: 'Ahmed Hassan', e: 'ahmed@albarakafoods.eg', p: '+20 100 222 3344', co: 'Egypt' },
    { id: uuid(), n: 'Mediterranean Harvest', c: 'Carlos Ruiz', e: 'carlos@medharvest.es', p: '+34 612 333 4455', co: 'Spain' },
    { id: uuid(), n: 'Golden Grain Imports', c: 'Rajesh Patel', e: 'rajesh@goldengrain.in', p: '+91 98765 43210', co: 'India' },
    { id: uuid(), n: 'Pacific Snacks Ltd', c: 'Somchai Prasert', e: 'somchai@pacsnacks.th', p: '+66 81 555 6677', co: 'Thailand' },
    { id: uuid(), n: 'Sahara Dates Co.', c: 'Khalid bin Saeed', e: 'khalid@saharadates.sa', p: '+966 55 444 7788', co: 'Saudi Arabia' },
    { id: uuid(), n: 'Anatolian Spices', c: 'Ayse Demir', e: 'ayse@anatolianspices.tr', p: '+90 544 222 8899', co: 'Turkey' },
    { id: uuid(), n: 'Ceylon Tea Gardens', c: 'Priya Fernando', e: 'priya@ceylontea.lk', p: '+94 77 333 4455', co: 'Sri Lanka' },
    { id: uuid(), n: 'Rio Coffee Exports', c: 'Lucas Ferreira', e: 'lucas@riocoffee.br', p: '+55 21 5555 6677', co: 'Brazil' },
  ];

  const iS = db.prepare('INSERT INTO suppliers (id,company_name,contact_person,email,phone,country,notes) VALUES (?,?,?,?,?,?,?)');
  for (const s of suppliers) iS.run(s.id, s.n, s.c, s.e, s.p, s.co, null);

  const sup = (name) => suppliers.find(s => s.n.includes(name)).id;
  const users = [adminId, teamId, team2Id];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const today = new Date();
  const d = (offset) => { const dt = new Date(today); dt.setDate(dt.getDate() + offset); return dt.toISOString().split('T')[0]; };

  const orders = [
    { n:'ZL-2026-0001', s:sup('Nutland'), date:d(-23), eta:d(1), prod:'Raw Almonds (Premium Grade)', qty:500, unit:'10kg cartons', cur:'USD', amt:47500, st:'In Transit', bk:'MAEU12345678', ln:'Maersk', cn:'MSKU9876543', vs:'Maersk Seletar' },
    { n:'ZL-2026-0006', s:sup('Al Baraka'), date:d(-25), eta:d(2), prod:'Ground Cumin (500g packs)', qty:800, unit:'500g packs (24/ctn)', cur:'USD', amt:12800, st:'In Transit', bk:'MAEU22334455', ln:'Maersk', cn:'MSKU1122334', vs:'Maersk Eindhoven' },
    { n:'ZL-2026-0007', s:sup('Pacific'), date:d(-21), eta:d(3), prod:'Dried Mango Slices', qty:300, unit:'1kg bags (12/ctn)', cur:'USD', amt:15600, st:'In Transit', bk:'EGLV55667788', ln:'Evergreen', cn:'EGLU4455667', vs:'Ever Golden' },
    { n:'ZL-2026-0008', s:sup('Sahara'), date:d(-28), eta:d(1), prod:'Medjool Dates (Jumbo)', qty:400, unit:'5kg boxes', cur:'SAR', amt:84000, st:'In Transit', bk:'HLCU99001122', ln:'Hapag-Lloyd', cn:'HLXU8899001', vs:'Tihama' },
    { n:'ZL-2026-0009', s:sup('Golden'), date:d(-24), eta:d(4), prod:'Basmati Rice (1121 Extra Long)', qty:600, unit:'25kg bags', cur:'USD', amt:33000, st:'In Transit', bk:'MSCU33445566', ln:'MSC', cn:'MSCU2233445', vs:'MSC Gulsun' },
    { n:'ZL-2026-0010', s:sup('Anatolian'), date:d(-22), eta:d(2), prod:'Sumac Powder (Bulk)', qty:200, unit:'10kg sacks', cur:'USD', amt:9200, st:'In Transit', bk:'CMAU11223344', ln:'CMA CGM', cn:'CMAU5566778', vs:'CMA CGM Titus' },
    { n:'ZL-2026-0011', s:sup('Ceylon'), date:d(-26), eta:d(3), prod:'Ceylon Black Tea (BOPF)', qty:350, unit:'1kg packs (20/ctn)', cur:'USD', amt:28700, st:'In Transit', bk:'MAEU44556677', ln:'Maersk', cn:'MSKU3344556', vs:'Maersk Seletar' },
    { n:'ZL-2026-0012', s:sup('Nutland'), date:d(-19), eta:d(5), prod:'Roasted Pistachios (Salted)', qty:250, unit:'5kg cartons', cur:'USD', amt:52500, st:'In Transit', bk:'HLCU33445566', ln:'Hapag-Lloyd', cn:'HLXU6677889', vs:'Berlin Express' },
    { n:'ZL-2026-0013', s:sup('Mediterranean'), date:d(-27), eta:d(4), prod:'Kalamata Olives (Pitted)', qty:180, unit:'3kg jars (4/ctn)', cur:'EUR', amt:14400, st:'In Transit', bk:'CMAU55667788', ln:'CMA CGM', cn:'CMAU9900112', vs:'CMA CGM Marco Polo' },
    { n:'ZL-2026-0014', s:sup('Rio'), date:d(-32), eta:d(6), prod:'Arabica Coffee Beans (Medium Roast)', qty:400, unit:'5kg bags', cur:'USD', amt:46000, st:'In Transit', bk:'MSCU77889900', ln:'MSC', cn:'MSCU6677889', vs:'MSC Oscar' },
    { n:'ZL-2026-0015', s:sup('Al Baraka'), date:d(-23), eta:d(2), prod:"Za'atar Mix (Premium)", qty:500, unit:'250g packs (48/ctn)', cur:'USD', amt:18500, st:'In Transit', bk:'MAEU66778899', ln:'Maersk', cn:'MSKU7788990', vs:'Maersk Eindhoven' },
    { n:'ZL-2026-0016', s:sup('Sahara'), date:d(-25), eta:d(1), prod:'Ajwa Dates (Premium)', qty:150, unit:'1kg gift boxes (12/ctn)', cur:'SAR', amt:67500, st:'In Transit', bk:'HLCU11223399', ln:'Hapag-Lloyd', cn:'HLXU1122339', vs:'Tihama' },
    { n:'ZL-2026-0017', s:sup('Pacific'), date:d(-20), eta:d(5), prod:'Coconut Chips (Toasted)', qty:200, unit:'500g bags (20/ctn)', cur:'THB', amt:340000, st:'In Transit', bk:'EGLV99001133', ln:'Evergreen', cn:'EGLU8899002', vs:'Ever Golden' },
    { n:'ZL-2026-0018', s:sup('Golden'), date:d(-26), eta:d(3), prod:'Red Lentils (Split)', qty:800, unit:'25kg bags', cur:'USD', amt:24000, st:'In Transit', bk:'CMAU99887766', ln:'CMA CGM', cn:'CMAU1122335', vs:'CMA CGM Titus' },
    { n:'ZL-2026-0019', s:sup('Nutland'), date:d(-18), eta:d(6), prod:'Dried Figs (Smyrna)', qty:300, unit:'5kg cartons', cur:'USD', amt:21000, st:'In Transit', bk:'MAEU88990011', ln:'Maersk', cn:'MSKU8899001', vs:'Maersk Seletar' },
    { n:'ZL-2026-0020', s:sup('Anatolian'), date:d(-24), eta:d(4), prod:'Paprika Flakes (Mild)', qty:150, unit:'5kg sacks', cur:'TRY', amt:52500, st:'In Transit', bk:'CMAU22334466', ln:'CMA CGM', cn:'CMAU3344557', vs:'CMA CGM Marco Polo' },
    { n:'ZL-2026-0021', s:sup('Mediterranean'), date:d(-22), eta:d(2), prod:'Extra Virgin Olive Oil (Organic)', qty:100, unit:'5L tins (4/ctn)', cur:'EUR', amt:22000, st:'In Transit', bk:'MSCU55667700', ln:'MSC', cn:'MSCU4455668', vs:'MSC Gulsun' },
    { n:'ZL-2026-0022', s:sup('Ceylon'), date:d(-27), eta:d(5), prod:'Green Tea (Gunpowder)', qty:200, unit:'500g tins (24/ctn)', cur:'USD', amt:16800, st:'In Transit', bk:'HLCU44556688', ln:'Hapag-Lloyd', cn:'HLXU2233448', vs:'Hamburg Express' },
    { n:'ZL-2026-0023', s:sup('Rio'), date:d(-30), eta:d(6), prod:'Robusta Coffee Beans (Dark Roast)', qty:300, unit:'5kg bags', cur:'USD', amt:27000, st:'In Transit', bk:'MAEU99001122', ln:'Maersk', cn:'MSKU9900113', vs:'Maersk Sentosa' },
    { n:'ZL-2026-0002', s:sup('Mediterranean'), date:d(-18), eta:d(18), prod:'Extra Virgin Olive Oil (5L)', qty:200, unit:'5L bottles (4/ctn)', cur:'EUR', amt:32000, st:'Confirmed', bk:null, ln:null, cn:null, vs:null },
    { n:'ZL-2026-0024', s:sup('Sahara'), date:d(-13), eta:d(23), prod:'Sukkari Dates (Bulk)', qty:250, unit:'10kg cartons', cur:'SAR', amt:56250, st:'Confirmed', bk:null, ln:null, cn:null, vs:null },
    { n:'ZL-2026-0003', s:sup('Nutland'), date:d(-41), eta:d(-18), prod:'Dried Apricots (Sun-Dried)', qty:300, unit:'5kg cartons', cur:'USD', amt:18900, st:'Delivered', bk:'HLCU87654321', ln:'Hapag-Lloyd', cn:'HLXU5544332', vs:'Berlin Express' },
    { n:'ZL-2026-0025', s:sup('Al Baraka'), date:d(-51), eta:d(-28), prod:'Turmeric Powder (Organic)', qty:400, unit:'1kg packs (12/ctn)', cur:'USD', amt:14400, st:'Delivered', bk:'CMAU77889955', ln:'CMA CGM', cn:'CMAU6677882', vs:'CMA CGM Titus' },
    { n:'ZL-2026-0004', s:sup('Golden'), date:d(-28), eta:d(8), prod:'Basmati Rice (1121 Long Grain)', qty:150, unit:'25kg bags', cur:'USD', amt:22500, st:'Sent', bk:'MSCU11223344', ln:'MSC', cn:null, vs:null },
    { n:'ZL-2026-0026', s:sup('Pacific'), date:d(-32), eta:d(-3), prod:'Tapioca Starch (Industrial)', qty:500, unit:'50kg bags', cur:'USD', amt:17500, st:'Sent', bk:null, ln:null, cn:null, vs:null },
    { n:'ZL-2026-0027', s:sup('Anatolian'), date:d(-46), eta:d(-8), prod:'Oregano Dried (Bulk)', qty:100, unit:'10kg sacks', cur:'USD', amt:7800, st:'In Transit', bk:'MAEU55443322', ln:'Maersk', cn:'MSKU5544332', vs:'Maersk Seletar' },
    { n:'ZL-2026-0028', s:sup('Golden'), date:d(-43), eta:d(-5), prod:'Chickpeas (Kabuli)', qty:400, unit:'25kg bags', cur:'USD', amt:16000, st:'Shipped', bk:'MSCU88776655', ln:'MSC', cn:'MSCU7766554', vs:'MSC Oscar' },
    { n:'ZL-2026-0005', s:sup('Nutland'), date:d(-1), eta:null, prod:'Mixed Nuts Assortment', qty:100, unit:'2kg packs (6/ctn)', cur:'USD', amt:8500, st:'Draft', bk:null, ln:null, cn:null, vs:null },
    { n:'ZL-2026-0029', s:sup('Rio'), date:d(0), eta:null, prod:'Decaf Arabica Beans', qty:100, unit:'1kg bags (12/ctn)', cur:'USD', amt:13200, st:'Draft', bk:null, ln:null, cn:null, vs:null },
    { n:'ZL-2026-0030', s:sup('Ceylon'), date:d(0), eta:null, prod:'Earl Grey Tea Bags', qty:500, unit:'100-ct boxes (12/ctn)', cur:'USD', amt:19500, st:'Draft', bk:null, ln:null, cn:null, vs:null },
  ];

  const STATUS_FLOW = ['Draft','Sent','Confirmed','Shipped','In Transit','Delivered'];
  const iO = db.prepare('INSERT INTO orders (id,order_number,supplier_id,order_date,expected_delivery_date,product_name,quantity,unit_size,currency,total_amount,status,booking_number,shipping_line,container_number,vessel_name,created_by,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const iL = db.prepare('INSERT INTO order_status_log (id,order_id,from_status,to_status,changed_by,changed_at,notes) VALUES (?,?,?,?,?,?,?)');

  for (const o of orders) {
    const oid = uuid();
    o.id = oid;
    iO.run(oid, o.n, o.s, o.date, o.eta, o.prod, o.qty, o.unit, o.cur, o.amt, o.st, o.bk, o.ln, o.cn, o.vs, pick(users), null);
    const ti = STATUS_FLOW.indexOf(o.st);
    let dt = new Date(o.date);
    for (let i = 0; i <= ti; i++) {
      iL.run(uuid(), oid, i === 0 ? null : STATUS_FLOW[i-1], STATUS_FLOW[i], pick(users), dt.toISOString(), `Status: ${STATUS_FLOW[i]}`);
      dt = new Date(dt.getTime() + (1 + Math.random()*3)*86400000);
    }
  }

  // Document types
  const docTypes = ['Commercial Invoice','Packing List','Bill of Lading','Certificate of Origin','Shipping Advice','Purchase Order','Delivery Note','Customs Declaration','Insurance Certificate','Other'];
  const dtIds = {};
  const iDT = db.prepare('INSERT INTO document_types (id,name) VALUES (?,?)');
  for (const dt of docTypes) { const id = uuid(); iDT.run(id, dt); dtIds[dt] = id; }

  // Documents
  const iD = db.prepare('INSERT INTO documents (id,order_id,document_type_id,file_name,original_name,file_size,mime_type,uploaded_by) VALUES (?,?,?,?,?,?,?,?)');
  for (const o of orders) {
    if (o.st === 'Draft' || o.st === 'Sent' || o.n === 'ZL-2026-0002' || o.n === 'ZL-2026-0024') continue;
    iD.run(uuid(), o.id, dtIds['Purchase Order'], `po_${o.n}.pdf`, `PO_${o.n}.pdf`, 98000, 'application/pdf', pick(users));
    if (o.bk) {
      iD.run(uuid(), o.id, dtIds['Commercial Invoice'], `ci_${o.n}.pdf`, `Invoice_${o.n}.pdf`, 120000, 'application/pdf', pick(users));
      iD.run(uuid(), o.id, dtIds['Bill of Lading'], `bl_${o.n}.pdf`, `BL_${o.bk}.pdf`, 150000, 'application/pdf', pick(users));
    }
    if (o.st === 'Delivered') {
      iD.run(uuid(), o.id, dtIds['Delivery Note'], `dn_${o.n}.pdf`, `DN_${o.n}.pdf`, 85000, 'application/pdf', pick(users));
    }
  }

  // Notification settings
  const iNS = db.prepare('INSERT INTO notification_settings (id,type,enabled,threshold_days) VALUES (?,?,?,?)');
  iNS.run(uuid(), 'order_confirmed', 1, 0);
  iNS.run(uuid(), 'shipment_departed', 1, 0);
  iNS.run(uuid(), 'shipment_delayed', 1, 0);
  iNS.run(uuid(), 'shipment_arrived', 1, 0);
  iNS.run(uuid(), 'missing_documents', 1, 5);
  iNS.run(uuid(), 'overdue_shipment', 1, 7);

  // Activity log
  const iA = db.prepare('INSERT INTO activity_log (id,action,entity_type,entity_id,details,user_id,created_at) VALUES (?,?,?,?,?,?,?)');
  const acts = [
    { d: 'Order ZL-2026-0030 created (Draft) — Earl Grey Tea', t: d(0) },
    { d: '19 shipments now In Transit — fleet en route to Aqaba', t: d(0) },
    { d: 'Bill of Lading uploaded for ZL-2026-0001 (Maersk Seletar)', t: d(-11) },
    { d: 'Order ZL-2026-0001 departed Mersin — In Transit', t: d(-12) },
    { d: 'Commercial Invoice uploaded for ZL-2026-0008 (Medjool Dates)', t: d(-12) },
    { d: 'Order ZL-2026-0002 confirmed by Mediterranean Harvest', t: d(-15) },
    { d: 'Order ZL-2026-0003 delivered — cleared Aqaba customs', t: d(-18) },
    { d: "Order ZL-2026-0015 created — Za'atar Mix from Al Baraka", t: d(-23) },
    { d: 'Bulk update: 8 orders moved to Shipped', t: d(-24) },
    { d: 'Order ZL-2026-0004 PO sent to Golden Grain', t: d(-28) },
  ];
  for (const a of acts) iA.run(uuid(), 'activity', 'order', orders[0].id, a.d, pick(users), a.t + 'T10:00:00Z');
}
