import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, MapPin, Mail, Phone, Package, X } from 'lucide-react';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ company_name: '', contact_person: '', email: '', phone: '', country: '', notes: '' });

  const fetch = () => api.get('/suppliers').then(r => { setSuppliers(r.data); setLoading(false); });
  useEffect(() => { fetch(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const resetForm = () => { setForm({ company_name: '', contact_person: '', email: '', phone: '', country: '', notes: '' }); setEditing(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name) return toast.error('Company name required');
    try {
      if (editing) { await api.put(`/suppliers/${editing}`, form); toast.success('Supplier updated'); }
      else { await api.post('/suppliers', form); toast.success('Supplier added'); }
      fetch(); resetForm();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const startEdit = (s) => {
    setForm({ company_name: s.company_name, contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '', country: s.country || '', notes: s.notes || '' });
    setEditing(s.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try { await api.delete(`/suppliers/${id}`); toast.success('Deleted'); fetch(); }
    catch (e) { toast.error(e.response?.data?.error || 'Cannot delete'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Supplier</button>
      </div>

      {showForm && (
        <div className="card border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">{editing ? 'Edit Supplier' : 'New Supplier'}</h3>
            <button onClick={resetForm} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="input-field" placeholder="Company Name *" required />
            <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="input-field" placeholder="Contact Person" />
            <input value={form.email} onChange={e => set('email', e.target.value)} className="input-field" placeholder="Email" type="email" />
            <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input-field" placeholder="Phone" />
            <input value={form.country} onChange={e => set('country', e.target.value)} className="input-field" placeholder="Country" />
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field" placeholder="Notes" />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm">{editing ? 'Update' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="card hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.company_name}</h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.country}</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 mb-3">
              {s.contact_person && <p>{s.contact_person}</p>}
              {s.email && <p className="flex items-center gap-1.5 text-xs"><Mail className="w-3 h-3 text-gray-400" /> {s.email}</p>}
              {s.phone && <p className="flex items-center gap-1.5 text-xs"><Phone className="w-3 h-3 text-gray-400" /> {s.phone}</p>}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Package className="w-3.5 h-3.5" /> {s.order_count || 0} orders &middot; {formatCurrency(s.total_spend || 0)}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(s)} className="text-xs text-primary hover:underline">Edit</button>
                {isAdmin && <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:underline ml-2">Delete</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
