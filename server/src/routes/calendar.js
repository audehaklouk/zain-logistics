import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────

function toISO(d) {
  return d.toISOString().split('T')[0];
}

// Return Saturday–Friday bounds for the week containing `date`
function weekBounds(date) {
  const d = new Date(date);
  const daysSinceSat = (d.getDay() + 1) % 7; // Sat=0 Sun=1 … Fri=6
  const sat = new Date(d);
  sat.setDate(d.getDate() - daysSinceSat);
  const fri = new Date(sat);
  fri.setDate(sat.getDate() + 6);
  return { start: toISO(sat), end: toISO(fri) };
}

// Aggregate all event sources for [start, end] inclusive (YYYY-MM-DD)
function aggregateEvents(start, end) {
  const db = getDb();
  const events = [];

  // 1. Payment delivery dates — red (most urgent)
  db.prepare(`
    SELECT p.id, p.delivery_date AS event_date, p.amount, p.currency, p.status,
           o.order_number, o.id AS order_id, o.product_name
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.delivery_date BETWEEN ? AND ?
  `).all(start, end).forEach(p => {
    events.push({
      type: 'payment',
      date: p.event_date,
      title: `Payment — ${p.order_number}`,
      detail: [p.product_name, p.amount != null ? `${p.currency || ''} ${Number(p.amount).toFixed(2)}`.trim() : null]
        .filter(Boolean).join(' · '),
      color: '#ef4444',
      source_id: p.id,
      order_id: p.order_id,
      meta: { status: p.status },
    });
  });

  // 2. Expected arrivals from orders — blue
  db.prepare(`
    SELECT o.id, o.order_number, o.expected_arrival AS event_date,
           o.product_name, s.name AS supplier_name, o.status
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.expected_arrival BETWEEN ? AND ?
      AND o.status NOT IN ('delivered', 'cancelled')
  `).all(start, end).forEach(o => {
    events.push({
      type: 'delivery',
      date: o.event_date,
      title: `Arrival — ${o.order_number}`,
      detail: [o.product_name, o.supplier_name].filter(Boolean).join(' · '),
      color: '#3b82f6',
      source_id: o.id,
      order_id: o.id,
    });
  });

  // 3. Claim dates — orange
  db.prepare(`
    SELECT c.id, c.date AS event_date, c.dn_number, c.claim_type,
           s.name AS supplier_name, c.amount, c.currency
    FROM claims c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE c.date BETWEEN ? AND ?
  `).all(start, end).forEach(c => {
    events.push({
      type: 'claim',
      date: c.event_date,
      title: `${c.dn_number}`,
      detail: c.supplier_name || '',
      color: '#f97316',
      source_id: c.id,
    });
  });

  // 4. Order creation dates — gray (informational)
  db.prepare(`
    SELECT o.id, o.date AS event_date, o.order_number, o.product_name, s.name AS supplier_name
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.date BETWEEN ? AND ?
  `).all(start, end).forEach(o => {
    events.push({
      type: 'order',
      date: o.event_date,
      title: `Order — ${o.order_number}`,
      detail: [o.product_name, o.supplier_name].filter(Boolean).join(' · '),
      color: '#9ca3af',
      source_id: o.id,
      order_id: o.id,
    });
  });

  // 5. Manual events — green
  db.prepare(`
    SELECT * FROM calendar_events WHERE event_date BETWEEN ? AND ?
  `).all(start, end).forEach(e => {
    events.push({
      id: e.id,
      type: 'manual',
      date: e.event_date,
      title: e.title,
      detail: e.description || '',
      color: e.color || '#22c55e',
      source_id: e.id,
      is_manual: true,
    });
  });

  // Sort by date, then priority
  const priority = { payment: 0, delivery: 1, claim: 2, order: 3, manual: 4 };
  return events.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (priority[a.type] ?? 5) - (priority[b.type] ?? 5);
  });
}

// ── GET /api/calendar?start=&end= ────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end are required' });
  res.json(aggregateEvents(start, end));
});

// ── GET /api/calendar/today ───────────────────────────────────────────
router.get('/today', authenticate, (req, res) => {
  const today = toISO(new Date());
  res.json(aggregateEvents(today, today));
});

// ── GET /api/calendar/week ────────────────────────────────────────────
router.get('/week', authenticate, (req, res) => {
  const { start, end } = weekBounds(new Date());
  res.json(aggregateEvents(start, end));
});

// ── POST /api/calendar/events — create manual event ──────────────────
router.post('/events', authenticate, (req, res) => {
  const { title, description, event_date, color } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!event_date) return res.status(400).json({ error: 'event_date is required' });

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO calendar_events (title, description, event_date, event_type, color, created_by)
    VALUES (?, ?, ?, 'manual', ?, ?)
  `).run(title, description || null, event_date, color || '#22c55e', req.user?.id || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// ── PUT /api/calendar/events/:id ──────────────────────────────────────
router.put('/events/:id', authenticate, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });

  const { title, description, event_date, color } = req.body;
  db.prepare(`
    UPDATE calendar_events SET
      title       = COALESCE(?, title),
      description = ?,
      event_date  = COALESCE(?, event_date),
      color       = COALESCE(?, color),
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(
    title || null,
    description !== undefined ? (description || null) : ev.description,
    event_date || null,
    color || null,
    req.params.id
  );
  res.json({ success: true });
});

// ── DELETE /api/calendar/events/:id ──────────────────────────────────
router.delete('/events/:id', authenticate, (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT id FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
