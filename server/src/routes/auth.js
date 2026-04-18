import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getDb } from '../db/database.js';
import { generateToken, generatePendingToken, verifyPendingToken, authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────
function logAttempt(db, { userId, email, ip, ua, success, reason }) {
  db.prepare(`
    INSERT INTO login_history (user_id, email, ip_address, user_agent, success, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId || null, email, ip || null, ua || null, success ? 1 : 0, reason || null);
}

function createSession(req, db, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      // Record in our sessions table for the admin panel
      db.prepare(`
        INSERT OR REPLACE INTO sessions (id, user_id, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, datetime('now', '+3 hours'))
      `).run(req.session.id, user.id, req.ip || null, req.headers['user-agent'] || null);
      db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
      resolve();
    });
  });
}

function safeUser(u) {
  return { id: u.id, email: u.email, display_name: u.display_name, role: u.role };
}

// ── POST /api/auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    logAttempt(db, { userId: user?.id, email, ip: req.ip, ua: req.headers['user-agent'], success: false, reason: 'bad_password' });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Step 1 — force password change
  if (user.must_change_password) {
    req.session.pending_user_id = user.id;
    return res.json({
      status: 'password_change_required',
      pending_token: generatePendingToken(user.id, 'password_change'),
    });
  }

  // Step 2 — 2FA required
  if (user.totp_enabled) {
    req.session.pending_user_id = user.id;
    logAttempt(db, { userId: user.id, email, ip: req.ip, ua: req.headers['user-agent'], success: true });
    return res.json({
      status: 'totp_required',
      pending_token: generatePendingToken(user.id, 'totp'),
    });
  }

  // Step 3 — first login, no 2FA yet → suggest setup but don't block
  if (!user.totp_enabled) {
    try {
      await createSession(req, db, user);
      logAttempt(db, { userId: user.id, email, ip: req.ip, ua: req.headers['user-agent'], success: true });
      const needsSetup = !user.totp_secret; // never set up before
      return res.json({
        status: needsSetup ? 'totp_setup_suggested' : 'ok',
        user: safeUser(user),
        token: generateToken(user),
      });
    } catch { return res.status(500).json({ error: 'Session error' }); }
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
  if (req.session?.id) {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.session.id);
  }
  req.session.destroy(() => res.json({ success: true }));
});

// ── POST /api/auth/change-password ────────────────────────────────────
router.post('/change-password', async (req, res) => {
  const { new_password, pending_token } = req.body;
  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // Accept session (cookie) OR stage-locked pending token (stateless-safe)
  const userId =
    req.session?.pending_user_id ||
    req.session?.userId ||
    verifyPendingToken(pending_token, 'password_change');
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const db = getDb();
  const hashed = bcrypt.hashSync(new_password, 12);
  db.prepare("UPDATE users SET password = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?")
    .run(hashed, userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  req.session.pending_user_id = null;

  // If they have 2FA, now require it
  if (user.totp_enabled) {
    req.session.pending_user_id = userId;
    return res.json({
      status: 'totp_required',
      pending_token: generatePendingToken(userId, 'totp'),
    });
  }

  try {
    await createSession(req, db, user);
    return res.json({
      status: !user.totp_secret ? 'totp_setup_suggested' : 'ok',
      user: safeUser(user),
      token: generateToken(user),
    });
  } catch { return res.status(500).json({ error: 'Session error' }); }
});

// ── POST /api/auth/totp/verify — verify code during login ─────────────
router.post('/totp/verify', async (req, res) => {
  const { code, pending_token } = req.body;
  const userId =
    req.session?.pending_user_id ||
    verifyPendingToken(pending_token, 'totp');
  if (!userId) return res.status(401).json({ error: 'No pending authentication' });
  if (!code)   return res.status(400).json({ error: 'Code is required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });

  // Try TOTP
  const valid = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token: code.replace(/\s/g, ''),
    window: 1,
  });

  if (!valid) {
    // Try backup codes
    const backupCodes = JSON.parse(user.backup_codes || '[]');
    const idx = backupCodes.findIndex(c => bcrypt.compareSync(code.trim(), c));
    if (idx === -1) {
      logAttempt(db, { userId: user.id, email: user.email, ip: req.ip, ua: req.headers['user-agent'], success: false, reason: 'bad_totp' });
      return res.status(401).json({ error: 'Invalid code. Check your authenticator app.' });
    }
    // Consume backup code
    backupCodes.splice(idx, 1);
    db.prepare("UPDATE users SET backup_codes = ? WHERE id = ?").run(JSON.stringify(backupCodes), user.id);
  }

  req.session.pending_user_id = null;
  try {
    await createSession(req, db, user);
    logAttempt(db, { userId: user.id, email: user.email, ip: req.ip, ua: req.headers['user-agent'], success: true });
    return res.json({ status: 'ok', user: safeUser(user), token: generateToken(user) });
  } catch { return res.status(500).json({ error: 'Session error' }); }
});

// ── POST /api/auth/totp/setup — generate secret + QR ─────────────────
router.post('/totp/setup', authenticate, async (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  const secret = speakeasy.generateSecret({
    name: `Zain Logistics (${user.email})`,
    issuer: 'Zain Logistics',
  });

  // Store the secret (not yet enabled — enabled on confirm)
  db.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").run(secret.base32, user.id);

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qr: qrDataUrl });
});

// ── POST /api/auth/totp/confirm — verify setup code + enable 2FA ──────
router.post('/totp/confirm', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_secret) return res.status(400).json({ error: 'Run /totp/setup first' });

  const valid = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token: code.replace(/\s/g, ''),
    window: 1,
  });

  if (!valid) return res.status(401).json({ error: 'Invalid code — try again' });

  // Generate 10 backup codes
  const rawCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  const hashedCodes = rawCodes.map(c => bcrypt.hashSync(c, 10));

  db.prepare("UPDATE users SET totp_enabled = 1, backup_codes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(hashedCodes), user.id);

  res.json({ success: true, backup_codes: rawCodes });
});

// ── POST /api/auth/totp/disable — turn off 2FA (admin or self) ────────
router.post('/totp/disable', authenticate, (req, res) => {
  const targetId = req.body.user_id || req.user.id;
  // Only admin can disable another user's 2FA
  if (targetId !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin required' });

  const db = getDb();
  db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(targetId);
  res.json({ success: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, email, display_name, role, totp_enabled, last_login, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ── GET /api/auth/heartbeat — keep session alive ──────────────────────
router.get('/heartbeat', authenticate, (req, res) => {
  res.json({ ok: true });
});

// ── Legacy JWT login (kept for backwards-compat, returns both token + sets session) ──
router.post('/login/token', async (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  res.json({ token, user: safeUser(user) });
});

// ── User management (kept here for admin use) ─────────────────────────
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, email, display_name, role, totp_enabled, is_active, last_login, created_at FROM users ORDER BY created_at'
  ).all();
  res.json(users);
});

router.post('/users', authenticate, requireAdmin, (req, res) => {
  const { email, password, display_name, role } = req.body;
  if (!email || !password || !display_name || !role)
    return res.status(400).json({ error: 'All fields required' });

  const db = getDb();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
    return res.status(409).json({ error: 'Email already exists' });

  const id = uuid();
  const hashed = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (id, email, password, display_name, role, must_change_password)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, email, hashed, display_name, role);

  res.status(201).json({ id, email, display_name, role, must_change_password: 1 });
});

router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  const { display_name, role, is_active } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      role = COALESCE(?, role),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(display_name || null, role || null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
  res.json({ success: true });
});

router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET must_change_password = 1, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post('/users/:id/reset-2fa', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
