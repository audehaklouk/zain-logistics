import { useState, useEffect } from 'react';
import { Search, FileText, Download, SlidersHorizontal, X } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency, ORDER_STATUSES, statusLabel, destinationLabel, shippingLineLabel } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';

// ── Column definitions (matches ARCHITECTURE.md § 10.2) ───────────────
const ALL_COLUMNS = [
  { key: 'order_number',   label: 'Order #',          always: true },
  { key: 'container_size', label: 'Container Size' },
  { key: 'container_count',label: 'Qty' },
  { key: 'product_name',   label: 'Product' },
  { key: 'supplier_name',  label: 'Supplier' },
  { key: 'status',         label: 'Status' },
  { key: 'shipping_line',  label: 'Shipping Line' },
  { key: 'expected_arrival',label: 'Exp. Delivery' },
  { key: 'bank',           label: 'Bank' },
  { key: 'amount',         label: 'Amount' },
  { key: 'original_docs_received', label: 'Orig. Docs' },
  { key: 'destination',    label: 'Destination' },
];

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.map(c => c.key));

function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Column Picker ─────────────────────────────────────────────────────
function ColumnPicker({ visible, onChange, onClose }) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-52 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Columns</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-100">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <div className="space-y-1">
        {ALL_COLUMNS.map(col => (
          <label key={col.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={visible.has(col.key)}
              disabled={col.always}
              onChange={() => {
                const next = new Set(visible);
                next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                onChange(next);
              }}
              className="accent-primary"
            />
            <span className={`text-sm ${col.always ? 'text-gray-400' : 'text-gray-700'}`}>{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Cell renderer ─────────────────────────────────────────────────────
function Cell({ col, row }) {
  switch (col.key) {
    case 'order_number':
      return <span className="font-mono font-semibold text-primary">{row.order_number}</span>;
    case 'status':
      return <StatusBadge status={row.status} />;
    case 'amount':
      return <span className="font-medium">{formatCurrency(row.amount, row.currency)}</span>;
    case 'expected_arrival':
      return <span>{formatDate(row.expected_arrival)}</span>;
    case 'destination':
      return <span>{destinationLabel(row.destination, row.destination_custom)}</span>;
    case 'shipping_line':
      return <span>{shippingLineLabel(row.shipping_line, row.shipping_line_custom)}</span>;
    case 'original_docs_received':
      return row.original_docs_received
        ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Yes</span>
        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">No</span>;
    case 'container_count':
      return <span className="font-medium">{row.container_count}</span>;
    default:
      return <span>{row[col.key] || '—'}</span>;
  }
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (supplierId) params.supplier_id = supplierId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;

    api.get('/reports', { params })
      .then(r => setOrders(r.data))
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, [search, status, supplierId, dateFrom, dateTo]);

  const buildParams = () => {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (supplierId) params.supplier_id = supplierId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return params;
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/pdf', { params: buildParams(), responseType: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(res.data, `Aqaba-Report-${date}.pdf`, 'application/pdf');
      toast.success('PDF downloaded');
    } catch { toast.error('PDF export failed'); }
    finally { setExporting(false); }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/csv', { params: buildParams(), responseType: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(res.data, `Aqaba-Report-${date}.csv`, 'text/csv');
      toast.success('CSV downloaded');
    } catch { toast.error('CSV export failed'); }
    finally { setExporting(false); }
  };

  const visibleDefs = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Aqaba Reports</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting || orders.length === 0}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting || orders.length === 0}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {exporting
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
              : <><FileText className="w-3.5 h-3.5" /> PDF</>
            }
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
            placeholder="Search orders, products, suppliers..."
          />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-full sm:w-40">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-full sm:w-36" title="Order date from" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-full sm:w-36" title="Order date to" />
      </div>

      {/* Table toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? 'Loading…' : `${orders.length} record${orders.length !== 1 ? 's' : ''}`}
        </p>
        <div className="relative">
          <button
            onClick={() => setShowCols(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Columns
          </button>
          {showCols && (
            <ColumnPicker
              visible={visibleCols}
              onChange={setVisibleCols}
              onClose={() => setShowCols(false)}
            />
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {visibleDefs.map(col => (
                    <th key={col.key} className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(row => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {visibleDefs.map(col => (
                      <td key={col.key} className="p-3 text-gray-700 whitespace-nowrap">
                        <Cell col={col} row={row} />
                      </td>
                    ))}
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={visibleDefs.length} className="p-10 text-center text-gray-400">
                      No records match the current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
