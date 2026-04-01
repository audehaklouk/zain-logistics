import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Package, Truck, AlertTriangle, Calendar, ArrowRight, Clock, FileWarning, MapPin } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency, statusColor, timeAgo } from '../lib/utils';
import AnimatedCounter from '../components/AnimatedCounter';
import StatusBadge from '../components/StatusBadge';
import { CardSkeleton } from '../components/LoadingSkeleton';
import FleetMap from '../components/FleetMap';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/orders/stats'),
      api.get('/orders/alerts'),
      api.get('/activity?limit=10'),
      api.post('/notifications/generate'),
    ]).then(([s, a, act]) => {
      setStats(s.data);
      setAlerts(a.data);
      setActivities(act.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  );

  const statCards = [
    { label: 'Active Orders', value: stats?.active_orders || 0, icon: Package, color: 'bg-primary', textColor: 'text-primary' },
    { label: 'Pending Shipment', value: stats?.pending_shipment || 0, icon: Truck, color: 'bg-orange-500', textColor: 'text-orange-500' },
    { label: 'Arriving This Week', value: stats?.arriving_this_week || 0, icon: Calendar, color: 'bg-accent', textColor: 'text-accent' },
    { label: 'Action Required', value: stats?.alert_count || 0, icon: AlertTriangle, color: 'bg-red-500', textColor: 'text-red-500' },
  ];

  const pieData = stats?.status_breakdown?.map(s => ({ name: s.status, value: s.count, color: statusColor(s.status) })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/orders/new" className="btn-primary text-sm flex items-center gap-2">
          <Package className="w-4 h-4" /> New Order
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={card.label} className={`card hover:shadow-md transition-shadow duration-200 animate-fade-in-up stagger-${i + 1}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`text-3xl font-bold mt-1 ${card.textColor}`}>
                  <AnimatedCounter value={card.value} />
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${card.color} bg-opacity-10 flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut: Orders by Status */}
        <div className="card animate-fade-in-up stagger-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} animationBegin={200} animationDuration={800}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        {/* Bar: Monthly Orders */}
        <div className="card animate-fade-in-up stagger-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Orders</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.monthly_orders || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1B2A4A" radius={[4, 4, 0, 0]} animationBegin={400} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal Bar: Spend by Supplier */}
        <div className="card animate-fade-in-up stagger-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Suppliers by Spend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.spend_by_supplier || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="company_name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="total" fill="#E85D04" radius={[0, 4, 4, 0]} animationBegin={600} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet Map */}
      <div className="card animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Fleet Overview — Active Shipments
          </h3>
        </div>
        <FleetMap />
      </div>

      {/* Bottom Row: Activity + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card animate-fade-in-up stagger-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">{a.details}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.user_name} &middot; {timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && <p className="text-sm text-gray-400">No recent activity</p>}
          </div>
        </div>

        {/* Alerts */}
        <div className="card animate-fade-in-up stagger-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Alerts & Action Required</h3>
          <div className="space-y-3">
            {alerts?.overdue?.map(o => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Overdue: {o.order_number}</p>
                  <p className="text-xs text-red-600">Sent to {o.supplier_name} but not confirmed</p>
                </div>
              </Link>
            ))}
            {alerts?.missing_docs?.map(o => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition-colors">
                <FileWarning className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Missing Docs: {o.order_number}</p>
                  <p className="text-xs text-yellow-600">{o.status} — no documents uploaded</p>
                </div>
              </Link>
            ))}
            {alerts?.arriving_soon?.map(o => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                <Calendar className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Arriving: {o.order_number}</p>
                  <p className="text-xs text-blue-600">Expected {formatDate(o.expected_delivery_date)}</p>
                </div>
              </Link>
            ))}
            {(!alerts?.overdue?.length && !alerts?.missing_docs?.length && !alerts?.arriving_soon?.length) && (
              <p className="text-sm text-gray-400">All clear — no alerts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
