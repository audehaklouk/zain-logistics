/**
 * Maersk Track & Trace API
 * Docs: https://developer.maersk.com/api-catalogue/track-and-trace
 * Env:  MAERSK_CONSUMER_KEY
 */

const BASE = 'https://api.maersk.com/track/v1/containers';

export function isConfigured() {
  return !!process.env.MAERSK_CONSUMER_KEY;
}

export async function track(containerNumber) {
  const key = process.env.MAERSK_CONSUMER_KEY;
  const res = await fetch(`${BASE}/${containerNumber}`, {
    headers: {
      'Consumer-Key': key,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Maersk API ${res.status}: ${body}`);
  }

  const raw = await res.json();
  return normalize(raw, containerNumber);
}

function normalize(raw, containerNumber) {
  // Maersk response shape (v1):
  // { containerNumber, origin, destination, status, events: [...] }
  const events = (raw.events || []).map(e => ({
    type: e.eventType || e.type,
    location: [e.location?.city, e.location?.country].filter(Boolean).join(', '),
    date: e.eventDateTime || e.date,
    description: e.description || e.eventType,
    vessel: e.transportCall?.vesselName || null,
    voyage: e.transportCall?.exportVoyageNumber || null,
  }));

  return {
    containerNumber,
    carrier: 'Maersk',
    vessel: raw.vessel || raw.transportCall?.vesselName || null,
    voyage: raw.voyage || raw.transportCall?.exportVoyageNumber || null,
    status: raw.shipmentStatus || raw.status || 'Unknown',
    origin: {
      port: raw.origin?.portName || raw.origin?.city || null,
      country: raw.origin?.countryCode || null,
      unlocode: raw.origin?.unLoCode || null,
      departureDate: raw.origin?.departureDate || null,
    },
    destination: {
      port: raw.destination?.portName || raw.destination?.city || null,
      country: raw.destination?.countryCode || null,
      unlocode: raw.destination?.unLoCode || null,
      eta: raw.eta || raw.destination?.eta || null,
    },
    events,
    lastUpdated: new Date().toISOString(),
  };
}
