import { useState, useEffect } from 'react';
import { Monitor, History, RefreshCw, Trash2, Shield } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

// ── Active Sessions ───────────────────────────────────────────────────
function SessionsTab() {
  const { user: me } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    api.get('/admin/sessions')
      .then(r => setSessions(r.data))
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const forceLogout = async (id) => {
    if (!confirm('Force-logout this session?')) return;
    try {
      await api.delete(`/admin/sessions/${id}`);
      toast.success('Session terminated');
      fetch();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</p>
        <button onClick={fetch} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No active sessions</div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => {
            const isMine = s.user_id === me?.id;
            return (
              <div key={s.id} className={`card !p-4 flex items-start gap-3 ${isMine ? 'border-primary/20 bg-primary/[0.02]' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{s.display_name?.[0] || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm">{s.display_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.role}
                    </span>
                    {isMine && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
                  </div>
                  <p className="text-xs text-gray-400">{s.email}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>IP: {s.ip_address || 'unknown'}</span>
                    <span>Active: {formatDate(s.last_active)}</span>
                    <span>Since: {formatDate(s.created_at)}</span>
                  </div>
                  {s.user_agent && (
                    <p className="text-[10px] text-gray-300 mt-0.5 truncate">{s.user_agent}</p>
                  )}
                </div>
                {!isMine && (
                  <button onClick={() => forceLogout(s.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Force logout">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Login History ─────────────────────────────────────────────────────
function LoginHistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/login-history', { params: { limit: 100 } })
      .then(r => setHistory(r.data))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Last 100 login attempts</p>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left p-3 font-medium text-gray-600">Time</th>
                  <th className="text-left p-3 font-medium text-gray-600">User</th>
                  <th className="text-left p-3 font-medium text-gray-600">IP</th>
                  <th className="text-center p-3 font-medium text-gray-600">Result</th>
                  <th className="text-left p-3 font-medium text-gray-600">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className={`border-b border-gray-50 ${!h.success ? 'bg-red-50/30' : ''}`}>
                    <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(h.timestamp)}</td>
                    <td className="p-3">
                      <p className="font-medium text-gray-800 text-xs">{h.display_name || h.email}</p>
                      {h.display_name && <p className="text-xs text-gray-400">{h.email}</p>}
                    </td>
                    <td className="p-3 text-gray-500 text-xs font-mono">{h.ip_address || '—'}</td>
                    <td className="p-3 text-center">
                      {h.success
                        ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Success" />
                        : <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Failed" />
                      }
                    </td>
                    <td className="p-3 text-xs text-gray-400">{h.failure_reason || '—'}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No login history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState('sessions');

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Sessions and security overview</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'sessions', icon: Monitor, label: 'Active Sessions' },
          { key: 'history',  icon: History, label: 'Login History' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'sessions' && <SessionsTab />}
      {tab === 'history'  && <LoginHistoryTab />}
    </div>
  );
}
