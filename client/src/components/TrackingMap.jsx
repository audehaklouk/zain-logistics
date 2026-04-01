import { useEffect, useRef } from 'react';
import L from 'leaflet';

const portIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const vesselIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#1B2A4A;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function TrackingMap({ tracking }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !tracking?.route) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); }

    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([30, 40], 4);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const routePoints = tracking.route.map(r => [r.lat, r.lng]);

    // Find current position index
    let vesselIdx = 0;
    for (let i = 0; i < tracking.route.length; i++) {
      if (tracking.route[i].status === 'departed' || tracking.route[i].status === 'arrived' || tracking.route[i].status === 'delayed') {
        vesselIdx = i;
      }
    }

    // Completed route (solid)
    if (vesselIdx > 0) {
      const completed = routePoints.slice(0, vesselIdx + 1);
      if (tracking.currentPosition) completed.push([tracking.currentPosition.lat, tracking.currentPosition.lng]);
      L.polyline(completed, { color: '#1B2A4A', weight: 3, opacity: 0.9 }).addTo(map);
    }

    // Remaining route (dashed)
    const remaining = tracking.currentPosition
      ? [[tracking.currentPosition.lat, tracking.currentPosition.lng], ...routePoints.slice(vesselIdx + 1)]
      : routePoints.slice(vesselIdx);
    if (remaining.length > 1) {
      L.polyline(remaining, { color: '#1B2A4A', weight: 2, opacity: 0.4, dashArray: '8 8' }).addTo(map);
    }

    // Port markers
    tracking.route.forEach((port, i) => {
      const color = i === 0 ? '#10B981' : i === tracking.route.length - 1 ? '#EF4444' : '#3B82F6';
      const marker = L.marker([port.lat, port.lng], { icon: portIcon(color) }).addTo(map);
      const dates = [];
      if (port.arrival) dates.push(`Arrival: ${new Date(port.arrival).toLocaleDateString()}`);
      if (port.departure) dates.push(`Departure: ${new Date(port.departure).toLocaleDateString()}`);
      marker.bindPopup(`<strong>${port.port}, ${port.country}</strong><br/>${dates.join('<br/>') || 'Scheduled'}`, { className: 'tracking-popup' });
    });

    // Vessel marker
    if (tracking.currentPosition) {
      const vm = L.marker([tracking.currentPosition.lat, tracking.currentPosition.lng], { icon: vesselIcon }).addTo(map);
      vm.bindPopup(`<strong>${tracking.vessel}</strong><br/>Speed: ${tracking.currentPosition.speed} knots<br/>Status: ${tracking.status}<br/>ETA: ${new Date(tracking.delay?.newEta || tracking.destination.eta).toLocaleDateString()}`);
    }

    // Fit bounds
    const allPoints = [...routePoints];
    if (tracking.currentPosition) allPoints.push([tracking.currentPosition.lat, tracking.currentPosition.lng]);
    map.fitBounds(allPoints, { padding: [40, 40] });

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [tracking]);

  return <div ref={mapRef} className="h-[350px] rounded-lg overflow-hidden border border-gray-100" />;
}
