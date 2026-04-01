import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, FileWarning, Truck, Mail } from 'lucide-react';
import api from '../lib/api';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';

const typeIcons = {
  overdue: AlertTriangle,
  missing_docs: FileWarning,
  shipment_departed: Truck,
  shipment_arrived: Truck,
  order_confirmed: Bell,
  shipment_delayed: AlertTriangle,
};
const typeColors = {
  overdue: 'text-red-500 bg-red-50',
  missing_docs: 'text-yellow-600 bg-yellow-50',
  shipment_departed: 'text-blue-500 bg-blue-50',
  shipment_arrived: 'text-green-500 bg-green-50',
  order_confirmed: 'text-primary bg-primary/10',
  shipment_delayed: 'text-orange-500 bg-orange-50',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => api.get('/notifications').then(r => { setNotifications(r.data); setLoading(false); });
  useEffect(() => { fetch(); }, []);

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    toast.success('All marked as read');
    fetch();
  };

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetch();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1.5"><CheckCheck className="w-4 h-4" /> Mark All Read</button>
      </div>

      <div className="space-y-2">
        {notifications.map(n => {
          const Icon = typeIcons[n.type] || Bell;
          const colorClass = typeColors[n.type] || 'text-gray-500 bg-gray-50';
          return (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`card !p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md ${n.read ? 'opacity-60' : ''}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {n.order_id && <Link to={`/orders/${n.order_id}`} onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline flex-shrink-0">View Order</Link>}
            </div>
          );
        })}
        {notifications.length === 0 && !loading && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
