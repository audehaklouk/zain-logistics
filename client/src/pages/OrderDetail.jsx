import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Ship, Check, Pencil, X, RefreshCw,
  MapPin, Calendar, Anchor, AlertTriangle, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Circle, Loader2
} from 'lucide-react';
import api from '../lib/api';
import {
  formatDate, formatCurrency, ORDER_STATUSES, statusLabel, statusColor,
  destinationLabel, shippingLineLabel, categoryLabel, parseContainers, countMissingContainerNumbers
} from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const TIMELINE_STATUSES = ['pending', 'confirmed', 'shipped', 'in_transit', 'delivered'];

// ── Carrier status badge ───────────────────────────────────────────────
const STATUS_COLORS = {
  'Delivered':   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Arrived':     { bg: 'bg-blue-100',    text: 'text-blue-700' },
  'In Transit':  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  'Delayed':     { bg: 'bg-red-100',     text: 'text-red-700' },
  'Unknown':     { bg: 'bg-gray-100',    text: 'text-gray-500' },
};

function TrackingStatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS['Unknown'];
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

// ── Event icon by type ─────────────────────────────────────────────────
function eventIcon(type) {
  const t = (type || '').toUpperCase();
  if (t.includes('GATE_IN') || t.includes('RECEIVED'))    return '📦';
  if (t.includes('LOAD'))                                  return '🏗️';
  if (t.includes('DEPART'))                                return '⛵';
  if (t.includes('TRANSSHIP') || t.includes('TRANSIT'))   return '🔄';
  if (t.includes('ARRIVE') || t.includes('ARR'))          return '⚓';
  if (t.includes('DISCHARG'))                              return '🏗️';
  if (t.includes('GATE_OUT') || t.includes('DELIVER'))    return '✅';
  if (t.includes('DELAY'))                                 return '⚠️';
  return '📍';
}

// ── Single container tracking card ────────────────────────────────────
function ContainerTrackingCard({ containerNumber, containerType, orderId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get(`/shipping/track/${containerNumber}`, { params: { orderId } })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load tracking'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [containerNumber]);

  const sourceBadge = data?._demo
    ? <span className="text-[10px] bg-violet-100 text-violet-500 px-1.5 py-0.5 rounded">demo</span>
    : data?.source === 'manual'
      ? <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">manual</span>
      : data?.source
        ? <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-medium">live</span>
        : null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/70">
        <span className={`text-xs font-semibold px-2 py-1 rounded font-mono flex-shrink-0 ${containerType === '40ft' ? 'bg-primary/10 text-primary' : 'bg-sky-100 text-sky-700'}`}>
          {containerType}
        </span>
        <span className="font-mono text-sm font-bold text-gray-800 flex-1">{containerNumber}</span>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
          : <>
              {data && <TrackingStatusBadge status={data.status} />}
              {sourceBadge}
              <button onClick={load} title="Refresh" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
        }
      </div>

      {/* Body */}
      {!loading && error && (
        <div className="px-4 py-3 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && data && (
        <div className="px-4 py-3 space-y-3">
          {/* Route summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">Origin</p>
              <p className="font-medium text-gray-700">
                {[data.origin?.port, data.origin?.country].filter(Boolean).join(', ') || '—'}
              </p>
              {data.origin?.departureDate && (
                <p className="text-gray-400">{formatDate(data.origin.departureDate)}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Destination / ETA</p>
              <p className="font-medium text-gray-700">
                {[data.destination?.port, data.destination?.country].filter(Boolean).join(', ') || '—'}
              </p>
              {data.destination?.eta && (
                <p className="text-gray-400">{formatDate(data.destination.eta)}</p>
              )}
            </div>
            {data.vessel && (
              <div>
                <p className="text-gray-400 mb-0.5">Vessel</p>
                <p className="font-medium text-gray-700">{data.vessel}{data.voyage ? ` / ${data.voyage}` : ''}</p>
              </div>
            )}
            {data.carrier && (
              <div>
                <p className="text-gray-400 mb-0.5">Carrier</p>
                <p className="font-medium text-gray-700">{data.carrier}</p>
              </div>
            )}
          </div>

          {/* Note for manual/empty */}
          {data.note && (
            <p className="text-xs text-gray-400 italic">{data.note}</p>
          )}

          {/* Events timeline */}
          {data.events && data.events.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? 'Hide' : 'Show'} {data.events.length} event{data.events.length !== 1 ? 's' : ''}
              </button>

              {expanded && (
                <div className="mt-2 space-y-0 relative">
                  {/* Vertical line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />
                  {[...data.events].reverse().map((ev, i) => (
                    <div key={i} className="relative flex gap-3 pl-6 pb-3 last:pb-0">
                      {/* Dot */}
                      <div className="absolute left-0 top-0.5 w-[18px] h-[18px] flex items-center justify-center text-[11px]">
                        {eventIcon(ev.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{ev.description || ev.type}</p>
                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-[10px] text-gray-400">
                          {ev.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{ev.location}</span>}
                          {ev.date && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDate(ev.date)}</span>}
                          {ev.vessel && <span className="flex items-center gap-0.5"><Anchor className="w-2.5 h-2.5" />{ev.vessel}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Last updated */}
          {data.lastUpdated && (
            <p className="text-[10px] text-gray-300 text-right">
              Updated {formatDate(data.lastUpdated)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline-editable container number cell ─────────────────────────────
function ContainerNumberCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
          className="input-field font-mono text-xs py-1 px-2 h-7 w-36"
          placeholder="e.g. MSCU1234567"
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="flex items-center gap-1.5 group"
    >
      {value ? (
        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{value}</span>
      ) : (
        <span className="text-xs text-gray-400 italic">Add number...</span>
      )}
      <Pencil className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState(null);
  const [containers, setContainers] = useState([]);
  const [savingContainers, setSavingContainers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [carrierStatus, setCarrierStatus] = useState({});

  const fetchOrder = () => {
    api.get(`/orders/${id}`).then(r => {
      setOrder(r.data);
      setContainers(parseContainers(r.data.containers));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);
  useEffect(() => {
    api.get('/shipping/carriers')
      .then(r => setCarrierStatus(r.data))
      .catch(() => {});
  }, []);

  const advanceStatus = async () => {
    const idx = TIMELINE_STATUSES.indexOf(order.status);
    if (idx < 0 || idx >= TIMELINE_STATUSES.length - 1) return;
    const next = TIMELINE_STATUSES[idx + 1];
    try {
      await api.put(`/orders/${id}`, { status: next });
      toast.success(`Status updated to ${statusLabel(next)}`);
      fetchOrder();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const saveContainerNumber = async (idx, newNumber) => {
    const updated = containers.map((c, i) => i === idx ? { ...c, number: newNumber } : c);
    setContainers(updated);
    setSavingContainers(true);
    try {
      await api.put(`/orders/${id}`, { containers: updated });
      toast.success('Container number saved');
    } catch {
      toast.error('Failed to save container number');
      setContainers(containers);
    } finally { setSavingContainers(false); }
  };

  const refreshAllTracking = async () => {
    setRefreshingAll(true);
    try {
      const r = await api.post(`/shipping/refresh/${id}`);
      const ok = r.data.results?.filter(x => x.status === 'ok').length || 0;
      toast.success(`Refreshed ${ok} container${ok !== 1 ? 's' : ''}`);
      fetchOrder();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Refresh failed');
    } finally { setRefreshingAll(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try { await api.delete(`/orders/${id}`); toast.success('Order deleted'); navigate('/orders'); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
  if (!order) return <p className="text-center text-gray-400 mt-20">Order not found</p>;

  const nextStatus = TIMELINE_STATUSES[TIMELINE_STATUSES.indexOf(order.status) + 1];
  const missingNumbers = countMissingContainerNumbers(containers);
  const trackableContainers = containers.filter(c => c.number);

  // Check which carriers have live APIs configured
  const configuredCarriers = Object.values(carrierStatus)
    .filter(c => c.configured)
    .map(c => c.name);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/orders" className="p-2 rounded-lg hover:bg-gray-100 mt-0.5">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
          <p className="text-sm text-gray-500">{order.product_name || 'No product name'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {nextStatus && order.status !== 'cancelled' && (
            <button onClick={advanceStatus} className="btn-primary text-sm">
              Move to {statusLabel(nextStatus)}
            </button>
          )}
          <Link to={`/orders/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1.5">
            <Edit className="w-3.5 h-3.5" /> Edit
          </Link>
          {isAdmin && (
            <button onClick={handleDelete} className="btn-danger text-sm flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {order.status !== 'cancelled' && (
        <div className="card overflow-x-auto">
          <div className="flex items-center min-w-max">
            {TIMELINE_STATUSES.map((s, i) => {
              const currentIdx = TIMELINE_STATUSES.indexOf(order.status);
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                      style={done ? { backgroundColor: statusColor(s) } : {}}
                    >
                      {done ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <p className={`text-[10px] mt-1 font-medium whitespace-nowrap ${active ? 'text-gray-900 font-semibold' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                      {statusLabel(s)}
                    </p>
                  </div>
                  {i < TIMELINE_STATUSES.length - 1 && (
                    <div className={`w-12 h-0.5 mx-1 mb-3 ${i < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Details */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Order Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-400 text-xs">Status</dt>
              <dd className="mt-0.5"><StatusBadge status={order.status} /></dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Category</dt>
              <dd className="font-medium mt-0.5">{categoryLabel(order.category)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Supplier</dt>
              <dd className="font-medium mt-0.5">{order.supplier_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Order Date</dt>
              <dd className="mt-0.5">{formatDate(order.date)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Destination</dt>
              <dd className="font-medium mt-0.5">{destinationLabel(order.destination, order.destination_custom)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Expected Arrival</dt>
              <dd className="font-medium mt-0.5">{formatDate(order.expected_arrival)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Amount</dt>
              <dd className="font-semibold mt-0.5">{formatCurrency(order.amount, order.currency)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs">Bank</dt>
              <dd className="mt-0.5">{order.bank || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-400 text-xs">Original Docs</dt>
              <dd className={`font-medium mt-0.5 ${order.original_docs_received ? 'text-emerald-600' : 'text-gray-400'}`}>
                {order.original_docs_received ? 'Received' : 'Pending'}
              </dd>
            </div>
          </dl>
          {order.notes && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Containers */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Containers ({containers.length})
            </h3>
            <div className="flex items-center gap-2">
              {missingNumbers > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  {missingNumbers} missing #
                </span>
              )}
              {savingContainers && (
                <span className="text-xs text-gray-400">Saving...</span>
              )}
            </div>
          </div>
          {containers.length === 0 ? (
            <p className="text-sm text-gray-400">No containers — edit to add</p>
          ) : (
            <div className="space-y-2">
              {containers.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                  <span className={`text-xs font-semibold px-2 py-1 rounded font-mono ${c.type === '40ft' ? 'bg-primary/10 text-primary' : 'bg-sky-100 text-sky-700'}`}>
                    {c.type}
                  </span>
                  <div className="flex-1">
                    <ContainerNumberCell
                      value={c.number || ''}
                      onSave={(num) => saveContainerNumber(i, num)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">Click a container number to edit it.</p>
        </div>
      </div>

      {/* Shipping */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Ship className="w-4 h-4 text-primary" /> Shipping
          </h3>
          <div className="flex items-center gap-2">
            {/* Live API indicators */}
            {configuredCarriers.length > 0 && (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                Live: {configuredCarriers.join(', ')}
              </span>
            )}
            {configuredCarriers.length === 0 && (
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                No live APIs configured
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Shipping Line</dt>
            <dd className="font-medium">
              {order.shipping_line
                ? shippingLineLabel(order.shipping_line, order.shipping_line_custom)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Tracking Number</dt>
            <dd>
              {order.shipping_tracking_number
                ? <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{order.shipping_tracking_number}</span>
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs mb-0.5">Tracking Source</dt>
            <dd className="capitalize">{order.tracking_source || 'manual'}</dd>
          </div>
        </div>
      </div>

      {/* Live Container Tracking */}
      {trackableContainers.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Container Tracking
              <span className="text-xs font-normal text-gray-400">({trackableContainers.length} container{trackableContainers.length !== 1 ? 's' : ''})</span>
            </h3>
            <button
              onClick={refreshAllTracking}
              disabled={refreshingAll}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              {refreshingAll
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              Refresh all
            </button>
          </div>

          <div className="space-y-3">
            {trackableContainers.map((c, i) => (
              <ContainerTrackingCard
                key={c.number}
                containerNumber={c.number}
                containerType={c.type}
                orderId={id}
              />
            ))}
          </div>

          {configuredCarriers.length === 0 && (
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3 text-xs text-violet-700">
              <strong>Demo mode</strong> — showing simulated vessel/route data seeded from the container number.
              Add <code className="font-mono">MAERSK_CONSUMER_KEY</code>, <code className="font-mono">HAPAG_LLOYD_API_KEY</code>,
              or <code className="font-mono">CMA_CGM_API_KEY</code> to your <code className="font-mono">.env</code> for live tracking.
            </div>
          )}
        </div>
      )}

      {trackableContainers.length === 0 && containers.length > 0 && (
        <div className="card">
          <p className="text-sm text-gray-400 text-center py-4">
            Add container numbers above to enable live tracking.
          </p>
        </div>
      )}
    </div>
  );
}
