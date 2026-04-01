import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Filter, Upload } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { TableSkeleton } from '../components/LoadingSkeleton';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/documents/types').then(r => setDocTypes(r.data)); }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (typeFilter) params.document_type_id = typeFilter;
    api.get('/documents', { params }).then(r => setDocuments(r.data)).finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      </div>

      <div className="card !p-4 flex gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field w-52">
          <option value="">All Document Types</option>
          {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
        </select>
        <span className="text-sm text-gray-400">{documents.length} documents</span>
      </div>

      {loading ? <TableSkeleton /> : (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left p-3 font-medium text-gray-600">Document</th>
                <th className="text-left p-3 font-medium text-gray-600">Type</th>
                <th className="text-left p-3 font-medium text-gray-600">Order</th>
                <th className="text-left p-3 font-medium text-gray-600">Uploaded By</th>
                <th className="text-left p-3 font-medium text-gray-600">Date</th>
                <th className="text-right p-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{d.original_name}</span>
                  </td>
                  <td className="p-3"><span className="badge badge-sent">{d.document_type_name}</span></td>
                  <td className="p-3"><Link to={`/orders/${d.order_id}`} className="text-primary hover:underline">{d.order_number}</Link></td>
                  <td className="p-3 text-gray-600">{d.uploaded_by_name}</td>
                  <td className="p-3 text-gray-600">{formatDate(d.created_at)}</td>
                  <td className="p-3 text-right">
                    <a href={`/api/documents/download/${d.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Download className="w-3.5 h-3.5" /> Download</a>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No documents found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
