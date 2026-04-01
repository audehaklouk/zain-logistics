import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function getReportData(type, db) {
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  switch (type) {
    case 'pending-shipment':
      return {
        title: 'Orders Pending Shipment',
        data: db.prepare(`
          SELECT o.order_number, o.product_name, s.company_name as supplier,
            o.status, o.order_date, o.expected_delivery_date as expected_delivery,
            o.currency || ' ' || printf('%.2f', o.total_amount) as amount,
            o.booking_number, o.shipping_line
          FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.status IN ('Confirmed', 'Shipped') ORDER BY o.order_date
        `).all(),
      };
    case 'by-supplier':
      return {
        title: 'Orders by Supplier',
        data: db.prepare(`
          SELECT s.company_name as supplier, s.country,
            COUNT(o.id) as total_orders,
            SUM(CASE WHEN o.status NOT IN ('Delivered','Draft') THEN 1 ELSE 0 END) as active_orders,
            'USD ' || printf('%.2f', COALESCE(SUM(o.total_amount), 0)) as total_spend,
            GROUP_CONCAT(DISTINCT o.status) as statuses
          FROM suppliers s LEFT JOIN orders o ON o.supplier_id = s.id
          GROUP BY s.id ORDER BY SUM(o.total_amount) DESC
        `).all(),
      };
    case 'monthly-summary':
      return {
        title: 'Monthly Order Summary',
        data: db.prepare(`
          SELECT strftime('%Y-%m', order_date) as month,
            COUNT(*) as orders_placed,
            SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status IN ('In Transit','Shipped') THEN 1 ELSE 0 END) as in_transit,
            'USD ' || printf('%.2f', SUM(total_amount)) as total_value
          FROM orders GROUP BY month ORDER BY month DESC LIMIT 12
        `).all(),
      };
    case 'due-this-week':
      return {
        title: 'Shipments Due This Week',
        data: db.prepare(`
          SELECT o.order_number, o.product_name, s.company_name as supplier,
            o.status, o.expected_delivery_date as eta,
            o.booking_number, o.shipping_line, o.vessel_name as vessel,
            o.currency || ' ' || printf('%.2f', o.total_amount) as amount
          FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.expected_delivery_date BETWEEN ? AND ? AND o.status != 'Delivered'
          ORDER BY o.expected_delivery_date
        `).all(today, weekFromNow),
      };
    case 'overdue':
      return {
        title: 'Overdue Shipments',
        data: db.prepare(`
          SELECT o.order_number, o.product_name, s.company_name as supplier,
            o.status, o.expected_delivery_date as was_due,
            CAST(julianday('now') - julianday(o.expected_delivery_date) AS INTEGER) as days_overdue,
            o.booking_number, o.shipping_line,
            o.currency || ' ' || printf('%.2f', o.total_amount) as amount
          FROM orders o LEFT JOIN suppliers s ON o.supplier_id = s.id
          WHERE o.expected_delivery_date < ? AND o.status NOT IN ('Delivered', 'Draft')
          ORDER BY o.expected_delivery_date
        `).all(today),
      };
    default:
      return null;
  }
}

router.get('/:type', authenticate, (req, res) => {
  const db = getDb();
  const report = getReportData(req.params.type, db);
  if (!report) return res.status(404).json({ error: 'Unknown report type' });
  res.json(report);
});

router.get('/:type/csv', authenticate, (req, res) => {
  const db = getDb();
  const report = getReportData(req.params.type, db);
  if (!report) return res.status(404).json({ error: 'Unknown report type' });
  if (!report.data.length) return res.status(200).send('No data');

  const headers = Object.keys(report.data[0]);
  const csv = [headers.join(','), ...report.data.map(row => headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');

  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=ZainLogistics_${req.params.type}_${date}.csv`);
  res.send(csv);
});

router.get('/:type/pdf', authenticate, (req, res) => {
  const db = getDb();
  const report = getReportData(req.params.type, db);
  if (!report) return res.status(404).json({ error: 'Unknown report type' });

  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
  const date = new Date().toISOString().split('T')[0];

  const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ZainLogistics_${req.params.type}_${date}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(22).fillColor('#1B2A4A').text('ZAIN LOGISTICS', 50, 40);
  doc.fontSize(10).fillColor('#6E6E80').text('Order Management & Shipment Tracking', 50, 65);
  doc.moveTo(50, 85).lineTo(770, 85).strokeColor('#E5E7EB').stroke();

  // Title
  doc.fontSize(16).fillColor('#1A1A2E').text(report.title, 50, 100);
  doc.fontSize(9).fillColor('#6E6E80').text(`Generated: ${new Date().toLocaleString()} | By: ${user?.display_name || 'System'}`, 50, 122);

  if (!report.data.length) {
    doc.fontSize(12).fillColor('#6E6E80').text('No data available for this report.', 50, 160);
  } else {
    const headers = Object.keys(report.data[0]);
    const colWidth = Math.min(140, 720 / headers.length);
    let y = 150;

    // Table header
    doc.rect(50, y, 720, 20).fill('#1B2A4A');
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor('#FFFFFF').text(
        h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        55 + i * colWidth, y + 5, { width: colWidth - 10 }
      );
    });
    y += 25;

    // Table rows
    report.data.forEach((row, idx) => {
      if (y > 520) {
        doc.addPage({ layout: 'landscape' });
        y = 50;
      }
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
      doc.rect(50, y - 3, 720, 18).fill(bg);
      headers.forEach((h, i) => {
        const val = (row[h] ?? '').toString().substring(0, 30);
        doc.fontSize(7).fillColor('#1A1A2E').text(val, 55 + i * colWidth, y, { width: colWidth - 10 });
      });
      y += 18;
    });

    // Summary
    y += 20;
    doc.fontSize(10).fillColor('#1A1A2E').text(`Total records: ${report.data.length}`, 50, y);
  }

  // Footer on each page
  const pages = doc.bufferedPageRange();
  doc.fontSize(8).fillColor('#9CA3AF').text(
    `Generated by Zain Logistics | ${date}`,
    50, 560, { align: 'center', width: 720 }
  );

  doc.end();
});

export default router;
