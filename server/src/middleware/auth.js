import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

// Short-lived stage-locked token used during multi-step login (password
// change or TOTP verify). Does NOT grant API access — verifyPendingToken
// must be called with the matching stage.
export function generatePendingToken(userId, stage) {
  return jwt.sign({ pending_user_id: userId, stage }, JWT_SECRET, { expiresIn: '10m' });
}

export function verifyPendingToken(token, stage) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.stage !== stage) return null;
    return payload.pending_user_id || null;
  } catch { return null; }
}

// ── authenticate: session-first, JWT fallback ─────────────────────────
export function authenticate(req, res, next) {
  // 1. Check session
  if (req.session?.userId) {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, email, display_name, role FROM users WHERE id = ? AND is_active = 1'
    ).get(req.session.userId);
    if (user) {
      req.user = user;
      // Keep our sessions table up-to-date
      db.prepare("UPDATE sessions SET last_active = datetime('now') WHERE id = ?")
        .run(req.session.id);
      return next();
    }
    // Session exists but user gone/deactivated — clear it
    req.session.destroy(() => {});
  }

  // 2. JWT fallback (for any clients still using the old token)
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch { /* fall through */ }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
