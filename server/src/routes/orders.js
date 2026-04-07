import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

function getNextOrderNumber(db) {
  const year = new Date().getFullYear();
  const row = db.prepare(
    "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`ORD-${year}-%`);
  if (!row) return `ORD-${year}-001`;
  const num = parseInt(row.order_number.split('-')[2]) + 1;
  return `ORD-${year}-${String(num).padStart(3, '0')}`;
}

// GET /api/orders — list with search, filter, pagination
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search, status, supplier_id, category, destination, sort_by, sort_dir } = req.query;

  let sql = `
    SELECT o.*, s.name as supplier_name
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (o.order_number LIKE ? OR o.product_name LIKE ? OR s.name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (supplier_id) { sql += ' AND o.supplier_id = ?'; params.push(supplier_id); }
  if (category) { sql += ' AND o.category = ?'; params.push(category); }
  if (destination) { sql += ' AND o.destination = ?'; params.push(destination); }

  const sortMap = { date: 'o.date', status: 'o.status', arrival: 'o.expected_arrival', amount: 'o.amount' };
  const col = sortMap[sort_by] || 'o.id';
  const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${col} ${dir}`;

  res.json(db.prepare(sql).all(...params));
});

// GET /api/orders/stats — dashboard stats
router.get('/stats', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const active = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('pending','delivered','cancelled')").get();
  const inTransit = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'in_transit'").get();
  const arrivingSoon = db.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE expected_arrival BETWEEN ? AND ? AND status NOT IN ('delivered','cancelled')"
  ).get(today, weekFromNow);

  const statusBreakdown = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all();
  const monthlyOrders = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count, SUM(amount) as total
    FROM orders WHERE date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all();

  res.json({
    active_orders: active.count,
    in_transit: inTransit.count,
    pending_shipment: inTransit.count,  // backward compat for dashboard
    arriving_this_week: arrivingSoon.count,
    alert_count: 0,
    status_breakdown: statusBreakdown,
    monthly_orders: monthlyOrders,
  });
});

// GET /api/orders/alerts — dashboard alerts stub
router.get('/alerts', authenticate, (req, res) => {
  res.json({ overdue: [], missing_docs: [], arriving_soon: [] });
});

// GET /api/orders/:id — single order
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, s.name as supplier_name, s.contact_name as supplier_contact, s.country as supplier_country
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  // Parse containers JSON
  try { order.containers = JSON.parse(order.containers || '[]'); } catch { order.containers = []; }
  res.json(order);
});

// POST /api/orders — create
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const {
    containers, destination, destination_custom, bank, amount, currency,
    category, shipping_tracking_number, expected_arrival, shipping_line,
    shipping_line_custom, original_docs_received, status, product_name, supplier_id, notes
  } = req.body;

  if (!destination) return res.status(400).json({ error: 'Destination is required' });
  if (!category) return res.status(400).json({ error: 'Category is required' });
  if (!containers || !Array.isArray(containers) || containers.length === 0) {
    return res.status(400).json({ error: 'At least one container must be selected' });
  }

  const order_number = getNextOrderNumber(db);
  const date = new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO orders
      (order_number, containers, destination, destination_custom, bank, amount, currency,
       date, category, shipping_tracking_number, expected_arrival, shipping_line, shipping_line_custom,
       tracking_source, original_docs_received, status, product_name, supplier_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    order_number,
    JSON.stringify(containers),
    destination,
    destination_custom || null,
    bank || null,
    amount != null && amount !== '' ? parseFloat(amount) : null,
    currency || null,
    date,
    category,
    shipping_tracking_number || null,
    expected_arrival || null,
    shipping_line || null,
    shipping_line_custom || null,
    shipping_line && shipping_line !== 'other' ? 'api' : 'manual',
    original_docs_received ? 1 : 0,
    status || 'pending',
    product_name || null,
    supplier_id || null,
    notes || null
  );

  db.prepare('INSERT INTO activity_log (id,action,entity_type,entity_id,details,user_id) VALUES (?,?,?,?,?,?)')
    .run(uuid(), 'created', 'order', String(result.lastInsertRowid), `Order ${order_number} created`, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, order_number });
});

// PUT /api/orders/:id — update
router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const {
    containers, destination, destination_custom, bank, amount, currency,
    category, shipping_tracking_number, expected_arrival, shipping_line,
    shipping_line_custom, original_docs_received, status, product_name, supplier_id, notes
  } = req.body;

  db.prepare(`
    UPDATE orders SET
      containers = COALESCE(?, containers),
      destination = COALESCE(?, destination),
      destination_custom = ?,
      bank = ?,
      amount = ?,
      currency = ?,
      category = COALESCE(?, category),
      shipping_tracking_number = ?,
      expected_arrival = ?,
      shipping_line = ?,
      shipping_line_custom = ?,
      original_docs_received = COALESCE(?, original_docs_received),
      status = COALESCE(?, status),
      product_name = COALESCE(?, product_name),
      supplier_id = COALESCE(?, supplier_id),
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    containers ? JSON.stringify(containers) : null,
    destination || null,
    destination_custom !== undefined ? (destination_custom || null) : order.destination_custom,
    bank !== undefined ? (bank || null) : order.bank,
    amount !== undefined ? (amount != null && amount !== '' ? parseFloat(amount) : null) : order.amount,
    currency !== undefined ? (currency || null) : order.currency,
    category || null,
    shipping_tracking_number !== undefined ? (shipping_tracking_number || null) : order.shipping_tracking_number,
    expected_arrival !== undefined ? (expected_arrival || null) : order.expected_arrival,
    shipping_line !== undefined ? (shipping_line || null) : order.shipping_line,
    shipping_line_custom !== undefined ? (shipping_line_custom || null) : order.shipping_line_custom,
    original_docs_received !== undefined ? (original_docs_received ? 1 : 0) : null,
    status || null,
    product_name || null,
    supplier_id || null,
    notes !== undefined ? (notes || null) : order.notes,
    req.params.id
  );

  res.json({ success: true });
});

// DELETE /api/orders/:id — admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM payments WHERE order_id = ?').run(req.params.id);
  db.prepare('UPDATE documents SET order_id = NULL WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
