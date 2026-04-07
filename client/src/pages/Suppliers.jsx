import { useState, useEffect, useCallback } from 'react';
import { Plus, Building2, MapPin, Mail, Phone, Package, X, Search } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', contact_name: '', contact_email: '', contact_phone: '', country: '', notes: '' };

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchSuppliers = useCallback((q = '') => {
    const params = q ? { search: q } : {};
    api.get('/suppliers', { params }).then(r => { setSuppliers(r.data); setLoading(false); });
  }, []);

  // Initial load
  useEffect(() => { fetchSuppliers(); }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchSuppliers(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Supplier name is required');
    try {
      if (editing) {
        await api.put(`/suppliers/${editing}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier added');
      }
      fetchSuppliers(search);
      resetForm();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const startEdit = (s) => {
    setForm({
      name: s.name || '',
      contact_name: s.contact_name || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      country: s.country || '',
      notes: s.notes || '',
    });
    setEditing(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try { await api.delete(`/suppliers/${id}`); toast.success('Deleted'); fetchSuppliers(search); }
    catch (e) { toast.error(e.response?.data?.error || 'Cannot delete supplier with orders'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
          placeholder="Search suppliers by name..."
        />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">{editing ? 'Edit Supplier' : 'New Supplier'}</h3>
            <button onClick={resetForm} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field" placeholder="Supplier Name *" required />
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-field" placeholder="Contact Person" />
            <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className="input-field" placeholder="Email" type="email" />
            <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-field" placeholder="Phone" />
            <input value={form.country} onChange={e => set('country', e.target.value)} className="input-field" placeholder="Country" />
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input-field" placeholder="Notes" />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm">{editing ? 'Update' : 'Add Supplier'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {search && (
            <p className="text-sm text-gray-500">
              {suppliers.length} result{suppliers.length !== 1 ? 's' : ''} for "{search}"
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="card hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{s.name}</h3>
                      {s.country && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {s.country}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                  {s.contact_name && <p>{s.contact_name}</p>}
                  {s.contact_email && (
                    <p className="flex items-center gap-1.5 text-xs">
                      <Mail className="w-3 h-3 text-gray-400" /> {s.contact_email}
                    </p>
                  )}
                  {s.contact_phone && (
                    <p className="flex items-center gap-1.5 text-xs">
                      <Phone className="w-3 h-3 text-gray-400" /> {s.contact_phone}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Package className="w-3.5 h-3.5" />
                    {s.order_count || 0} orders &middot; {s.document_count || 0} docs
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(s)} className="text-xs text-primary hover:underline">Edit</button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 text-center text-gray-400 py-12">
                {search ? `No suppliers matching "${search}"` : 'No suppliers yet'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
