import { useState, useEffect } from 'react';
import { Plus, Shield, Users as UsersIcon, Trash2, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'team' });

  const fetch = () => api.get('/auth/users').then(r => setUsers(r.data));
  useEffect(() => { fetch(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', form);
      toast.success('User created');
      fetch(); setShowForm(false);
      setForm({ email: '', password: '', display_name: '', role: 'team' });
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const changeRole = async (id, role) => {
    await api.put(`/auth/users/${id}`, { role });
    toast.success('Role updated');
    fetch();
  };

  const deleteUser = async (id) => {
    if (!confirm('Remove this user?')) return;
    try { await api.delete(`/auth/users/${id}`); toast.success('User removed'); fetch(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">New User</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.display_name} onChange={e => setForm(f => ({...f, display_name: e.target.value}))} className="input-field" placeholder="Full Name" required />
            <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input-field" placeholder="Email" type="email" required />
            <input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="input-field" placeholder="Password" type="password" required />
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="input-field">
              <option value="team">Logistics Team</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end"><button type="submit" className="btn-primary text-sm">Create User</button></div>
        </form>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="card !p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">{u.display_name[0]}</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{u.display_name}</p>
              <p className="text-xs text-gray-400">{u.email} &middot; Joined {formatDate(u.created_at)}</p>
            </div>
            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="input-field w-36 text-sm" disabled={u.id === currentUser.id}>
              <option value="admin">Admin</option>
              <option value="team">Team</option>
            </select>
            {u.id !== currentUser.id && (
              <button onClick={() => deleteUser(u.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
