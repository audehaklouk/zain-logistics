import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { order_id, document_type_id } = req.query;
  let sql = `SELECT d.*, dt.name as document_type_name, o.order_number, u.display_name as uploaded_by_name
    FROM documents d
    LEFT JOIN document_types dt ON d.document_type_id = dt.id
    LEFT JOIN orders o ON d.order_id = o.id
    LEFT JOIN users u ON d.uploaded_by = u.id WHERE 1=1`;
  const params = [];
  if (order_id) { sql += ' AND d.order_id = ?'; params.push(order_id); }
  if (document_type_id) { sql += ' AND d.document_type_id = ?'; params.push(document_type_id); }
  sql += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { order_id, document_type_id } = req.body;
  if (!order_id || !document_type_id) return res.status(400).json({ error: 'order_id and document_type_id required' });

  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO documents (id, order_id, document_type_id, file_name, original_name, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, order_id, document_type_id, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, req.user.id);

  const order = db.prepare('SELECT order_number FROM orders WHERE id = ?').get(order_id);
  db.prepare('INSERT INTO activity_log (id, action, entity_type, entity_id, details, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'document_uploaded', 'document', order_id, `Document uploaded for ${order?.order_number || 'unknown'}`, req.user.id);

  res.status(201).json({ id, file_name: req.file.filename });
});

router.get('/download/:id', authenticate, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadsDir, doc.file_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
  res.download(filePath, doc.original_name);
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadsDir, doc.file_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Document types
router.get('/types', authenticate, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM document_types ORDER BY name').all());
});

router.post('/types', authenticate, requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO document_types (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ id, name });
});

router.delete('/types/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const docs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE document_type_id = ?').get(req.params.id);
  if (docs.count > 0) return res.status(400).json({ error: 'Cannot delete type with existing documents' });
  db.prepare('DELETE FROM document_types WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
