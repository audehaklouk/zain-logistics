import { useState, useEffect } from 'react';
import { Download, FileText, Truck, Calendar, AlertTriangle, Building2, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { key: 'pending-shipment', label: 'Pending Shipment', icon: Truck, desc: 'Orders confirmed but not yet shipped' },
  { key: 'by-supplier', label: 'By Supplier', icon: Building2, desc: 'Order summary grouped by supplier' },
  { key: 'monthly-summary', label: 'Monthly Summary', icon: BarChart3, desc: 'Orders placed per month with totals' },
  { key: 'due-this-week', label: 'Due This Week', icon: Calendar, desc: 'Shipments expected to arrive this week' },
  { key: 'overdue', label: 'Overdue Shipments', icon: AlertTriangle, desc: 'Past expected delivery date' },
];

function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [active, setActive] = useState('pending-shipment');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/${active}`).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [active]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/reports/${active}/csv`, { responseType: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(res.data, `ZainLogistics_${active}_${date}.csv`, 'text/csv');
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/reports/${active}/pdf`, { responseType: 'blob' });
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(res.data, `ZainLogistics_${active}_${date}.pdf`, 'application/pdf');
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const activeReport = REPORT_TYPES.find(r => r.key === active);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={exporting || !data?.data?.length} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={exportPDF} disabled={exporting || !data?.data?.length} className="btn-primary text-sm flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {REPORT_TYPES.map(r => (
          <button key={r.key} onClick={() => setActive(r.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active === r.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}>
            <r.icon className="w-4 h-4" /> {r.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-800">{data?.title}</h2>
            <p className="text-xs text-gray-400">{activeReport?.desc} &middot; {data?.data?.length || 0} records</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : data?.data?.length > 0 ? (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  {Object.keys(data.data[0]).map(h => (
                    <th key={h} className="text-left p-3 font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wider">
                      {h.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-primary/[0.02] transition-colors">
                    {Object.entries(row).map(([k, v], j) => (
                      <td key={j} className="p-3 text-gray-700">
                        {k === 'status' ? <StatusBadge status={v} /> :
                         k === 'order_number' ? <span className="font-mono font-medium text-primary">{v}</span> :
                         k === 'days_overdue' ? <span className="font-semibold text-red-600">{v} days</span> :
                         k === 'amount' || k === 'total_spend' || k === 'total_value' ? <span className="font-medium">{v}</span> :
                         k === 'total_orders' || k === 'active_orders' || k === 'orders_placed' || k === 'delivered' || k === 'in_transit' ? <span className="font-semibold">{v}</span> :
                         k === 'booking_number' ? (v ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v}</span> : <span className="text-gray-300">—</span>) :
                         String(v ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <activeReport.icon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No data for this report</p>
          </div>
        )}
      </div>
    </div>
  );
}
