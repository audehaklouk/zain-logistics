import { useState, useEffect } from 'react';
import { Plus, Shield, ShieldOff, KeyRound, Trash2, X, Check } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'team' });

  const fetch = () => api.get('/auth/users').then(r => setUsers(r.data));
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', form);
      toast.success('User created — they must change password on first login');
      fetch(); setShowForm(false);
      setForm({ email: '', password: '', display_name: '', role: 'team' });
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const changeRole = async (id, role) => {
    await api.put(`/auth/users/${id}`, { role });
    toast.success('Role updated'); fetch();
  };

  const toggleActive = async (u) => {
    await api.put(`/auth/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
    toast.success(u.is_active ? 'User deactivated' : 'User activated'); fetch();
  };

  const resetPassword = async (id) => {
    if (!confirm('Force this user to change their password on next login?')) return;
    await api.post(`/auth/users/${id}/reset-password`);
    toast.success('Password reset flagged'); fetch();
  };

  const reset2fa = async (id) => {
    if (!confirm('Disable this user\'s 2FA? They will need to set it up again.')) return;
    await api.post(`/auth/users/${id}/reset-2fa`);
    toast.success('2FA disabled'); fetch();
  };

  const deleteUser = async (id) => {
    if (!confirm('Permanently remove this user?')) return;
    try { await api.delete(`/auth/users/${id}`); toast.success('User removed'); fetch(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">New User</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              className="input-field" placeholder="Full Name" required />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="input-field" placeholder="Email" type="email" required />
            <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="input-field" placeholder="Temporary password (min 8 chars)" type="password" required minLength={8} />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-field">
              <option value="team">Logistics Team</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">The user will be forced to change this password on first login.</p>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary text-sm">Create User</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`card !p-4 flex items-center gap-4 transition-opacity ${!u.is_active ? 'opacity-60' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${u.is_active ? 'bg-primary/10' : 'bg-gray-100'}`}>
              <span className={`text-sm font-semibold ${u.is_active ? 'text-primary' : 'text-gray-400'}`}>
                {u.display_name?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900">{u.display_name}</p>
                {!u.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactive</span>}
                {u.must_change_password ? <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Must change pw</span> : null}
                {u.totp_enabled ? <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> 2FA</span> : null}
              </div>
              <p className="text-xs text-gray-400 truncate">{u.email} · Joined {formatDate(u.created_at)}</p>
              {u.last_login && <p className="text-xs text-gray-300">Last login: {formatDate(u.last_login)}</p>}
            </div>

            {/* Role selector */}
            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
              className="input-field w-32 text-sm flex-shrink-0" disabled={u.id === me?.id}>
              <option value="admin">Admin</option>
              <option value="team">Team</option>
            </select>

            {/* Action buttons */}
            {u.id !== me?.id && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(u)}
                  title={u.is_active ? 'Deactivate' : 'Activate'}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  {u.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => resetPassword(u.id)}
                  title="Force password reset"
                  className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                {u.totp_enabled && (
                  <button onClick={() => reset2fa(u.id)}
                    title="Disable 2FA"
                    className="p-1.5 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors">
                    <ShieldOff className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteUser(u.id)}
                  title="Delete user"
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
