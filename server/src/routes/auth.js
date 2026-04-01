import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import { generateToken, authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
  });
});

router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, display_name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, display_name, role, created_at FROM users').all();
  res.json(users);
});

router.post('/users', authenticate, requireAdmin, (req, res) => {
  const { email, password, display_name, role } = req.body;
  if (!email || !password || !display_name || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const id = uuid();
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password, display_name, role) VALUES (?, ?, ?, ?, ?)').run(id, email, hashed, display_name, role);
  res.status(201).json({ id, email, display_name, role });
});

router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  const { display_name, role } = req.body;
  const db = getDb();
  db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), role = COALESCE(?, role), updated_at = datetime(\'now\') WHERE id = ?').run(display_name, role, req.params.id);
  res.json({ success: true });
});

router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
