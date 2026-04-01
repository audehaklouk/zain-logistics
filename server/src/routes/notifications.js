import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifications);
});

router.put('/:id/read', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/read-all', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET read = 1').run();
  res.json({ success: true });
});

router.get('/settings', authenticate, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM notification_settings').all());
});

router.put('/settings', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { settings } = req.body;
  for (const s of settings) {
    db.prepare('UPDATE notification_settings SET enabled = ?, threshold_days = ? WHERE type = ?').run(s.enabled ? 1 : 0, s.threshold_days || 0, s.type);
  }
  res.json({ success: true });
});

// Generate alerts based on current state
router.post('/generate', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Overdue: Sent > 7 days
  const overdue = db.prepare(`
    SELECT o.* FROM orders o
    WHERE o.status = 'Sent' AND julianday('now') - julianday(o.order_date) > 7
  `).all();
  for (const o of overdue) {
    const exists = db.prepare("SELECT id FROM notifications WHERE order_id = ? AND type = 'overdue' AND created_at > datetime('now', '-1 day')").get(o.id);
    if (!exists) {
      db.prepare('INSERT INTO notifications (id, type, title, message, order_id) VALUES (?, ?, ?, ?, ?)').run(uuid(), 'overdue', 'Order Not Confirmed', `Order ${o.order_number} was sent ${Math.floor((Date.now() - new Date(o.order_date).getTime()) / 86400000)} days ago but hasn't been confirmed.`, o.id);
    }
  }

  // Missing docs
  const missingDocs = db.prepare(`
    SELECT o.* FROM orders o
    WHERE o.status IN ('Confirmed', 'Shipped', 'In Transit')
    AND (SELECT COUNT(*) FROM documents d WHERE d.order_id = o.id) = 0
  `).all();
  for (const o of missingDocs) {
    const exists = db.prepare("SELECT id FROM notifications WHERE order_id = ? AND type = 'missing_docs' AND created_at > datetime('now', '-1 day')").get(o.id);
    if (!exists) {
      db.prepare('INSERT INTO notifications (id, type, title, message, order_id) VALUES (?, ?, ?, ?, ?)').run(uuid(), 'missing_docs', 'Missing Documents', `Order ${o.order_number} (${o.status}) has no documents uploaded.`, o.id);
    }
  }

  res.json({ generated: overdue.length + missingDocs.length });
});

export default router;
