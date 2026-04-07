import { useState, useEffect, useRef } from 'react';
import { Plus, X, Edit2, Trash2, Upload, Download, FileText, ChevronDown, Check, Search } from 'lucide-react';
import api from '../lib/api';
import { formatDate, formatCurrency, CURRENCIES, CATEGORIES } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────

const CLAIM_TYPES = [
  { value: 'quality',       label: 'Quality' },
  { value: 'warehouse',     label: 'Warehouse' },
  { value: 'shipping',      label: 'Shipping' },
  { value: 'fumigation',    label: 'Fumigation' },
  { value: 'marketing',     label: 'Marketing' },
  { value: 'sales_rebate',  label: 'Sales Rebate' },
  { value: 'debit_note',    label: 'Debit Note' },
  { value: 'other',         label: 'Other' },
];

const CLAIM_STATUSES = [
  { value: 'draft',         label: 'Draft',         color: 'bg-gray-100 text-gray-600' },
  { value: 'submitted',     label: 'Submitted',     color: 'bg-blue-100 text-blue-700' },
  { value: 'under_review',  label: 'Under Review',  color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed',     label: 'Confirmed',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected',      label: 'Rejected',      color: 'bg-red-100 text-red-700' },
];

const STATUS_FLOW = ['draft', 'submitted', 'under_review', 'confirmed'];

function claimTypeLabel(v) {
  return CLAIM_TYPES.find(t => t.value === v)?.label || v || '—';
}

function statusBadge(status) {
  const s = CLAIM_STATUSES.find(x => x.value === status);
  if (!s) return <span className="text-gray-400">—</span>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>;
}

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  brand: '',
  supplier_id: '',
  claim_type: '',
  claim_type_other: '',
  reference: '',
  status: 'draft',
  amount: '',
  currency: '',
  applied: false,
};

// ── Supplier Combobox ─────────────────────────────────────────────────
function SupplierCombobox({ suppliers, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = suppliers.find(s => String(s.id) === String(value));
  const filtered = query
    ? suppliers.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : suppliers;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          className="input-field pr-8"
          placeholder="Search suppliers..."
          value={open ? query : (selected?.name || '')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => setQuery(e.target.value)}
        />
        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0
            ? <div className="px-3 py-2.5 text-sm text-gray-400">No suppliers found</div>
            : filtered.map(s => (
              <button key={s.id} type="button"
                onMouseDown={() => { onChange(String(s.id)); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${String(value) === String(s.id) ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                {s.name}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Claim Form Modal ──────────────────────────────────────────────────
function ClaimForm({ initial, suppliers, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) return toast.error('Supplier is required');
    if (!form.claim_type)  return toast.error('Claim type is required');
    if (!form.date)        return toast.error('Date is required');
    setLoading(true);
    try {
      await onSave({
        ...form,
        amount: form.amount !== '' ? parseFloat(form.amount) : null,
        currency: form.currency || null,
        supplier_id: parseInt(form.supplier_id),
        applied: form.applied ? 1 : 0,
      });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Claim' : 'New Claim'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="input-field" required />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
            <SupplierCombobox suppliers={suppliers} value={form.supplier_id} onChange={v => set('supplier_id', v)} />
          </div>

          {/* Claim Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claim Type *</label>
            <select value={form.claim_type} onChange={e => set('claim_type', e.target.value)} className="input-field" required>
              <option value="">Select type...</option>
              {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {form.claim_type === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specify Type</label>
              <input value={form.claim_type_other} onChange={e => set('claim_type_other', e.target.value)}
                className="input-field" placeholder="Describe the claim type" />
            </div>
          )}

          {/* Brand / Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select value={form.brand} onChange={e => set('brand', e.target.value)} className="input-field">
              <option value="">— None —</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)}
              className="input-field" placeholder='e.g. "FUMIGATION / DEMURRAGE", "2025 REBATE"' />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="number" step="0.01" min="0" value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="input-field" placeholder="Leave blank if unknown" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field">
                <option value="">—</option>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
              {CLAIM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Applied toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('applied', !form.applied)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.applied ? 'bg-emerald-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.applied ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-700">Applied to account</span>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : initial ? 'Update' : 'Create Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Claim Detail / Document Panel ─────────────────────────────────────
function ClaimDetail({ claim, onClose, onUpdated }) {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState(claim.documents || []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(claim.status) + 1];

  const advance = async () => {
    if (!nextStatus) return;
    try {
      await api.put(`/claims/${claim.id}`, { status: nextStatus });
      toast.success(`Moved to ${CLAIM_STATUSES.find(s => s.value === nextStatus)?.label}`);
      onUpdated();
    } catch { toast.error('Failed to update status'); }
  };

  const reject = async () => {
    try {
      await api.put(`/claims/${claim.id}`, { status: 'rejected' });
      toast.success('Claim rejected');
      onUpdated();
    } catch { toast.error('Failed'); }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) return toast.error('Only PDF, JPG, PNG allowed');
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB');

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/claims/${claim.id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments(d => [...d, { id: res.data.id, file_name: res.data.file_name }]);
      toast.success('File uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/claims/${claim.id}/documents/${docId}`);
      setDocuments(d => d.filter(x => x.id !== docId));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-0.5">{claim.dn_number}</p>
            <h2 className="text-lg font-semibold text-gray-900">{claimTypeLabel(claim.claim_type)}</h2>
            <p className="text-sm text-gray-500">{claim.supplier_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400 mb-0.5">Status</p>{statusBadge(claim.status)}</div>
            <div><p className="text-xs text-gray-400 mb-0.5">Date</p><p className="text-gray-800">{formatDate(claim.date)}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Amount</p><p className="font-medium text-gray-900">{formatCurrency(claim.amount, claim.currency)}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Applied</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${claim.applied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {claim.applied ? 'Yes' : 'No'}
              </span>
            </div>
            {claim.brand && <div><p className="text-xs text-gray-400 mb-0.5">Brand</p><p className="text-gray-700">{claim.brand}</p></div>}
            {claim.reference && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Reference</p>
                <p className="text-gray-700">{claim.reference}</p>
              </div>
            )}
          </div>

          {/* Status workflow */}
          {claim.status !== 'confirmed' && claim.status !== 'rejected' && (
            <div className="flex gap-2 pt-1">
              {nextStatus && (
                <button onClick={advance}
                  className="flex-1 btn-primary text-sm flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Move to {CLAIM_STATUSES.find(s => s.value === nextStatus)?.label}
                </button>
              )}
              <button onClick={reject}
                className="flex-1 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors font-medium">
                Reject
              </button>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Documents ({documents.length})</h3>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
              >
                {uploading
                  ? <><div className="w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" /> Uploading...</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload File</>
                }
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => handleUpload(e.target.files[0])} />
            </div>

            {documents.length === 0 ? (
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                <p className="text-sm text-gray-400">Drop a file or click to upload</p>
                <p className="text-xs text-gray-300 mt-0.5">PDF, JPG, PNG — max 10MB</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 truncate">{d.file_name}</span>
                    <a href={`/api/claims/${claim.id}/documents/${d.id}/download`}
                      className="p-1 rounded hover:bg-white text-gray-400 hover:text-primary transition-colors" title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => handleDeleteDoc(d.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Claims Page ──────────────────────────────────────────────────
export default function Claims() {
  const { isAdmin } = useAuth();
  const [claims, setClaims] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchAll = () => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.claim_type = typeFilter;

    Promise.all([
      api.get('/claims', { params }),
      api.get('/suppliers'),
    ]).then(([c, s]) => { setClaims(c.data); setSuppliers(s.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [search, statusFilter, typeFilter]);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await api.put(`/claims/${editing.id}`, data);
        toast.success('Claim updated');
      } else {
        await api.post('/claims', data);
        toast.success('Claim created');
      }
      fetchAll();
      setShowForm(false);
      setEditing(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); throw e; }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this draft claim?')) return;
    try { await api.delete(`/claims/${id}`); toast.success('Deleted'); fetchAll(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const openEdit = (c) => {
    setEditing({
      ...c,
      amount: c.amount != null ? String(c.amount) : '',
      currency: c.currency || '',
      supplier_id: String(c.supplier_id),
      applied: !!c.applied,
    });
    setShowForm(true);
  };

  const openDetail = async (c) => {
    try {
      const res = await api.get(`/claims/${c.id}`);
      setDetail(res.data);
    } catch { toast.error('Failed to load claim'); }
  };

  // Summary
  const byStatus = {};
  for (const c of claims) byStatus[c.status] = (byStatus[c.status] || 0) + 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {CLAIM_STATUSES.map(s => (
          <div key={s.value} className="card !p-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}>
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${statusFilter === s.value ? 'text-primary' : 'text-gray-900'}`}>
              {byStatus[s.value] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9" placeholder="Search by DN#, reference, supplier..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-full sm:w-40">
          <option value="">All Statuses</option>
          {CLAIM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">All Types</option>
          {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
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
                  <th className="text-left p-3 font-medium text-gray-600">DN Number</th>
                  <th className="text-left p-3 font-medium text-gray-600">Date</th>
                  <th className="text-left p-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left p-3 font-medium text-gray-600">Type</th>
                  <th className="text-left p-3 font-medium text-gray-600">Reference</th>
                  <th className="text-left p-3 font-medium text-gray-600">Amount</th>
                  <th className="text-center p-3 font-medium text-gray-600">Status</th>
                  <th className="text-center p-3 font-medium text-gray-600">Applied</th>
                  <th className="text-right p-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openDetail(c)}>
                    <td className="p-3">
                      <span className="font-mono font-semibold text-primary text-xs">{c.dn_number}</span>
                      {c.document_count > 0 && (
                        <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {c.document_count} file{c.document_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{formatDate(c.date)}</td>
                    <td className="p-3 text-gray-700 font-medium">{c.supplier_name || '—'}</td>
                    <td className="p-3 text-gray-600">{claimTypeLabel(c.claim_type)}</td>
                    <td className="p-3 text-gray-500 max-w-[160px] truncate">{c.reference || '—'}</td>
                    <td className="p-3 font-medium text-gray-900">{formatCurrency(c.amount, c.currency)}</td>
                    <td className="p-3 text-center">{statusBadge(c.status)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.applied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {c.applied ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && c.status === 'draft' && (
                          <button onClick={() => handleDelete(c.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      No claims found — click "+ New Claim" to create one
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <ClaimForm
          initial={editing}
          suppliers={suppliers}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {detail && (
        <ClaimDetail
          claim={detail}
          onClose={() => setDetail(null)}
          onUpdated={() => { fetchAll(); setDetail(null); }}
        />
      )}
    </div>
  );
}
