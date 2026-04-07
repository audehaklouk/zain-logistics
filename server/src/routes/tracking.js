import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDb } from '../db/database.js';
import { trackContainer, detectCarrier, getCarrierStatus } from '../services/shipping/index.js';

const router = Router();

// ── GET /api/shipping/carriers — which APIs are configured ────────────
router.get('/carriers', authenticate, (req, res) => {
  res.json(getCarrierStatus());
});

// ── GET /api/shipping/track/:containerNumber — track a single container
router.get('/track/:containerNumber', authenticate, async (req, res) => {
  const { containerNumber } = req.params;
  const { orderId } = req.query;

  let orderData = null;
  if (orderId) {
    const db = getDb();
    orderData = db.prepare('SELECT shipping_data, shipping_line FROM orders WHERE id = ?').get(orderId) || null;
  }

  try {
    const { data, source } = await trackContainer(containerNumber, orderData);
    res.json({ ...data, source });
  } catch (err) {
    res.status(502).json({ error: 'Tracking lookup failed', detail: err.message });
  }
});

// ── POST /api/shipping/refresh/:orderId — refresh all containers for an order
router.post('/refresh/:orderId', authenticate, async (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT id, containers, shipping_data, shipping_line
    FROM orders WHERE id = ?
  `).get(req.params.orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  let containers = [];
  try {
    containers = order.containers ? JSON.parse(order.containers) : [];
  } catch { /* ignore */ }

  const containersWithNumbers = containers.filter(c => c.number);
  if (!containersWithNumbers.length) {
    return res.json({ results: [], message: 'No container numbers to track' });
  }

  const results = await Promise.allSettled(
    containersWithNumbers.map(async (c) => {
      const { data, source } = await trackContainer(c.number, order);
      return { containerNumber: c.number, type: c.type, source, data };
    })
  );

  // Build shipping_data map: { [containerNumber]: trackingData }
  const shippingData = {};
  const summary = results.map(r => {
    if (r.status === 'fulfilled') {
      shippingData[r.value.containerNumber] = r.value.data;
      return { containerNumber: r.value.containerNumber, source: r.value.source, status: 'ok' };
    }
    return { containerNumber: r.reason?.containerNumber || 'unknown', status: 'error', error: r.reason?.message };
  });

  // Persist refreshed tracking data to order
  db.prepare('UPDATE orders SET shipping_data = ? WHERE id = ?')
    .run(JSON.stringify(shippingData), order.id);

  res.json({ results: summary, refreshedAt: new Date().toISOString() });
});

// ── GET /api/shipping/order/:orderId — all container tracking for an order
router.get('/order/:orderId', authenticate, async (req, res) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT id, containers, shipping_data, shipping_line
    FROM orders WHERE id = ?
  `).get(req.params.orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  let containers = [];
  try {
    containers = order.containers ? JSON.parse(order.containers) : [];
  } catch { /* ignore */ }

  const containersWithNumbers = containers.filter(c => c.number);
  if (!containersWithNumbers.length) {
    return res.json({ containers: [], carriers: getCarrierStatus() });
  }

  const tracking = await Promise.allSettled(
    containersWithNumbers.map(async (c) => {
      const { data, source } = await trackContainer(c.number, order);
      return { containerNumber: c.number, type: c.type, source, ...data };
    })
  );

  const containerData = tracking.map(r =>
    r.status === 'fulfilled' ? r.value : { containerNumber: 'unknown', status: 'error', events: [] }
  );

  res.json({ containers: containerData, carriers: getCarrierStatus() });
});

// ── Hardcoded demo fleet — shown when no live orders have container numbers ─
const DEMO_FLEET = [
  {
    bookingNumber: 'MSKU9876543',
    orderNumber:   'ORD-2026-001',
    productName:   'Raw Almonds (Premium Grade)',
    carrier: 'Maersk', vessel: 'Maersk Seletar', voyage: '402E',
    status: 'In Transit',
    origin:      { port: 'Mersin',    country: 'TR', departureDate: null },
    destination: { port: 'Aqaba',     country: 'JO', eta: null },
    currentPosition: { lat: 30.1, lng: 32.6, heading: 155, speed: 14.2 },
    containerCount: 2, _demo: true,
  },
  {
    bookingNumber: 'HLXU8899001',
    orderNumber:   'ORD-2026-003',
    productName:   'Medjool Dates (Jumbo)',
    carrier: 'Hapag-Lloyd', vessel: 'Berlin Express', voyage: '112S',
    status: 'In Transit',
    origin:      { port: 'Istanbul',  country: 'TR', departureDate: null },
    destination: { port: 'Aqaba',     country: 'JO', eta: null },
    currentPosition: { lat: 33.2, lng: 35.8, heading: 170, speed: 13.5 },
    containerCount: 3, _demo: true,
  },
  {
    bookingNumber: 'CMAU5566778',
    orderNumber:   'ORD-2026-007',
    productName:   'Dried Mango Slices',
    carrier: 'CMA CGM', vessel: 'CMA CGM Tanya', voyage: '0MR2ME1',
    status: 'In Transit',
    origin:      { port: 'Shanghai',  country: 'CN', departureDate: null },
    destination: { port: 'Aqaba',     country: 'JO', eta: null },
    currentPosition: { lat: 22.5, lng: 58.3, heading: 280, speed: 15.1 },
    containerCount: 1, _demo: true,
  },
  {
    bookingNumber: 'MSCU4455668',
    orderNumber:   'ORD-2026-009',
    productName:   'Basmati Rice (Extra Long)',
    carrier: 'MSC', vessel: 'MSC Oscar', voyage: '226W',
    status: 'In Transit',
    origin:      { port: 'Nhava Sheva', country: 'IN', departureDate: null },
    destination: { port: 'Aqaba',       country: 'JO', eta: null },
    currentPosition: { lat: 18.4, lng: 57.9, heading: 310, speed: 13.8 },
    containerCount: 3, _demo: true,
  },
  {
    bookingNumber: 'MSKU7788990',
    orderNumber:   'ORD-2026-006',
    productName:   'Ground Cumin (500g packs)',
    carrier: 'Maersk', vessel: 'Madrid Maersk', voyage: '318W',
    status: 'In Transit',
    origin:      { port: 'Rotterdam', country: 'NL', departureDate: null },
    destination: { port: 'Aqaba',     country: 'JO', eta: null },
    currentPosition: { lat: 31.8, lng: 32.3, heading: 160, speed: 14.0 },
    containerCount: 2, _demo: true,
  },
];

// ── GET /api/tracking — fleet overview (used by FleetMap on Dashboard) ─
router.get('/', authenticate, async (req, res) => {
  const db = getDb();

  // Pull orders that are actively in transit and have container numbers
  const orders = db.prepare(`
    SELECT id, order_number, containers, shipping_data, shipping_line,
           shipping_tracking_number, product_name
    FROM orders
    WHERE status IN ('shipped', 'in_transit', 'confirmed')
      AND containers IS NOT NULL AND containers != '[]'
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const fleet = [];

  for (const order of orders) {
    let containers = [];
    try { containers = JSON.parse(order.containers); } catch { continue; }

    const withNumbers = containers.filter(c => c.number);
    if (!withNumbers.length) continue;

    const primary = withNumbers[0];
    try {
      const { data } = await trackContainer(primary.number, order);
      if (!data.currentPosition) continue;

      fleet.push({
        bookingNumber:  primary.number,
        orderId:        order.id,
        orderNumber:    order.order_number,
        productName:    order.product_name,
        carrier:        data.carrier,
        vessel:         data.vessel,
        voyage:         data.voyage,
        status:         data.status,
        origin:         data.origin,
        destination:    data.destination,
        currentPosition: data.currentPosition,
        eta:            data.destination?.eta || null,
        delay:          null,
        containerCount: withNumbers.length,
        _demo:          data._demo || false,
      });
    } catch { /* skip */ }
  }

  // If no real orders qualified, return the hardcoded demo fleet
  res.json(fleet.length > 0 ? fleet : DEMO_FLEET);
});

// ── Legacy: keep old routes for backwards compatibility ──────────────
// GET /api/tracking/:bookingNumber  (used by any existing UI)
router.get('/:bookingNumber', authenticate, async (req, res) => {
  try {
    const { data, source } = await trackContainer(req.params.bookingNumber, null);
    res.json({ ...data, source, lastUpdated: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: 'Tracking lookup failed', detail: err.message });
  }
});

export default router;
