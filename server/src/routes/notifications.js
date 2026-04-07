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
  res.json([]);
});

router.put('/settings', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true });
});

// Generate alerts — updated for new schema
router.post('/generate', authenticate, (req, res) => {
  res.json({ generated: 0 });
});

export default router;
