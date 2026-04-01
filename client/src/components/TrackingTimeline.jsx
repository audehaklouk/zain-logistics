import { formatDateTime } from '../lib/utils';
import { MapPin, Ship, ArrowRight, Package, AlertTriangle, CheckCircle } from 'lucide-react';

const eventIcons = {
  GATE_IN: Package,
  LOADED: Ship,
  DEPARTED: ArrowRight,
  TRANSSHIPMENT_ARRIVED: MapPin,
  TRANSSHIPMENT_DEPARTED: ArrowRight,
  IN_TRANSIT: Ship,
  ARRIVED: MapPin,
  DISCHARGED: Package,
  GATE_OUT: CheckCircle,
  DELAY: AlertTriangle,
};

const eventColors = {
  GATE_IN: 'bg-gray-100 text-gray-600',
  LOADED: 'bg-blue-100 text-blue-600',
  DEPARTED: 'bg-blue-100 text-blue-600',
  TRANSSHIPMENT_ARRIVED: 'bg-purple-100 text-purple-600',
  TRANSSHIPMENT_DEPARTED: 'bg-purple-100 text-purple-600',
  IN_TRANSIT: 'bg-primary/10 text-primary',
  ARRIVED: 'bg-green-100 text-green-600',
  DISCHARGED: 'bg-green-100 text-green-600',
  GATE_OUT: 'bg-green-100 text-green-600',
  DELAY: 'bg-red-100 text-red-600',
};

export default function TrackingTimeline({ events }) {
  return (
    <div className="space-y-0">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tracking Events</h4>
      <div className="relative">
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-200" />
        {events.map((evt, i) => {
          const Icon = eventIcons[evt.type] || MapPin;
          const colorClass = eventColors[evt.type] || 'bg-gray-100 text-gray-600';
          return (
            <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="pt-1.5 min-w-0">
                <p className="text-sm font-medium text-gray-800">{evt.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {evt.location} &middot; {formatDateTime(evt.date)}
                  {evt.vessel && ` &middot; ${evt.vessel}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
