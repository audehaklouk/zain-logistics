import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ArrowUpDown } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency, STATUS_FLOW } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { sort_by: sortBy, sort_dir: sortDir };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (supplierFilter) params.supplier_id = supplierFilter;
    api.get('/orders', { params }).then(r => setOrders(r.data)).finally(() => setLoading(false));
  }, [search, statusFilter, supplierFilter, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <Link to="/orders/new" className="btn-primary text-sm flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="card !p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Search orders, products, suppliers..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">All Statuses</option>
          {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="input-field w-full sm:w-48">
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton rows={5} /> : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('date')}>
                    Order # <ArrowUpDown className="w-3 h-3 inline ml-1" />
                  </th>
                  <th className="text-left p-3 font-medium text-gray-600">Product</th>
                  <th className="text-left p-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('status')}>Status</th>
                  <th className="text-left p-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('delivery')}>Expected Delivery</th>
                  <th className="text-right p-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('amount')}>Amount</th>
                  <th className="text-center p-3 font-medium text-gray-600">Docs</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3">
                      <Link to={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.order_number}</Link>
                      <p className="text-xs text-gray-400">{formatDate(o.order_date)}</p>
                    </td>
                    <td className="p-3 text-gray-700 max-w-[200px] truncate">{o.product_name}</td>
                    <td className="p-3 text-gray-600">{o.supplier_name}</td>
                    <td className="p-3"><StatusBadge status={o.status} /></td>
                    <td className="p-3 text-gray-600">{formatDate(o.expected_delivery_date)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(o.total_amount, o.currency)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-medium ${o.document_count > 0 ? 'text-green-600' : 'text-gray-400'}`}>{o.document_count}</span>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
