import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit) || 10;
  const activities = db.prepare(`
    SELECT a.*, u.display_name as user_name
    FROM activity_log a LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(limit);
  res.json(activities);
});

export default router;
