import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Mock tracking data for demo
const MOCK_TRACKING = {
  'MAEU12345678': {
    carrier: 'Maersk',
    bookingNumber: 'MAEU12345678',
    containerNumber: 'MSKU9876543',
    vessel: 'Maersk Seletar',
    voyage: '402E',
    status: 'In Transit',
    origin: { port: 'Mersin', country: 'Turkey', unlocode: 'TRMER', departureDate: '2026-03-20T08:00:00Z' },
    destination: { port: 'Aqaba', country: 'Jordan', unlocode: 'JOAQJ', eta: '2026-04-08T14:00:00Z' },
    currentPosition: { lat: 28.5, lng: 34.2, heading: 180, speed: 14.5 },
    events: [
      { type: 'GATE_IN', location: 'Mersin, Turkey', date: '2026-03-18T10:30:00Z', description: 'Container received at origin terminal' },
      { type: 'LOADED', location: 'Mersin, Turkey', vessel: 'Maersk Seletar', voyage: '402E', date: '2026-03-20T08:00:00Z', description: 'Loaded on vessel' },
      { type: 'DEPARTED', location: 'Mersin, Turkey', date: '2026-03-20T14:00:00Z', description: 'Vessel departed from port' },
      { type: 'TRANSSHIPMENT_ARRIVED', location: 'Port Said, Egypt', date: '2026-03-25T06:00:00Z', description: 'Arrived at transshipment port' },
      { type: 'TRANSSHIPMENT_DEPARTED', location: 'Port Said, Egypt', vessel: 'Maersk Seletar', date: '2026-03-27T09:00:00Z', description: 'Departed transshipment port — entering Suez Canal' },
      { type: 'IN_TRANSIT', location: 'Red Sea', date: '2026-04-01T12:00:00Z', description: 'In transit through Red Sea to destination' },
    ],
    route: [
      { port: 'Mersin', country: 'TR', lat: 36.7991, lng: 34.6332, arrival: null, departure: '2026-03-20T14:00:00Z', status: 'departed' },
      { port: 'Port Said', country: 'EG', lat: 31.2653, lng: 32.3019, arrival: '2026-03-25T06:00:00Z', departure: '2026-03-27T09:00:00Z', status: 'departed' },
      { port: 'Aqaba', country: 'JO', lat: 29.5267, lng: 35.0078, arrival: '2026-04-08T14:00:00Z', departure: null, status: 'upcoming' },
    ],
  },
  'HLCU87654321': {
    carrier: 'Hapag-Lloyd',
    bookingNumber: 'HLCU87654321',
    containerNumber: 'HLXU5544332',
    vessel: 'Berlin Express',
    voyage: '112S',
    status: 'Delivered',
    origin: { port: 'Mersin', country: 'Turkey', unlocode: 'TRMER', departureDate: '2026-02-28T08:00:00Z' },
    destination: { port: 'Aqaba', country: 'Jordan', unlocode: 'JOAQJ', eta: '2026-03-15T10:00:00Z' },
    currentPosition: { lat: 29.5267, lng: 35.0078, heading: 0, speed: 0 },
    events: [
      { type: 'GATE_IN', location: 'Mersin, Turkey', date: '2026-02-26T09:00:00Z', description: 'Container received at terminal' },
      { type: 'LOADED', location: 'Mersin, Turkey', vessel: 'Berlin Express', date: '2026-02-28T08:00:00Z', description: 'Loaded on vessel' },
      { type: 'DEPARTED', location: 'Mersin, Turkey', date: '2026-02-28T14:00:00Z', description: 'Vessel departed' },
      { type: 'ARRIVED', location: 'Aqaba, Jordan', date: '2026-03-14T06:00:00Z', description: 'Vessel arrived at Aqaba port' },
      { type: 'DISCHARGED', location: 'Aqaba, Jordan', date: '2026-03-14T14:00:00Z', description: 'Container discharged from vessel' },
      { type: 'GATE_OUT', location: 'Aqaba, Jordan', date: '2026-03-15T10:00:00Z', description: 'Container released — cleared customs' },
    ],
    route: [
      { port: 'Mersin', country: 'TR', lat: 36.7991, lng: 34.6332, arrival: null, departure: '2026-02-28T14:00:00Z', status: 'departed' },
      { port: 'Aqaba', country: 'JO', lat: 29.5267, lng: 35.0078, arrival: '2026-03-14T06:00:00Z', departure: null, status: 'arrived' },
    ],
  },
  'MSCU11223344': {
    carrier: 'MSC',
    bookingNumber: 'MSCU11223344',
    containerNumber: 'MSCU7788990',
    vessel: 'MSC Oscar',
    voyage: '226W',
    status: 'Delayed',
    origin: { port: 'Nhava Sheva', country: 'India', unlocode: 'INNSA', departureDate: '2026-03-10T06:00:00Z' },
    destination: { port: 'Aqaba', country: 'Jordan', unlocode: 'JOAQJ', eta: '2026-04-15T10:00:00Z' },
    currentPosition: { lat: 25.005, lng: 55.064, heading: 270, speed: 0 },
    delay: { originalEta: '2026-04-10T10:00:00Z', newEta: '2026-04-15T10:00:00Z', reason: 'Port congestion at Jebel Ali' },
    events: [
      { type: 'GATE_IN', location: 'Nhava Sheva, India', date: '2026-03-08T07:00:00Z', description: 'Container received at JNPT terminal' },
      { type: 'LOADED', location: 'Nhava Sheva, India', vessel: 'MSC Oscar', date: '2026-03-10T06:00:00Z', description: 'Loaded on vessel' },
      { type: 'DEPARTED', location: 'Nhava Sheva, India', date: '2026-03-10T18:00:00Z', description: 'Vessel departed Mumbai' },
      { type: 'TRANSSHIPMENT_ARRIVED', location: 'Jebel Ali, UAE', date: '2026-03-20T08:00:00Z', description: 'Arrived at transshipment port' },
      { type: 'DELAY', location: 'Jebel Ali, UAE', date: '2026-03-28T12:00:00Z', description: 'Delayed — port congestion. New ETA Aqaba: April 15 (was April 10)' },
    ],
    route: [
      { port: 'Nhava Sheva', country: 'IN', lat: 18.952, lng: 72.951, arrival: null, departure: '2026-03-10T18:00:00Z', status: 'departed' },
      { port: 'Jebel Ali', country: 'AE', lat: 25.005, lng: 55.064, arrival: '2026-03-20T08:00:00Z', departure: null, status: 'delayed' },
      { port: 'Aqaba', country: 'JO', lat: 29.5267, lng: 35.0078, arrival: '2026-04-15T10:00:00Z', departure: null, status: 'upcoming' },
    ],
  },
};

router.get('/:bookingNumber', authenticate, (req, res) => {
  const tracking = MOCK_TRACKING[req.params.bookingNumber];
  if (!tracking) {
    return res.status(404).json({ error: 'Tracking data not found for this booking number' });
  }
  res.json({ ...tracking, lastUpdated: new Date().toISOString() });
});

// Fleet overview — all active shipments
router.get('/', authenticate, (req, res) => {
  const active = Object.values(MOCK_TRACKING)
    .filter(t => t.status !== 'Delivered')
    .map(t => ({
      bookingNumber: t.bookingNumber,
      carrier: t.carrier,
      vessel: t.vessel,
      status: t.status,
      origin: t.origin,
      destination: t.destination,
      currentPosition: t.currentPosition,
      eta: t.destination.eta,
      delay: t.delay || null,
    }));
  res.json(active);
});

export default router;
