import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '../lib/api';
import { SHIPPING_LINES, CURRENCIES } from '../lib/utils';
import toast from 'react-hot-toast';

export default function OrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ company_name: '', country: '' });
  const [form, setForm] = useState({
    supplier_id: '', order_date: new Date().toISOString().split('T')[0], expected_delivery_date: '',
    product_name: '', quantity: '', unit_size: '', currency: 'USD', total_amount: '',
    notes: '', booking_number: '', shipping_line: '',
  });

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data));
    if (isEdit) {
      api.get(`/orders/${id}`).then(r => {
        const o = r.data;
        setForm({
          supplier_id: o.supplier_id || '', order_date: o.order_date || '',
          expected_delivery_date: o.expected_delivery_date || '', product_name: o.product_name || '',
          quantity: o.quantity || '', unit_size: o.unit_size || '', currency: o.currency || 'USD',
          total_amount: o.total_amount || '', notes: o.notes || '',
          booking_number: o.booking_number || '', shipping_line: o.shipping_line || '',
        });
      });
    }
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addSupplier = async () => {
    if (!newSupplier.company_name) return;
    const res = await api.post('/suppliers', newSupplier);
    const updated = await api.get('/suppliers');
    setSuppliers(updated.data);
    set('supplier_id', res.data.id);
    setShowNewSupplier(false);
    setNewSupplier({ company_name: '', country: '' });
    toast.success('Supplier added');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id || !form.product_name) return toast.error('Supplier and product name are required');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/orders/${id}`, form);
        toast.success('Order updated');
        navigate(`/orders/${id}`);
      } else {
        const res = await api.post('/orders', form);
        toast.success(`Order ${res.data.order_number} created`);
        navigate(`/orders/${res.data.id}`);
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to={isEdit ? `/orders/${id}` : '/orders'} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Order' : 'New Order'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Supplier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
          <div className="flex gap-2">
            <select value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} className="input-field flex-1">
              <option value="">Select supplier...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name} ({s.country})</option>)}
            </select>
            <button type="button" onClick={() => setShowNewSupplier(!showNewSupplier)} className="btn-secondary text-sm flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> New</button>
          </div>
          {showNewSupplier && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg flex gap-2">
              <input value={newSupplier.company_name} onChange={e => setNewSupplier(n => ({...n, company_name: e.target.value}))} className="input-field text-sm flex-1" placeholder="Company name" />
              <input value={newSupplier.country} onChange={e => setNewSupplier(n => ({...n, country: e.target.value}))} className="input-field text-sm w-32" placeholder="Country" />
              <button type="button" onClick={addSupplier} className="btn-primary text-sm">Add</button>
            </div>
          )}
        </div>

        {/* Product */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input value={form.product_name} onChange={e => set('product_name', e.target.value)} className="input-field" placeholder="e.g. Raw Almonds" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input-field" placeholder="500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit / Packaging</label>
            <input value={form.unit_size} onChange={e => set('unit_size', e.target.value)} className="input-field" placeholder="10kg cartons" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
            <input type="number" step="0.01" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} className="input-field" placeholder="47500.00" />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
            <input type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
            <input type="date" value={form.expected_delivery_date} onChange={e => set('expected_delivery_date', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Shipping */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking Number</label>
            <input value={form.booking_number} onChange={e => set('booking_number', e.target.value)} className="input-field font-mono" placeholder="MAEU12345678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Line</label>
            <select value={form.shipping_line} onChange={e => set('shipping_line', e.target.value)} className="input-field">
              <option value="">Select...</option>
              {SHIPPING_LINES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field" rows={3} placeholder="Additional notes..." />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link to={isEdit ? `/orders/${id}` : '/orders'} className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}</button>
        </div>
      </form>
    </div>
  );
}
