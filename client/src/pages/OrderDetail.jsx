import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Upload, Download, MapPin, Ship, FileText, Clock, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatDateTime, formatCurrency, STATUS_FLOW, statusColor, timeAgo } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import TrackingMap from '../components/TrackingMap';
import TrackingTimeline from '../components/TrackingTimeline';
import toast from 'react-hot-toast';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [docTypes, setDocTypes] = useState([]);
  const [uploadType, setUploadType] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrder = () => {
    api.get(`/orders/${id}`).then(r => {
      setOrder(r.data);
      if (r.data.booking_number) {
        api.get(`/tracking/${r.data.booking_number}`).then(t => setTracking(t.data)).catch(() => {});
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    api.get('/documents/types').then(r => setDocTypes(r.data));
  }, [id]);

  const advanceStatus = () => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < STATUS_FLOW.length - 1) {
      api.put(`/orders/${id}/status`, { status: STATUS_FLOW[idx + 1] })
        .then(() => { toast.success(`Status updated to ${STATUS_FLOW[idx + 1]}`); fetchOrder(); })
        .catch(e => toast.error(e.response?.data?.error || 'Failed'));
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadType) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('order_id', id);
    fd.append('document_type_id', uploadType);
    try {
      await api.post('/documents/upload', fd);
      toast.success('Document uploaded');
      fetchOrder();
      setUploadType('');
    } catch { toast.error('Upload failed'); }
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    await api.delete(`/orders/${id}`);
    toast.success('Order deleted');
    navigate('/orders');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!order) return <p className="text-center text-gray-400 mt-20">Order not found</p>;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/orders" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500">{order.product_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && <button onClick={advanceStatus} className="btn-primary text-sm">Move to {nextStatus}</button>}
          <Link to={`/orders/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1.5"><Edit className="w-3.5 h-3.5" /> Edit</Link>
          {isAdmin && <button onClick={handleDelete} className="btn-danger text-sm flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="card">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((s, i) => {
            const currentIdx = STATUS_FLOW.indexOf(order.status);
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center">
                <div className={`flex flex-col items-center ${i > 0 ? 'ml-2' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'text-white' : 'bg-gray-100 text-gray-400'} ${active ? 'ring-4 ring-opacity-30' : ''}`} style={done ? { backgroundColor: statusColor(s), ...(active ? { ringColor: statusColor(s) } : {}) } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`text-[10px] mt-1 font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>{s}</p>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 ${i < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Info */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Order Details</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-400">Status</dt><dd><StatusBadge status={order.status} /></dd></div>
            <div><dt className="text-gray-400">Supplier</dt><dd className="font-medium">{order.supplier_name}</dd></div>
            <div><dt className="text-gray-400">Order Date</dt><dd>{formatDate(order.order_date)}</dd></div>
            <div><dt className="text-gray-400">Expected Delivery</dt><dd className="font-medium">{formatDate(order.expected_delivery_date)}</dd></div>
            <div><dt className="text-gray-400">Quantity</dt><dd>{order.quantity} {order.unit_size}</dd></div>
            <div><dt className="text-gray-400">Total Amount</dt><dd className="font-semibold text-gray-900">{formatCurrency(order.total_amount, order.currency)}</dd></div>
            {order.booking_number && <div><dt className="text-gray-400">Booking #</dt><dd className="font-mono text-xs">{order.booking_number}</dd></div>}
            {order.shipping_line && <div><dt className="text-gray-400">Shipping Line</dt><dd>{order.shipping_line}</dd></div>}
            {order.container_number && <div><dt className="text-gray-400">Container #</dt><dd className="font-mono text-xs">{order.container_number}</dd></div>}
            {order.vessel_name && <div><dt className="text-gray-400">Vessel</dt><dd>{order.vessel_name}</dd></div>}
          </dl>
          {order.notes && <div className="pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-600">{order.notes}</p></div>}
        </div>

        {/* Documents */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Documents ({order.documents?.length || 0})</h3>
          </div>
          <div className="flex gap-2">
            <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="input-field text-sm flex-1">
              <option value="">Select type to upload...</option>
              {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
            <label className={`btn-primary text-sm cursor-pointer flex items-center gap-1 ${!uploadType ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-3.5 h-3.5" /> Upload
              <input type="file" className="hidden" onChange={handleUpload} disabled={!uploadType} />
            </label>
          </div>
          <div className="space-y-2">
            {order.documents?.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{d.original_name}</p>
                  <p className="text-xs text-gray-400">{d.document_type_name} &middot; {d.uploaded_by_name} &middot; {formatDate(d.created_at)}</p>
                </div>
                <a href={`/api/documents/download/${d.id}`} className="p-1.5 rounded hover:bg-white"><Download className="w-3.5 h-3.5 text-gray-400" /></a>
              </div>
            ))}
            {!order.documents?.length && <p className="text-sm text-gray-400 text-center py-4">No documents uploaded</p>}
          </div>
        </div>
      </div>

      {/* Tracking Map */}
      {tracking && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Ship className="w-4 h-4 text-primary" /> Shipment Tracking — {tracking.carrier}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Vessel</p>
              <p className="text-sm font-medium">{tracking.vessel} ({tracking.voyage})</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Route</p>
              <p className="text-sm font-medium">{tracking.origin.port} → {tracking.destination.port}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">ETA</p>
              <p className="text-sm font-medium">{formatDate(tracking.delay?.newEta || tracking.destination.eta)}</p>
              {tracking.delay && <p className="text-xs text-red-500">Delayed from {formatDate(tracking.delay.originalEta)}</p>}
            </div>
          </div>
          <TrackingMap tracking={tracking} />
          <div className="mt-4">
            <TrackingTimeline events={tracking.events} />
          </div>
        </div>
      )}

      {/* Status History */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Status History
        </h3>
        <div className="space-y-3">
          {order.status_log?.map((log, i) => (
            <div key={log.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: statusColor(log.to_status) }} />
              <div>
                <p className="text-sm text-gray-700">
                  {log.from_status ? <><StatusBadge status={log.from_status} /> <ChevronRight className="w-3 h-3 inline text-gray-300" /></> : ''} <StatusBadge status={log.to_status} />
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{log.changed_by_name} &middot; {formatDateTime(log.changed_at)} {log.notes && `— ${log.notes}`}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
