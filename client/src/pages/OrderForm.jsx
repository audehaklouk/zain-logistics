import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { CURRENCIES, DESTINATIONS, CATEGORIES, SHIPPING_LINES, ORDER_STATUSES } from '../lib/utils';
import toast from 'react-hot-toast';

const EMPTY_CONTAINER = { type: '40ft', number: '' };

export default function OrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', country: '' });

  const [form, setForm] = useState({
    containers: [{ ...EMPTY_CONTAINER }],
    destination: '',
    destination_custom: '',
    bank: '',
    amount: '',
    currency: '',
    category: '',
    shipping_tracking_number: '',
    expected_arrival: '',
    shipping_line: '',
    shipping_line_custom: '',
    original_docs_received: false,
    status: 'pending',
    product_name: '',
    supplier_id: '',
    notes: '',
  });

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data));
    if (isEdit) {
      api.get(`/orders/${id}`).then(r => {
        const o = r.data;
        let containers = Array.isArray(o.containers) ? o.containers : [];
        if (!containers.length) containers = [{ ...EMPTY_CONTAINER }];
        setForm({
          containers,
          destination: o.destination || '',
          destination_custom: o.destination_custom || '',
          bank: o.bank || '',
          amount: o.amount != null ? String(o.amount) : '',
          currency: o.currency || '',
          category: o.category || '',
          shipping_tracking_number: o.shipping_tracking_number || '',
          expected_arrival: o.expected_arrival || '',
          shipping_line: o.shipping_line || '',
          shipping_line_custom: o.shipping_line_custom || '',
          original_docs_received: !!o.original_docs_received,
          status: o.status || 'pending',
          product_name: o.product_name || '',
          supplier_id: o.supplier_id ? String(o.supplier_id) : '',
          notes: o.notes || '',
        });
      });
    }
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Container helpers
  const addContainer = () => set('containers', [...form.containers, { ...EMPTY_CONTAINER }]);
  const removeContainer = (i) => {
    if (form.containers.length === 1) return; // keep at least one
    set('containers', form.containers.filter((_, idx) => idx !== i));
  };
  const updateContainer = (i, field, value) => {
    const next = form.containers.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
    set('containers', next);
  };

  const addSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    try {
      const res = await api.post('/suppliers', newSupplier);
      const updated = await api.get('/suppliers');
      setSuppliers(updated.data);
      set('supplier_id', String(res.data.id));
      setShowNewSupplier(false);
      setNewSupplier({ name: '', country: '' });
      toast.success('Supplier added');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add supplier'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destination) return toast.error('Destination is required');
    if (!form.category) return toast.error('Category is required');
    if (!form.containers.length) return toast.error('Add at least one container');

    setLoading(true);
    const payload = {
      ...form,
      amount: form.amount !== '' ? parseFloat(form.amount) : null,
      currency: form.currency || null,
      supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      destination_custom: form.destination === 'other' ? form.destination_custom : null,
      shipping_line_custom: form.shipping_line === 'other' ? form.shipping_line_custom : null,
    };

    try {
      if (isEdit) {
        await api.put(`/orders/${id}`, payload);
        toast.success('Order updated');
        navigate(`/orders/${id}`);
      } else {
        const res = await api.post('/orders', payload);
        toast.success(`Order ${res.data.order_number} created`);
        navigate(`/orders/${res.data.id}`);
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save order'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to={isEdit ? `/orders/${id}` : '/orders'} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Order' : 'New Order'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">

        {/* Containers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Containers *</label>
            <button
              type="button"
              onClick={addContainer}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add Container
            </button>
          </div>
          <div className="space-y-2">
            {form.containers.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={c.type}
                  onChange={e => updateContainer(i, 'type', e.target.value)}
                  className="input-field w-24 flex-shrink-0"
                >
                  <option value="40ft">40ft</option>
                  <option value="20ft">20ft</option>
                </select>
                <input
                  value={c.number}
                  onChange={e => updateContainer(i, 'number', e.target.value)}
                  className="input-field flex-1 font-mono text-sm"
                  placeholder="Container # (optional — e.g. MSCU1234567)"
                />
                <button
                  type="button"
                  onClick={() => removeContainer(i)}
                  disabled={form.containers.length === 1}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Container numbers can be left blank now and filled in later.
          </p>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
          <div className="flex gap-2">
            <select
              value={form.destination}
              onChange={e => set('destination', e.target.value)}
              className="input-field flex-1"
              required
            >
              <option value="">Select destination...</option>
              {DESTINATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            {form.destination === 'other' && (
              <input
                value={form.destination_custom}
                onChange={e => set('destination_custom', e.target.value)}
                className="input-field flex-1"
                placeholder="Specify destination..."
              />
            )}
          </div>
        </div>

        {/* Category + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field" required>
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
              {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Product + Supplier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input value={form.product_name} onChange={e => set('product_name', e.target.value)} className="input-field" placeholder="e.g. Raw Almonds (Premium)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <div className="flex gap-2">
              <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} className="input-field flex-1">
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewSupplier(v => !v)} className="btn-secondary text-sm flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {showNewSupplier && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg flex gap-2">
                <input value={newSupplier.name} onChange={e => setNewSupplier(n => ({ ...n, name: e.target.value }))} className="input-field text-sm flex-1" placeholder="Supplier name *" />
                <input value={newSupplier.country} onChange={e => setNewSupplier(n => ({ ...n, country: e.target.value }))} className="input-field text-sm w-28" placeholder="Country" />
                <button type="button" onClick={addSupplier} className="btn-primary text-sm">Add</button>
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="input-field"
              placeholder="Leave blank if not specified"
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

        {/* Bank */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input value={form.bank} onChange={e => set('bank', e.target.value)} className="input-field" placeholder="e.g. Arab Bank" />
        </div>

        {/* Shipping Line */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Line</label>
          <div className="flex gap-2">
            <select value={form.shipping_line} onChange={e => set('shipping_line', e.target.value)} className="input-field flex-1">
              <option value="">Select carrier...</option>
              {SHIPPING_LINES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {form.shipping_line === 'other' && (
              <input
                value={form.shipping_line_custom}
                onChange={e => set('shipping_line_custom', e.target.value)}
                className="input-field flex-1"
                placeholder="Carrier name (e.g. Concordia)"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Tracking Number</label>
            <input value={form.shipping_tracking_number} onChange={e => set('shipping_tracking_number', e.target.value)} className="input-field font-mono text-sm" placeholder="e.g. MAEU12345678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Arrival</label>
            <input type="date" value={form.expected_arrival} onChange={e => set('expected_arrival', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Original Docs */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox" id="original_docs"
            checked={form.original_docs_received}
            onChange={e => set('original_docs_received', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="original_docs" className="text-sm font-medium text-gray-700">
            Original documents received
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field" rows={3} placeholder="Additional notes..." />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Link to={isEdit ? `/orders/${id}` : '/orders'} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
