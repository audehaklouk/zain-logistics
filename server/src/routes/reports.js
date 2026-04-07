import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────

function parseContainers(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function containerSummary(containers) {
  const counts = {};
  for (const c of containers) counts[c.type] = (counts[c.type] || 0) + 1;
  const parts = Object.entries(counts).map(([t, n]) => `${t} × ${n}`);
  return parts.join(', ') || '—';
}

const DEST_MAP = { aqaba: 'Aqaba', ksa: 'KSA', um_qaser: 'Um Qaser', mersin: 'Mersin', lattakia: 'Lattakia', lebanon: 'Lebanon' };
const LINE_MAP = { maersk: 'Maersk', hapag_lloyd: 'Hapag-Lloyd', cma_cgm: 'CMA CGM', msc: 'MSC' };
const CCY_SYM  = { EUR: '€', USD: '$', GBP: '£' };

function fmtDest(d, custom) { return DEST_MAP[d] || (d === 'other' ? custom || 'Other' : d || '—'); }
function fmtLine(l, custom) { return LINE_MAP[l] || (l === 'other' ? custom || 'Other' : l || '—'); }
function fmtAmt(a, c) {
  if (a == null) return '—';
  const sym = CCY_SYM[c] || (c ? c + ' ' : '');
  return `${sym}${Number(a).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function generateAqbId() {
  const year = new Date().getFullYear();
  const db = getDb();
  const row = db.prepare(
    'UPDATE report_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number'
  ).get();
  return `AQB-${year}-${String(row.last_number).padStart(3, '0')}`;
}

function fetchOrders(query = {}) {
  const db = getDb();
  const conds = [];
  const params = [];

  if (query.status) { conds.push('o.status = ?'); params.push(query.status); }
  if (query.supplier_id) { conds.push('o.supplier_id = ?'); params.push(query.supplier_id); }
  if (query.search) {
    const q = `%${query.search}%`;
    conds.push('(o.order_number LIKE ? OR o.product_name LIKE ? OR s.name LIKE ?)');
    params.push(q, q, q);
  }
  if (query.date_from) { conds.push('o.date >= ?'); params.push(query.date_from); }
  if (query.date_to)   { conds.push('o.date <= ?'); params.push(query.date_to); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  return db.prepare(`
    SELECT o.id, o.order_number, o.containers, o.product_name,
           s.name AS supplier_name, o.status,
           o.shipping_line, o.shipping_line_custom,
           o.expected_arrival, o.bank, o.amount, o.currency,
           o.original_docs_received, o.destination, o.destination_custom, o.date
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    ${where}
    ORDER BY o.id DESC
  `).all(...params).map(o => {
    const containers = parseContainers(o.containers);
    return {
      ...o,
      container_size: containerSummary(containers),
      container_count: containers.length,
    };
  });
}

// ── GET /api/reports — data for the table ────────────────────────────

router.get('/', authenticate, (req, res) => {
  res.json(fetchOrders(req.query));
});

// ── GET /api/reports/pdf — Aqaba Reports PDF ─────────────────────────

router.get('/pdf', authenticate, (req, res) => {
  const orders = fetchOrders(req.query);
  const generatedAt = fmtDate(new Date().toISOString());

  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Aqaba-Report-${Date.now()}.pdf"`);
  doc.pipe(res);

  // ── Title ──
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f')
    .text('Aqaba Reports', { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text(`Generated: ${generatedAt}  |  Records: ${orders.length}`, { align: 'center' });
  doc.moveDown(0.8);

  if (orders.length === 0) {
    doc.fontSize(11).fillColor('#999').text('No orders found for the selected filters.', { align: 'center' });
    doc.end();
    return;
  }

  const COLS = [
    { key: 'aqb_id',        label: 'AQB ID',       width: 72 },
    { key: 'order_number',  label: 'Order #',       width: 68 },
    { key: 'container_size',label: 'Container',     width: 72 },
    { key: 'container_count',label: 'Qty',          width: 26 },
    { key: 'product_name',  label: 'Product',       width: 78 },
    { key: 'supplier_name', label: 'Supplier',      width: 72 },
    { key: 'status',        label: 'Status',        width: 60 },
    { key: 'shipping_line', label: 'Shipping Line', width: 68 },
    { key: 'expected_arrival',label: 'Exp. Delivery',width: 64 },
    { key: 'bank',          label: 'Bank',          width: 52 },
    { key: 'amount',        label: 'Amount',        width: 62 },
    { key: 'original_docs', label: 'Orig. Docs',    width: 50 },
    { key: 'destination',   label: 'Destination',   width: 58 },
  ];
  const tableW = COLS.reduce((s, c) => s + c.width, 0);
  const LEFT = 36;
  const ROW_H = 18;
  const HDR_H = 20;

  const drawHeader = (y) => {
    doc.fillColor('#1e3a5f').rect(LEFT, y, tableW, HDR_H).fill();
    let x = LEFT;
    doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold');
    for (const col of COLS) {
      doc.text(col.label, x + 3, y + 6.5, { width: col.width - 6, lineBreak: false });
      x += col.width;
    }
    return y + HDR_H;
  };

  let y = drawHeader(doc.y);

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const row = {
      aqb_id:          generateAqbId(),
      order_number:    o.order_number,
      container_size:  o.container_size,
      container_count: String(o.container_count),
      product_name:    o.product_name || '—',
      supplier_name:   o.supplier_name || '—',
      status:          o.status ? o.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—',
      shipping_line:   fmtLine(o.shipping_line, o.shipping_line_custom),
      expected_arrival: fmtDate(o.expected_arrival),
      bank:            o.bank || '—',
      amount:          fmtAmt(o.amount, o.currency),
      original_docs:   o.original_docs_received ? 'Yes' : 'No',
      destination:     fmtDest(o.destination, o.destination_custom),
    };

    // Alternate stripe
    if (i % 2 === 0) {
      doc.fillColor('#f8fafc').rect(LEFT, y, tableW, ROW_H).fill();
    }

    let x = LEFT;
    doc.fillColor('#111827').fontSize(6.5).font('Helvetica');
    for (const col of COLS) {
      const val = String(row[col.key] ?? '—');
      doc.text(val, x + 3, y + 5.5, { width: col.width - 6, lineBreak: false, ellipsis: true });
      x += col.width;
    }

    // Row border
    doc.strokeColor('#e5e7eb').lineWidth(0.4)
      .moveTo(LEFT, y + ROW_H).lineTo(LEFT + tableW, y + ROW_H).stroke();

    y += ROW_H;

    // Page break
    if (y > doc.page.height - 55) {
      doc.addPage();
      y = drawHeader(40);
    }
  }

  // Footer
  doc.fontSize(7).fillColor('#aaa')
    .text(`Zain Logistics Portal  •  ${generatedAt}`, LEFT, doc.page.height - 28, { width: tableW, align: 'center' });

  doc.end();
});

// ── GET /api/reports/csv — CSV download ──────────────────────────────

router.get('/csv', authenticate, (req, res) => {
  const orders = fetchOrders(req.query);

  const headers = [
    'Order #', 'Container Size', 'Qty', 'Product', 'Supplier',
    'Status', 'Shipping Line', 'Exp. Delivery', 'Bank',
    'Amount', 'Currency', 'Orig. Docs', 'Destination', 'Order Date',
  ];

  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = orders.map(o => [
    o.order_number,
    o.container_size,
    o.container_count,
    o.product_name || '',
    o.supplier_name || '',
    o.status ? o.status.replace(/_/g, ' ') : '',
    fmtLine(o.shipping_line, o.shipping_line_custom),
    o.expected_arrival || '',
    o.bank || '',
    o.amount != null ? o.amount : '',
    o.currency || '',
    o.original_docs_received ? 'Yes' : 'No',
    fmtDest(o.destination, o.destination_custom),
    o.date || '',
  ].map(escape).join(','));

  const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
  const date = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="Aqaba-Report-${date}.csv"`);
  res.send(csv);
});

export default router;
