import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/payments — list all payments (with order info)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const payments = db.prepare(`
    SELECT p.*, o.order_number, o.product_name, o.supplier_id,
           s.name as supplier_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    ORDER BY p.id DESC
  `).all();
  res.json(payments);
});

// GET /api/payments/order/:id — payments for a specific order
router.get('/order/:id', authenticate, (req, res) => {
  const db = getDb();
  const payments = db.prepare(`
    SELECT p.*, o.order_number, o.product_name
    FROM payments p JOIN orders o ON p.order_id = o.id
    WHERE p.order_id = ? ORDER BY p.id
  `).all(req.params.id);
  res.json(payments);
});

// POST /api/payments — create payment
router.post('/', authenticate, (req, res) => {
  const { order_id, delivery_date, amount, currency, payment_date, payment_term, status } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id is required' });
  if (!delivery_date) return res.status(400).json({ error: 'delivery_date is required' });
  if (!payment_date) return res.status(400).json({ error: 'payment_date is required' });

  const db = getDb();
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const result = db.prepare(`
    INSERT INTO payments (order_id, delivery_date, amount, currency, payment_date, payment_term, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    order_id,
    delivery_date,
    amount != null && amount !== '' ? parseFloat(amount) : null,
    currency || null,
    payment_date,
    payment_term || null,
    status || 'not_transferred'
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/payments/:id — update payment
router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const { order_id, delivery_date, amount, currency, payment_date, payment_term, status } = req.body;

  db.prepare(`
    UPDATE payments SET
      order_id = COALESCE(?, order_id),
      delivery_date = COALESCE(?, delivery_date),
      amount = ?,
      currency = ?,
      payment_date = COALESCE(?, payment_date),
      payment_term = ?,
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    order_id || null,
    delivery_date || null,
    amount !== undefined ? (amount != null && amount !== '' ? parseFloat(amount) : null) : payment.amount,
    currency !== undefined ? (currency || null) : payment.currency,
    payment_date || null,
    payment_term !== undefined ? (payment_term || null) : payment.payment_term,
    status || null,
    req.params.id
  );

  res.json({ success: true });
});

// DELETE /api/payments/:id
router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const payment = db.prepare('SELECT id FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
