import { Router } from 'express';
import multer from 'multer';
import { getDb } from '../db/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { uploadFile, getDownloadUrl, deleteFile, buildKey } from '../services/s3.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// ── DN number generation: DDMMYY-NN ──────────────────────────────────
function generateDnNumber() {
  const db = getDb();
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `${dd}${mm}${yy}`;

  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM claims WHERE dn_number LIKE ?"
  ).get(`${prefix}-%`);
  const seq = String((row.cnt || 0) + 1).padStart(2, '0');
  return `${prefix}-${seq}`;
}

// ── GET /api/claims ───────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, claim_type, supplier_id, search } = req.query;
  const conds = [];
  const params = [];

  if (status)      { conds.push('c.status = ?');      params.push(status); }
  if (claim_type)  { conds.push('c.claim_type = ?');  params.push(claim_type); }
  if (supplier_id) { conds.push('c.supplier_id = ?'); params.push(supplier_id); }
  if (search) {
    const q = `%${search}%`;
    conds.push('(c.dn_number LIKE ? OR c.reference LIKE ? OR s.name LIKE ?)');
    params.push(q, q, q);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const claims = db.prepare(`
    SELECT c.*, s.name as supplier_name,
           (SELECT COUNT(*) FROM claim_documents cd WHERE cd.claim_id = c.id) as document_count
    FROM claims c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    ${where}
    ORDER BY c.id DESC
  `).all(...params);
  res.json(claims);
});

// ── GET /api/claims/:id ───────────────────────────────────────────────
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const claim = db.prepare(`
    SELECT c.*, s.name as supplier_name
    FROM claims c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const documents = db.prepare(
    'SELECT * FROM claim_documents WHERE claim_id = ? ORDER BY id DESC'
  ).all(req.params.id);

  res.json({ ...claim, documents });
});

// ── POST /api/claims ──────────────────────────────────────────────────
router.post('/', authenticate, (req, res) => {
  const { date, brand, supplier_id, claim_type, claim_type_other,
          reference, status, amount, currency, applied } = req.body;

  if (!supplier_id) return res.status(400).json({ error: 'supplier_id is required' });
  if (!claim_type)  return res.status(400).json({ error: 'claim_type is required' });
  if (!date)        return res.status(400).json({ error: 'date is required' });

  const db = getDb();
  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const dn_number = generateDnNumber();

  const result = db.prepare(`
    INSERT INTO claims
      (date, dn_number, brand, supplier_id, claim_type, claim_type_other,
       reference, status, amount, currency, applied)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date,
    dn_number,
    brand || null,
    parseInt(supplier_id),
    claim_type,
    claim_type_other || null,
    reference || null,
    status || 'draft',
    amount != null && amount !== '' ? parseFloat(amount) : null,
    currency || null,
    applied ? 1 : 0
  );

  res.status(201).json({ id: result.lastInsertRowid, dn_number });
});

// ── PUT /api/claims/:id ───────────────────────────────────────────────
router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const { date, brand, supplier_id, claim_type, claim_type_other,
          reference, status, amount, currency, applied } = req.body;

  db.prepare(`
    UPDATE claims SET
      date             = COALESCE(?, date),
      brand            = ?,
      supplier_id      = COALESCE(?, supplier_id),
      claim_type       = COALESCE(?, claim_type),
      claim_type_other = ?,
      reference        = ?,
      status           = COALESCE(?, status),
      amount           = ?,
      currency         = ?,
      applied          = COALESCE(?, applied),
      updated_at       = datetime('now')
    WHERE id = ?
  `).run(
    date || null,
    brand !== undefined ? (brand || null) : claim.brand,
    supplier_id ? parseInt(supplier_id) : null,
    claim_type || null,
    claim_type_other !== undefined ? (claim_type_other || null) : claim.claim_type_other,
    reference !== undefined ? (reference || null) : claim.reference,
    status || null,
    amount !== undefined ? (amount != null && amount !== '' ? parseFloat(amount) : null) : claim.amount,
    currency !== undefined ? (currency || null) : claim.currency,
    applied !== undefined ? (applied ? 1 : 0) : null,
    req.params.id
  );

  res.json({ success: true });
});

// ── DELETE /api/claims/:id — admin only, draft only ───────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const db = getDb();
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (claim.status !== 'draft') return res.status(400).json({ error: 'Only draft claims can be deleted' });

  // Delete attached files from S3/disk
  const docs = db.prepare('SELECT * FROM claim_documents WHERE claim_id = ?').all(req.params.id);
  await Promise.allSettled(docs.map(d => deleteFile(d.file_path)));

  db.prepare('DELETE FROM claim_documents WHERE claim_id = ?').run(req.params.id);
  db.prepare('DELETE FROM claims WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── POST /api/claims/:id/documents — upload supporting file ───────────
router.post('/:id/documents', authenticate, upload.single('file'), async (req, res) => {
  const db = getDb();
  const claim = db.prepare('SELECT id FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const key = buildKey('claims', req.params.id, req.file.originalname);
    const storedKey = await uploadFile(req.file.buffer, key, req.file.mimetype);

    const result = db.prepare(`
      INSERT INTO claim_documents (claim_id, file_path, file_name, file_size, mime_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, storedKey, req.file.originalname, req.file.size, req.file.mimetype);

    res.status(201).json({ id: result.lastInsertRowid, file_name: req.file.originalname });
  } catch (err) {
    console.error('[claims] upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── DELETE /api/claims/:id/documents/:docId ───────────────────────────
router.delete('/:id/documents/:docId', authenticate, async (req, res) => {
  const db = getDb();
  const doc = db.prepare(
    'SELECT * FROM claim_documents WHERE id = ? AND claim_id = ?'
  ).get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  await deleteFile(doc.file_path);
  db.prepare('DELETE FROM claim_documents WHERE id = ?').run(req.params.docId);
  res.json({ success: true });
});

// ── GET /api/claims/:id/documents/:docId/download ─────────────────────
router.get('/:id/documents/:docId/download', authenticate, async (req, res) => {
  const db = getDb();
  const doc = db.prepare(
    'SELECT * FROM claim_documents WHERE id = ? AND claim_id = ?'
  ).get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  try {
    const result = await getDownloadUrl(doc.file_path, doc.file_name);
    if (result.type === 's3') {
      return res.redirect(result.url);
    }
    return res.download(result.path, result.name, (err) => {
      if (err) res.status(404).json({ error: 'File not found' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

export default router;
