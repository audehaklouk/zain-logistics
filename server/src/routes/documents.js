import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { uploadFile, getDownloadUrl, deleteFile, buildKey } from '../services/s3.js';

// Use memory storage — buffer is handed off to S3 or written to disk by the service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// GET /api/documents — list (optionally filtered by supplier or invoice search)
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { supplier_id, search } = req.query;
  let sql = `
    SELECT d.*, s.name as supplier_name, o.order_number
    FROM documents d
    LEFT JOIN suppliers s ON d.supplier_id = s.id
    LEFT JOIN orders o ON d.order_id = o.id
    WHERE 1=1
  `;
  const params = [];
  if (supplier_id) { sql += ' AND d.supplier_id = ?'; params.push(supplier_id); }
  if (search) { sql += ' AND d.invoice_number LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/documents/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid file type (PDF, JPG, PNG only)' });
  const { supplier_id, invoice_number, order_id } = req.body;
  if (!supplier_id)    return res.status(400).json({ error: 'supplier_id is required' });
  if (!invoice_number) return res.status(400).json({ error: 'invoice_number is required' });

  try {
    const key = buildKey('documents', supplier_id, req.file.originalname);
    const storedKey = await uploadFile(req.file.buffer, key, req.file.mimetype);

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO documents (supplier_id, order_id, invoice_number, file_path, file_name, file_size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      supplier_id,
      order_id || null,
      invoice_number,
      storedKey,
      req.file.originalname,
      req.file.size,
      req.file.mimetype
    );

    res.status(201).json({ id: result.lastInsertRowid, file_name: req.file.originalname });
  } catch (err) {
    console.error('[documents] upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/documents/:id/download
router.get('/:id/download', authenticate, async (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  try {
    const result = await getDownloadUrl(doc.file_path, doc.file_name);
    if (result.type === 's3') {
      return res.redirect(result.url);
    }
    // Local disk
    return res.download(result.path, result.name, (err) => {
      if (err) res.status(404).json({ error: 'File not found on disk' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  await deleteFile(doc.file_path);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/documents/search?q=
router.get('/search', authenticate, (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) return res.json([]);
  const docs = db.prepare(`
    SELECT d.*, s.name as supplier_name, o.order_number
    FROM documents d
    LEFT JOIN suppliers s ON d.supplier_id = s.id
    LEFT JOIN orders o ON d.order_id = o.id
    WHERE d.invoice_number LIKE ?
    ORDER BY d.created_at DESC
  `).all(`%${q}%`);
  res.json(docs);
});

export default router;
