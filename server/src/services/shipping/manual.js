/**
 * Manual / fallback tracking provider.
 * Returns shipping_data JSON stored on the order row if present,
 * otherwise returns realistic demo data seeded from the container number.
 */

// Deterministic "random" from a string — gives consistent demo data per container
function seed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return Math.abs(h);
}
function pick(arr, s) { return arr[s % arr.length]; }

// ── Demo vessel pools per carrier ─────────────────────────────────────
const DEMO = {
  maersk: {
    vessels: [
      'Maersk Seletar', 'Maersk Tangier', 'Maersk Saigon',
      'Madrid Maersk', 'Mumbai Maersk', 'Manchester Maersk',
    ],
    voyages: ['402E', '318W', '512E', '206W', '714E'],
    carrier: 'Maersk',
  },
  hapag_lloyd: {
    vessels: [
      'Berlin Express', 'Hamburg Express', 'Copenhagen Express',
      'Brussels Express', 'Valparaiso Express',
    ],
    voyages: ['112S', '224N', '336S', '448N', '560S'],
    carrier: 'Hapag-Lloyd',
  },
  cma_cgm: {
    vessels: [
      'CMA CGM Marco Polo', 'CMA CGM Jules Verne', 'CMA CGM Antoine de Saint Exupery',
      'CMA CGM Tanya', 'CMA CGM Dalila',
    ],
    voyages: ['0MR2ME1', '0FX4NW2', '0AB7SE3', '0GH2NE4'],
    carrier: 'CMA CGM',
  },
  msc: {
    vessels: [
      'MSC Oscar', 'MSC Zoe', 'MSC Gülsün',
      'MSC Isabella', 'MSC Mia',
    ],
    voyages: ['226W', '114E', '338W', '452E'],
    carrier: 'MSC',
  },
};

// Common trans-shipment routes from Aqaba-bound shipments
const ROUTES = [
  {
    origin: { port: 'Mersin', country: 'TR', unlocode: 'TRMER', lat: 36.7991, lng: 34.6332 },
    via: [{ port: 'Port Said', country: 'EG', lat: 31.2653, lng: 32.3019 }],
    destination: { port: 'Aqaba', country: 'JO', unlocode: 'JOAQJ', lat: 29.5267, lng: 35.0078 },
    transitDays: 18,
  },
  {
    origin: { port: 'Nhava Sheva', country: 'IN', unlocode: 'INNSA', lat: 18.952, lng: 72.951 },
    via: [{ port: 'Jebel Ali', country: 'AE', lat: 25.005, lng: 55.064 }],
    destination: { port: 'Aqaba', country: 'JO', unlocode: 'JOAQJ', lat: 29.5267, lng: 35.0078 },
    transitDays: 22,
  },
  {
    origin: { port: 'Shanghai', country: 'CN', unlocode: 'CNSHA', lat: 31.2304, lng: 121.4737 },
    via: [
      { port: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198 },
      { port: 'Jebel Ali', country: 'AE', lat: 25.005, lng: 55.064 },
    ],
    destination: { port: 'Aqaba', country: 'JO', unlocode: 'JOAQJ', lat: 29.5267, lng: 35.0078 },
    transitDays: 32,
  },
  {
    origin: { port: 'Istanbul', country: 'TR', unlocode: 'TRIST', lat: 41.0082, lng: 28.9784 },
    via: [],
    destination: { port: 'Aqaba', country: 'JO', unlocode: 'JOAQJ', lat: 29.5267, lng: 35.0078 },
    transitDays: 12,
  },
  {
    origin: { port: 'Rotterdam', country: 'NL', unlocode: 'NLRTM', lat: 51.9225, lng: 4.4792 },
    via: [{ port: 'Port Said', country: 'EG', lat: 31.2653, lng: 32.3019 }],
    destination: { port: 'Aqaba', country: 'JO', unlocode: 'JOAQJ', lat: 29.5267, lng: 35.0078 },
    transitDays: 25,
  },
];

// Status scenarios to make demo interesting
const SCENARIOS = ['in_transit', 'in_transit', 'in_transit', 'arrived', 'delivered', 'transship'];

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000).toISOString(); }

function buildDemoData(containerNumber, carrierKey) {
  const s = seed(containerNumber);
  const pool = DEMO[carrierKey] || DEMO.maersk;
  const route = pick(ROUTES, s >> 2);
  const scenario = pick(SCENARIOS, s >> 4);
  const vessel = pick(pool.vessels, s >> 6);
  const voyage = pick(pool.voyages, s >> 8);

  const departedDaysAgo = 5 + (s % 20);          // departed 5–25 days ago
  const etaDaysFromNow  = route.transitDays - departedDaysAgo; // could be negative (arrived)

  const events = [];

  // Gate in (3 days before departure)
  events.push({
    type: 'GATE_IN',
    location: `${route.origin.port}, ${route.origin.country}`,
    date: daysAgo(departedDaysAgo + 3),
    description: 'Container received at origin terminal',
  });

  // Loaded
  events.push({
    type: 'LOADED',
    location: `${route.origin.port}, ${route.origin.country}`,
    date: daysAgo(departedDaysAgo + 1),
    description: `Loaded on vessel ${vessel}`,
    vessel,
    voyage,
  });

  // Departed origin
  events.push({
    type: 'DEPARTED',
    location: `${route.origin.port}, ${route.origin.country}`,
    date: daysAgo(departedDaysAgo),
    description: 'Vessel departed from port of loading',
    vessel,
    voyage,
  });

  // Via ports
  const viaOffset = Math.floor(departedDaysAgo / (route.via.length + 1));
  route.via.forEach((v, i) => {
    const arrivalDaysAgo = departedDaysAgo - viaOffset * (i + 1);
    if (arrivalDaysAgo > 0) {
      events.push({
        type: 'TRANSSHIPMENT_ARRIVED',
        location: `${v.port}, ${v.country}`,
        date: daysAgo(arrivalDaysAgo + 1),
        description: `Arrived at ${v.port} transshipment hub`,
      });
      events.push({
        type: 'TRANSSHIPMENT_DEPARTED',
        location: `${v.port}, ${v.country}`,
        date: daysAgo(arrivalDaysAgo),
        description: `Departed ${v.port} — continuing to destination`,
        vessel,
        voyage,
      });
    }
  });

  // Interpolate current lat/lng between waypoints based on time elapsed
  function interpolatePosition(fromLat, fromLng, toLat, toLng, progress) {
    progress = Math.max(0, Math.min(1, progress));
    return {
      lat: fromLat + (toLat - fromLat) * progress,
      lng: fromLng + (toLng - fromLng) * progress,
    };
  }

  // Build full waypoint list: origin → via[] → destination
  const waypoints = [
    { lat: route.origin.lat, lng: route.origin.lng },
    ...route.via.map(v => ({ lat: v.lat, lng: v.lng })),
    { lat: route.destination.lat, lng: route.destination.lng },
  ];

  function currentPositionAlongRoute(progressFraction) {
    if (progressFraction <= 0) return waypoints[0];
    if (progressFraction >= 1) return waypoints[waypoints.length - 1];
    const totalSegments = waypoints.length - 1;
    const scaledProgress = progressFraction * totalSegments;
    const segIdx = Math.min(Math.floor(scaledProgress), totalSegments - 1);
    const segProgress = scaledProgress - segIdx;
    return interpolatePosition(
      waypoints[segIdx].lat, waypoints[segIdx].lng,
      waypoints[segIdx + 1].lat, waypoints[segIdx + 1].lng,
      segProgress
    );
  }

  let status, eta, currentPosition;
  const transitProgress = departedDaysAgo / route.transitDays;

  if (scenario === 'delivered') {
    eta = daysAgo(2);
    events.push({
      type: 'ARRIVED',
      location: `${route.destination.port}, ${route.destination.country}`,
      date: daysAgo(3),
      description: 'Vessel arrived at destination port',
      vessel,
    });
    events.push({
      type: 'DISCHARGED',
      location: `${route.destination.port}, ${route.destination.country}`,
      date: daysAgo(2),
      description: 'Container discharged from vessel',
    });
    events.push({
      type: 'GATE_OUT',
      location: `${route.destination.port}, ${route.destination.country}`,
      date: daysAgo(1),
      description: 'Container released — customs cleared',
    });
    status = 'Delivered';
    currentPosition = { ...waypoints[waypoints.length - 1], heading: 0, speed: 0 };
  } else if (scenario === 'arrived' || etaDaysFromNow <= 0) {
    eta = daysAgo(1);
    events.push({
      type: 'ARRIVED',
      location: `${route.destination.port}, ${route.destination.country}`,
      date: daysAgo(2),
      description: 'Vessel arrived at destination port',
      vessel,
    });
    events.push({
      type: 'DISCHARGED',
      location: `${route.destination.port}, ${route.destination.country}`,
      date: daysAgo(1),
      description: 'Container discharged — awaiting customs',
    });
    status = 'Arrived';
    currentPosition = { ...waypoints[waypoints.length - 1], heading: 0, speed: 0 };
  } else {
    eta = daysFromNow(Math.max(1, etaDaysFromNow));
    events.push({
      type: 'IN_TRANSIT',
      location: `En route to ${route.destination.port}`,
      date: daysAgo(1),
      description: `In transit — ETA ${route.destination.port} in ${Math.max(1, etaDaysFromNow)} day${etaDaysFromNow !== 1 ? 's' : ''}`,
    });
    status = 'In Transit';
    const pos = currentPositionAlongRoute(Math.min(transitProgress, 0.95));
    // Heading: rough bearing towards next waypoint
    const heading = 90 + (s % 270);
    currentPosition = { lat: pos.lat, lng: pos.lng, heading, speed: 12 + (s % 8) };
  }

  return {
    containerNumber,
    carrier: pool.carrier,
    vessel,
    voyage,
    status,
    currentPosition,
    origin: {
      port: route.origin.port,
      country: route.origin.country,
      unlocode: route.origin.unlocode || null,
      departureDate: daysAgo(departedDaysAgo),
    },
    destination: {
      port: route.destination.port,
      country: route.destination.country,
      unlocode: route.destination.unlocode || null,
      eta,
    },
    events,
    lastUpdated: new Date().toISOString(),
    _demo: true,
  };
}

// Carrier key lookup (mirrors index.js PREFIX_MAP)
const PREFIX_TO_CARRIER = {
  MSKU: 'maersk', MAEU: 'maersk', MRKU: 'maersk',
  HLBU: 'hapag_lloyd', HLXU: 'hapag_lloyd', HLCU: 'hapag_lloyd', UACU: 'hapag_lloyd',
  CMAU: 'cma_cgm', CRXU: 'cma_cgm', CGMU: 'cma_cgm',
  MSCU: 'msc', MEDU: 'msc',
};

export function track(containerNumber, orderData = null) {
  // If the order has saved shipping_data for this container, return it
  if (orderData?.shipping_data) {
    let stored;
    try {
      stored = typeof orderData.shipping_data === 'string'
        ? JSON.parse(orderData.shipping_data)
        : orderData.shipping_data;
    } catch { /* ignore */ }

    if (stored) {
      const entry = stored[containerNumber] || (stored.containerNumber === containerNumber ? stored : null);
      if (entry) return { ...entry, lastUpdated: new Date().toISOString() };
    }
  }

  // Generate deterministic demo data based on container prefix
  const prefix = (containerNumber || '').toUpperCase().slice(0, 4);
  const carrierKey = PREFIX_TO_CARRIER[prefix];

  if (carrierKey) {
    return buildDemoData(containerNumber, carrierKey);
  }

  // Unknown prefix — minimal stub
  return {
    containerNumber,
    carrier: 'Unknown',
    status: 'Unknown',
    events: [],
    origin: { port: null, country: null, departureDate: null },
    destination: { port: null, country: null, eta: null },
    vessel: null,
    voyage: null,
    note: 'Container prefix not recognised. Add shipping details to this order.',
    lastUpdated: new Date().toISOString(),
  };
}
