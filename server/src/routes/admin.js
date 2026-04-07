import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── GET /api/admin/sessions — who's online ────────────────────────────
router.get('/sessions', (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT s.id, s.user_id, s.ip_address, s.user_agent,
           s.created_at, s.last_active, s.expires_at,
           u.email, u.display_name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > datetime('now')
    ORDER BY s.last_active DESC
  `).all();
  res.json(sessions);
});

// ── DELETE /api/admin/sessions/:id — force logout ─────────────────────
router.delete('/sessions/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── GET /api/admin/login-history ──────────────────────────────────────
router.get('/login-history', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const history = db.prepare(`
    SELECT lh.id, lh.email, lh.ip_address, lh.user_agent,
           lh.success, lh.failure_reason, lh.timestamp,
           u.display_name
    FROM login_history lh
    LEFT JOIN users u ON lh.user_id = u.id
    ORDER BY lh.timestamp DESC
    LIMIT ?
  `).all(limit);
  res.json(history);
});

export default router;
