import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FolderOpen, FileText, Upload, Download, Trash2, Search, ArrowLeft, X, Plus } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── Supplier Folder Grid ────────────────────────────────────────────
function FolderGrid({ onSelect }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/suppliers').then(r => { setSuppliers(r.data); setLoading(false); });
  }, []);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
          placeholder="Search suppliers..."
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className="card text-left hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                  <FolderOpen className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{s.name}</h3>
                  <p className="text-xs text-gray-400">{s.country || 'No country'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {s.document_count || 0} document{s.document_count !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-12">
              {search ? `No suppliers matching "${search}"` : 'No suppliers yet'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Invoice Upload Modal ────────────────────────────────────────────
function UploadModal({ supplierId, onClose, onUploaded }) {
  const [orders, setOrders] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get(`/orders?supplier_id=${supplierId}`).then(r => setOrders(r.data)).catch(() => {});
  }, [supplierId]);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(f.type)) return toast.error('Only PDF, JPG, PNG files are allowed');
    if (f.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB');
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) return toast.error('Invoice number is required');
    if (!file) return toast.error('Please select a file');

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('supplier_id', supplierId);
    fd.append('invoice_number', invoiceNumber.trim());
    if (orderId) fd.append('order_id', orderId);

    try {
      await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document uploaded');
      onUploaded();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Upload Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number *</label>
            <input
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="input-field font-mono"
              placeholder="e.g. INV-2026-001"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to Order <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select value={orderId} onChange={e => setOrderId(e.target.value)} className="input-field">
              <option value="">— Not linked to an order —</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.order_number} — {o.product_name || 'No product'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'} ${file ? 'bg-green-50 border-green-300' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
              {file ? (
                <div>
                  <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-green-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drop file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG — max 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Supplier Document View ──────────────────────────────────────────
function SupplierDocuments({ supplier, onBack }) {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');

  const fetchDocs = () => {
    api.get(`/documents?supplier_id=${supplier.id}`)
      .then(r => { setDocuments(r.data); setLoading(false); });
  };

  useEffect(() => { fetchDocs(); }, [supplier.id]);

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${docId}`); toast.success('Deleted'); fetchDocs(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  const filtered = documents.filter(d =>
    d.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    d.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
          <p className="text-sm text-gray-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
          placeholder="Search by invoice number or filename..."
        />
      </div>

      {/* Documents table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left p-3 font-medium text-gray-600">Invoice Number</th>
                <th className="text-left p-3 font-medium text-gray-600">File</th>
                <th className="text-left p-3 font-medium text-gray-600">Linked Order</th>
                <th className="text-left p-3 font-medium text-gray-600">Upload Date</th>
                <th className="text-right p-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3">
                    <span className="font-mono text-sm font-medium text-gray-900">{d.invoice_number}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate max-w-[180px]">{d.file_name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-500">
                    {d.order_number
                      ? <Link to={`/orders/${d.order_id}`} className="text-primary hover:underline">{d.order_number}</Link>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="p-3 text-gray-500">{formatDate(d.created_at)}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/documents/${d.id}/download`}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    {search
                      ? `No documents matching "${search}"`
                      : 'No documents yet — click "Create Invoice" to upload one'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          supplierId={supplier.id}
          onClose={() => setShowUpload(false)}
          onUploaded={fetchDocs}
        />
      )}
    </div>
  );
}

// ── Main Documents Page ─────────────────────────────────────────────
export default function Documents() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Handle direct URL navigation to /documents/supplier/:id
  useEffect(() => {
    if (supplierId && !selectedSupplier) {
      api.get(`/suppliers/${supplierId}`).then(r => setSelectedSupplier(r.data)).catch(() => {});
    }
  }, [supplierId]);

  const handleSelect = (supplier) => {
    setSelectedSupplier(supplier);
    navigate(`/documents/supplier/${supplier.id}`);
  };

  const handleBack = () => {
    setSelectedSupplier(null);
    navigate('/documents');
  };

  if (selectedSupplier) {
    return <SupplierDocuments supplier={selectedSupplier} onBack={handleBack} />;
  }

  return <FolderGrid onSelect={handleSelect} />;
}
