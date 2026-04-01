import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const suppliers = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM orders o WHERE o.supplier_id = s.id) as order_count,
    (SELECT SUM(total_amount) FROM orders o WHERE o.supplier_id = s.id) as total_spend
    FROM suppliers s ORDER BY s.company_name
  `).all();
  res.json(suppliers);
});

router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  const orders = db.prepare('SELECT * FROM orders WHERE supplier_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...supplier, orders });
});

router.post('/', authenticate, (req, res) => {
  const { company_name, contact_person, email, phone, country, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Company name required' });
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO suppliers (id, company_name, contact_person, email, phone, country, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, company_name, contact_person, email, phone, country, notes);
  db.prepare('INSERT INTO activity_log (id, action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'created', 'supplier', id, `Supplier ${company_name} added`, req.user.id);
  res.status(201).json({ id, company_name });
});

router.put('/:id', authenticate, (req, res) => {
  const { company_name, contact_person, email, phone, country, notes } = req.body;
  const db = getDb();
  db.prepare('UPDATE suppliers SET company_name=COALESCE(?,company_name), contact_person=COALESCE(?,contact_person), email=COALESCE(?,email), phone=COALESCE(?,phone), country=COALESCE(?,country), notes=COALESCE(?,notes), updated_at=datetime(\'now\') WHERE id=?').run(company_name, contact_person, email, phone, country, notes, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE supplier_id = ?').get(req.params.id);
  if (orders.count > 0) return res.status(400).json({ error: 'Cannot delete supplier with existing orders' });
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
