import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/suppliers — list with optional search
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search } = req.query;

  let sql = `
    SELECT s.*,
      (SELECT COUNT(*) FROM orders o WHERE o.supplier_id = s.id) as order_count,
      (SELECT COUNT(*) FROM documents d WHERE d.supplier_id = s.id) as document_count
    FROM suppliers s
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND s.name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY s.name ASC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/suppliers/:id — single supplier with orders
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const orders = db.prepare('SELECT * FROM orders WHERE supplier_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ ...supplier, orders });
});

// POST /api/suppliers — create
router.post('/', authenticate, (req, res) => {
  const { name, contact_name, contact_email, contact_phone, country, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM suppliers WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'A supplier with this name already exists' });

  const result = db.prepare(
    'INSERT INTO suppliers (name,contact_name,contact_email,contact_phone,country,notes) VALUES (?,?,?,?,?,?)'
  ).run(name, contact_name || null, contact_email || null, contact_phone || null, country || null, notes || null);

  res.status(201).json({ id: result.lastInsertRowid, name });
});

// PUT /api/suppliers/:id — update
router.put('/:id', authenticate, (req, res) => {
  const { name, contact_name, contact_email, contact_phone, country, notes } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE suppliers SET
      name = COALESCE(?, name),
      contact_name = COALESCE(?, contact_name),
      contact_email = COALESCE(?, contact_email),
      contact_phone = COALESCE(?, contact_phone),
      country = COALESCE(?, country),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name || null, contact_name || null, contact_email || null, contact_phone || null, country || null, notes || null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/suppliers/:id — admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE supplier_id = ?').get(req.params.id);
  if (orders.count > 0) return res.status(400).json({ error: 'Cannot delete supplier with existing orders' });
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
