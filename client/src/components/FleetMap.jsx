import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import api from '../lib/api';

export default function FleetMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [fleet, setFleet] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/tracking').then(r => setFleet(r.data));
  }, []);

  useEffect(() => {
    if (!mapRef.current || !fleet.length) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); }

    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([28, 50], 3);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Aqaba destination marker
    const aqabaIcon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#EF4444;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    L.marker([29.5267, 35.0078], { icon: aqabaIcon }).addTo(map)
      .bindPopup('<strong>Aqaba Port</strong><br/>Jordan — Destination');

    const bounds = [[29.5267, 35.0078]];

    fleet.forEach(ship => {
      if (!ship.currentPosition) return;
      const { lat, lng } = ship.currentPosition;
      bounds.push([lat, lng]);

      const color = ship.delay ? '#F97316' : '#1B2A4A';
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg>
          </div>
          <div style="background:white;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600;color:${color};margin-top:2px;box-shadow:0 1px 3px rgba(0,0,0,0.2);white-space:nowrap">${ship.bookingNumber.slice(0,8)}</div>
        </div>`,
        iconSize: [24, 40], iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const eta = ship.eta ? new Date(ship.eta).toLocaleDateString() : 'TBC';
      const containers = ship.containerCount > 1 ? ` (+${ship.containerCount - 1} more)` : '';
      marker.bindPopup(`
        <strong>${ship.vessel || ship.carrier}</strong><br/>
        ${ship.carrier} · ${ship.bookingNumber}${containers}<br/>
        ${ship.origin?.port || '?'} → ${ship.destination?.port || '?'}<br/>
        <strong>${ship.productName || ship.orderNumber}</strong><br/>
        Status: <strong>${ship.status}</strong>${ship.delay ? ' ⚠️ Delayed' : ''}<br/>
        ETA: ${eta}${ship._demo ? '<br/><em style="color:#8b5cf6;font-size:10px">demo data</em>' : ''}
      `);

      // Route line to Aqaba
      L.polyline([[lat, lng], [29.5267, 35.0078]], {
        color, weight: 1.5, opacity: 0.4, dashArray: '6 6',
      }).addTo(map);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] });

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [fleet]);

  if (!fleet.length) return <div className="h-[500px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm">No active shipments to track</div>;

  return <div ref={mapRef} className="h-[500px] rounded-lg overflow-hidden border border-gray-100" />;
}
