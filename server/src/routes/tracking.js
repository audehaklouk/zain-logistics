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

// ── GET /api/tracking — fleet overview (used by FleetMap on Dashboard) ─
router.get('/', authenticate, async (req, res) => {
  const db = getDb();

  // Pull orders that are actively in transit (not yet delivered/cancelled)
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

    // Use the first container as the representative for the map marker
    const primary = withNumbers[0];
    try {
      const { data } = await trackContainer(primary.number, order);
      if (!data.currentPosition) continue; // skip if no position (unknown prefix)

      fleet.push({
        bookingNumber: primary.number,
        orderId: order.id,
        orderNumber: order.order_number,
        productName: order.product_name,
        carrier: data.carrier,
        vessel: data.vessel,
        voyage: data.voyage,
        status: data.status,
        origin: data.origin,
        destination: data.destination,
        currentPosition: data.currentPosition,
        eta: data.destination?.eta || null,
        delay: null,
        containerCount: withNumbers.length,
        _demo: data._demo || false,
      });
    } catch { /* skip failed containers */ }
  }

  res.json(fleet);
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
