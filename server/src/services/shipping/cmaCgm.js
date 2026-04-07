/**
 * CMA CGM Track & Trace API
 * Docs: https://apis.cma-cgm.net/
 * Env:  CMA_CGM_API_KEY  (OAuth2 Bearer token or API key depending on plan)
 */

const BASE = 'https://apis.cma-cgm.net/operation/tracking/v2';

export function isConfigured() {
  return !!process.env.CMA_CGM_API_KEY;
}

export async function track(containerNumber) {
  const key = process.env.CMA_CGM_API_KEY;
  const res = await fetch(`${BASE}/containers/${encodeURIComponent(containerNumber)}`, {
    headers: {
      'KeyId': key,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CMA CGM API ${res.status}: ${body}`);
  }

  const raw = await res.json();
  return normalize(raw, containerNumber);
}

function normalize(raw, containerNumber) {
  // CMA CGM response: { container: { number, status, vessel, eta, events: [...] } }
  const container = raw.container || raw;
  const eventsRaw = container.events || container.routingDetails || [];

  const events = eventsRaw.map(e => ({
    type: e.statusCode || e.eventType || 'UNKNOWN',
    location: [e.location?.name, e.location?.countryCode].filter(Boolean).join(', '),
    date: e.actualDate || e.expectedDate || e.eventDate,
    description: e.description || e.statusCode || '',
    vessel: e.vesselName || null,
    voyage: e.voyageReference || null,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    containerNumber,
    carrier: 'CMA CGM',
    vessel: container.vesselName || null,
    voyage: container.voyageReference || null,
    status: container.status || deriveStatus(events),
    origin: {
      port: container.loadingPort?.name || container.origin || null,
      country: container.loadingPort?.countryCode || null,
      departureDate: container.departureDate || null,
    },
    destination: {
      port: container.dischargePort?.name || container.destination || null,
      country: container.dischargePort?.countryCode || null,
      eta: container.eta || null,
    },
    events,
    lastUpdated: new Date().toISOString(),
  };
}

function deriveStatus(events) {
  if (!events.length) return 'Unknown';
  const last = events[events.length - 1].type?.toUpperCase();
  if (['GATE_OUT', 'DELIVERED', 'DEL'].includes(last)) return 'Delivered';
  if (['ARR', 'ARRIVED', 'DISCHARGED'].includes(last)) return 'Arrived';
  return 'In Transit';
}
