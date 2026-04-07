import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Edit2, Trash2, Check, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency, CURRENCIES } from '../lib/utils';
import toast from 'react-hot-toast';

function OrderCombobox({ orders, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = orders.find(o => String(o.id) === String(value));
  const filtered = query
    ? orders.filter(o => {
        const q = query.toLowerCase();
        return o.order_number.toLowerCase().includes(q) || (o.product_name || '').toLowerCase().includes(q);
      })
    : orders;

  const displayLabel = selected
    ? `${selected.order_number}${selected.product_name ? ` — ${selected.product_name}` : ''}`
    : '';

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          className="input-field pr-8"
          placeholder="Search orders..."
          value={open ? query : displayLabel}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => setQuery(e.target.value)}
        />
        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-gray-400">No orders found</div>
          ) : filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onMouseDown={() => { onChange(String(o.id)); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${String(value) === String(o.id) ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className="font-mono font-semibold">{o.order_number}</span>
              {o.product_name && <span className="text-gray-400 ml-1.5">— {o.product_name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  order_id: '',
  delivery_date: '',
  amount: '',
  currency: '',
  payment_date: '',
  payment_term: '',
  status: 'not_transferred',
};

function PaymentForm({ initial, orders, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.order_id) return toast.error('Order is required');
    if (!form.delivery_date) return toast.error('Delivery date is required');
    if (!form.payment_date) return toast.error('Payment date is required');
    setLoading(true);
    try {
      await onSave({
        ...form,
        amount: form.amount !== '' ? parseFloat(form.amount) : null,
        currency: form.currency || null,
        order_id: parseInt(form.order_id),
      });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Payment' : 'Add Payment'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order *</label>
            <OrderCombobox orders={orders} value={form.order_id} onChange={v => set('order_id', v)} />
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date *</label>
            <input
              type="date" value={form.delivery_date}
              onChange={e => set('delivery_date', e.target.value)}
              className="input-field" required
            />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number" step="0.01" min="0"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="input-field"
                placeholder="Leave blank if unknown"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field">
                <option value="">—</option>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Payment Date — free text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)}
              className="input-field"
              placeholder='e.g. "NET 30", "15/04/2026", "Upon delivery"'
              required
            />
            <p className="text-xs text-gray-400 mt-1">Free text — type whatever the agreed terms are</p>
          </div>

          {/* Payment Term */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Term <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={form.payment_term}
              onChange={e => set('payment_term', e.target.value)}
              className="input-field"
              placeholder='e.g. "NET 60", "COD", "LC at sight"'
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex gap-3">
              {[
                { value: 'not_transferred', label: 'Not Transferred' },
                { value: 'transferred', label: 'Transferred' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
                    form.status === opt.value
                      ? opt.value === 'transferred' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio" name="status" value={opt.value}
                    checked={form.status === opt.value}
                    onChange={() => set('status', opt.value)}
                    className="sr-only"
                  />
                  {opt.value === 'transferred' && <Check className="w-4 h-4 text-emerald-600" />}
                  <span className={`text-sm font-medium ${opt.value === 'transferred' && form.status === 'transferred' ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : initial ? 'Update' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchAll = () => {
    Promise.all([api.get('/payments'), api.get('/orders')])
      .then(([p, o]) => { setPayments(p.data); setOrders(o.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await api.put(`/payments/${editing.id}`, data);
        toast.success('Payment updated');
      } else {
        await api.post('/payments', data);
        toast.success('Payment added');
      }
      fetchAll();
      setShowForm(false);
      setEditing(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); throw e; }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment?')) return;
    try { await api.delete(`/payments/${id}`); toast.success('Deleted'); fetchAll(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const toggleStatus = async (p) => {
    const next = p.status === 'transferred' ? 'not_transferred' : 'transferred';
    try {
      await api.put(`/payments/${p.id}`, { status: next });
      fetchAll();
    } catch { toast.error('Failed to update status'); }
  };

  const openEdit = (p) => {
    setEditing({
      ...p,
      amount: p.amount != null ? String(p.amount) : '',
      currency: p.currency || '',
      order_id: String(p.order_id),
    });
    setShowForm(true);
  };

  // Summary stats
  const transferred = payments.filter(p => p.status === 'transferred').length;
  const pending = payments.length - transferred;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card !p-4">
          <p className="text-xs text-gray-400 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-400 mb-1">Not Transferred</p>
          <p className="text-2xl font-bold text-red-500">{pending}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-400 mb-1">Transferred</p>
          <p className="text-2xl font-bold text-emerald-500">{transferred}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left p-3 font-medium text-gray-600">Order</th>
                  <th className="text-left p-3 font-medium text-gray-600">Delivery Date</th>
                  <th className="text-left p-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left p-3 font-medium text-gray-600">Payment Date</th>
                  <th className="text-left p-3 font-medium text-gray-600">Term</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                  <th className="text-right p-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3">
                      <Link to={`/orders/${p.order_id}`} className="font-medium text-primary hover:underline">
                        {p.order_number}
                      </Link>
                      {p.product_name && (
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{p.product_name}</p>
                      )}
                    </td>
                    <td className="p-3 text-gray-700">{formatDate(p.delivery_date)}</td>
                    <td className="p-3 font-medium text-gray-900">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="p-3 text-gray-700">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.payment_date}</span>
                    </td>
                    <td className="p-3 text-gray-500">{p.payment_term || '—'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleStatus(p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          p.status === 'transferred'
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                        title="Click to toggle"
                      >
                        {p.status === 'transferred' ? (
                          <><Check className="w-3 h-3" /> Transferred</>
                        ) : (
                          <>Pending</>
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      No payments yet — click "+ Add Payment" to create one
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <PaymentForm
          initial={editing}
          orders={orders}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
