import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

const STATUS_FLOW = ['Draft', 'Sent', 'Confirmed', 'Shipped', 'In Transit', 'Delivered'];

function getNextOrderNumber(db) {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1").get(`ZL-${year}-%`);
  if (!last) return `ZL-${year}-0001`;
  const num = parseInt(last.order_number.split('-')[2]) + 1;
  return `ZL-${year}-${String(num).padStart(4, '0')}`;
}

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, supplier_id, search, sort_by, sort_dir, date_from, date_to } = req.query;
  let sql = `SELECT o.*, s.company_name as supplier_name,
    (SELECT COUNT(*) FROM documents d WHERE d.order_id = o.id) as document_count
    FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (supplier_id) { sql += ' AND o.supplier_id = ?'; params.push(supplier_id); }
  if (date_from) { sql += ' AND o.order_date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND o.order_date <= ?'; params.push(date_to); }
  if (search) {
    sql += ' AND (o.order_number LIKE ? OR o.product_name LIKE ? OR s.company_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const sortCol = { date: 'o.order_date', status: 'o.status', delivery: 'o.expected_delivery_date', amount: 'o.total_amount' }[sort_by] || 'o.created_at';
  const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortCol} ${dir}`;

  res.json(db.prepare(sql).all(...params));
});

router.get('/stats', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const active = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('Draft', 'Delivered')").get();
  const pending = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('Confirmed', 'Shipped')").get();
  const arrivingThisWeek = db.prepare("SELECT COUNT(*) as count FROM orders WHERE expected_delivery_date BETWEEN ? AND ? AND status != 'Delivered'").get(today, weekFromNow);

  // Alerts: overdue (Sent > 7 days without Confirmed), missing docs, arriving soon
  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count FROM orders o
    WHERE o.status = 'Sent' AND julianday('now') - julianday(o.order_date) > 7
  `).get();
  const missingDocsCount = db.prepare(`
    SELECT COUNT(*) as count FROM orders o
    WHERE o.status IN ('Confirmed', 'Shipped', 'In Transit')
    AND (SELECT COUNT(*) FROM documents d WHERE d.order_id = o.id) = 0
  `).get();
  const alertCount = (overdueCount?.count || 0) + (missingDocsCount?.count || 0);

  // Monthly stats for charts
  const monthlyOrders = db.prepare(`
    SELECT strftime('%Y-%m', order_date) as month, COUNT(*) as count, SUM(total_amount) as total
    FROM orders WHERE order_date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all();

  const statusBreakdown = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();

  const spendBySupplier = db.prepare(`
    SELECT s.company_name, SUM(o.total_amount) as total
    FROM orders o JOIN suppliers s ON o.supplier_id = s.id
    GROUP BY o.supplier_id ORDER BY total DESC LIMIT 5
  `).all();

  res.json({
    active_orders: active.count,
    pending_shipment: pending.count,
    arriving_this_week: arrivingThisWeek.count,
    alert_count: alertCount,
    monthly_orders: monthlyOrders,
    status_breakdown: statusBreakdown,
    spend_by_supplier: spendBySupplier,
  });
});

router.get('/alerts', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const overdue = db.prepare(`
    SELECT o.*, s.company_name as supplier_name FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.status = 'Sent' AND julianday('now') - julianday(o.order_date) > 7
  `).all();

  const missingDocs = db.prepare(`
    SELECT o.*, s.company_name as supplier_name FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.status IN ('Confirmed', 'Shipped', 'In Transit')
    AND (SELECT COUNT(*) FROM documents d WHERE d.order_id = o.id) = 0
  `).all();

  const arrivingSoon = db.prepare(`
    SELECT o.*, s.company_name as supplier_name FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.expected_delivery_date BETWEEN ? AND ? AND o.status != 'Delivered'
  `).all(today, weekFromNow);

  res.json({ overdue, missing_docs: missingDocs, arriving_soon: arrivingSoon });
});

router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, s.company_name as supplier_name, s.contact_person as supplier_contact, s.country as supplier_country
    FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const statusLog = db.prepare(`
    SELECT osl.*, u.display_name as changed_by_name
    FROM order_status_log osl LEFT JOIN users u ON osl.changed_by = u.id
    WHERE osl.order_id = ? ORDER BY osl.changed_at ASC
  `).all(req.params.id);

  const documents = db.prepare(`
    SELECT d.*, dt.name as document_type_name, u.display_name as uploaded_by_name
    FROM documents d
    LEFT JOIN document_types dt ON d.document_type_id = dt.id
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.order_id = ? ORDER BY d.created_at DESC
  `).all(req.params.id);

  res.json({ ...order, status_log: statusLog, documents });
});

router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const id = uuid();
  const order_number = getNextOrderNumber(db);
  const { supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency, total_amount, notes, booking_number, shipping_line } = req.body;

  db.prepare(`INSERT INTO orders (id, order_number, supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency, total_amount, status, notes, booking_number, shipping_line, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)`).run(id, order_number, supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency || 'USD', total_amount || 0, notes, booking_number, shipping_line, req.user.id);

  db.prepare('INSERT INTO order_status_log (id, order_id, from_status, to_status, changed_by, notes) VALUES (?, ?, NULL, ?, ?, ?)').run(uuid(), id, 'Draft', req.user.id, 'Order created');
  db.prepare('INSERT INTO activity_log (id, action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'created', 'order', id, `Order ${order_number} created`, req.user.id);

  res.status(201).json({ id, order_number });
});

router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency, total_amount, notes, booking_number, shipping_line, container_number, vessel_name } = req.body;

  db.prepare(`UPDATE orders SET supplier_id=COALESCE(?,supplier_id), order_date=COALESCE(?,order_date), expected_delivery_date=COALESCE(?,expected_delivery_date), product_name=COALESCE(?,product_name), quantity=COALESCE(?,quantity), unit_size=COALESCE(?,unit_size), currency=COALESCE(?,currency), total_amount=COALESCE(?,total_amount), notes=COALESCE(?,notes), booking_number=COALESCE(?,booking_number), shipping_line=COALESCE(?,shipping_line), container_number=COALESCE(?,container_number), vessel_name=COALESCE(?,vessel_name), updated_at=datetime('now') WHERE id=?`).run(supplier_id, order_date, expected_delivery_date, product_name, quantity, unit_size, currency, total_amount, notes, booking_number, shipping_line, container_number, vessel_name, req.params.id);

  res.json({ success: true });
});

router.put('/:id/status', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status, notes } = req.body;
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const newIdx = STATUS_FLOW.indexOf(status);
  if (newIdx < 0) return res.status(400).json({ error: 'Invalid status' });
  if (newIdx !== currentIdx + 1 && newIdx !== currentIdx) {
    return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, req.params.id);
  db.prepare('INSERT INTO order_status_log (id, order_id, from_status, to_status, changed_by, notes) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), req.params.id, order.status, status, req.user.id, notes || `Status changed to ${status}`);
  db.prepare('INSERT INTO activity_log (id, action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'status_changed', 'order', req.params.id, `Order ${order.order_number} status: ${order.status} → ${status}`, req.user.id);

  res.json({ success: true });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM documents WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM order_status_log WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
