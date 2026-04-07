/**
 * Hapag-Lloyd DCSA Track & Trace v2
 * Docs: https://www.hapag-lloyd.com/en/online-business/our-services/apis.html
 * Env:  HAPAG_LLOYD_API_KEY
 */

const BASE = 'https://api.hlag.com/hlag/external/v2';

export function isConfigured() {
  return !!process.env.HAPAG_LLOYD_API_KEY;
}

export async function track(containerNumber) {
  const key = process.env.HAPAG_LLOYD_API_KEY;
  const url = `${BASE}/events/?equipmentReference=${encodeURIComponent(containerNumber)}`;

  const res = await fetch(url, {
    headers: {
      'ApiKey': key,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hapag-Lloyd API ${res.status}: ${body}`);
  }

  const raw = await res.json();
  return normalize(raw, containerNumber);
}

function normalize(raw, containerNumber) {
  // DCSA T&T v2 returns an array of events
  const eventsRaw = Array.isArray(raw) ? raw : (raw.events || []);

  const events = eventsRaw.map(e => ({
    type: e.eventType || e.equipmentEventTypeCode || 'UNKNOWN',
    location: [
      e.eventLocation?.locationName,
      e.eventLocation?.countryCode,
    ].filter(Boolean).join(', '),
    date: e.eventDateTime,
    description: e.description || e.eventType || '',
    vessel: e.transportCall?.vesselName || null,
    voyage: e.transportCall?.exportVoyageNumber || null,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Derive origin / destination from first LOAD and last DISCHARGE
  const loaded = events.find(e => e.type === 'LOAD');
  const discharged = [...events].reverse().find(e => e.type === 'DISCHARGE' || e.type === 'DISCHRG');
  const latest = events[events.length - 1];

  return {
    containerNumber,
    carrier: 'Hapag-Lloyd',
    vessel: latest?.vessel || null,
    voyage: latest?.voyage || null,
    status: deriveStatus(events),
    origin: {
      port: loaded?.location || null,
      country: null,
      departureDate: loaded?.date || null,
    },
    destination: {
      port: discharged?.location || null,
      country: null,
      eta: discharged?.date || null,
    },
    events,
    lastUpdated: new Date().toISOString(),
  };
}

function deriveStatus(events) {
  if (!events.length) return 'Unknown';
  const last = events[events.length - 1].type?.toUpperCase();
  if (last === 'GATE_OUT' || last === 'RETURN') return 'Delivered';
  if (last === 'DISCHARGE' || last === 'DISCHRG') return 'Arrived';
  if (last === 'LOAD' || last === 'DEPART') return 'In Transit';
  return 'In Transit';
}
