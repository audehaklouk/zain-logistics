import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

// loginStep: null | 'password_change_required' | 'totp_required' | 'totp_setup_suggested'
export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [loginStep, setLoginStep] = useState(null);
  const [loading, setLoading]   = useState(true);

  // On mount: verify session with server
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        // Try legacy JWT from localStorage
        const saved = localStorage.getItem('zl_user');
        if (saved) {
          try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Heartbeat — keep session alive every 10 minutes
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      api.get('/auth/heartbeat').catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const saveToken = (token) => {
    if (token) localStorage.setItem('zl_token', token);
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { status, user: u, token } = res.data;

    if (status === 'password_change_required') {
      setLoginStep('password_change_required');
      return status;
    }
    if (status === 'totp_required') {
      setLoginStep('totp_required');
      return status;
    }
    if (status === 'totp_setup_suggested') {
      // Logged in but no 2FA yet — user can set up or skip
      saveToken(token);
      setUser(u);
      setLoginStep('totp_setup_suggested');
      return status;
    }
    // status === 'ok'
    saveToken(token);
    setUser(u);
    setLoginStep(null);
    return status;
  };

  const changePassword = async (newPassword) => {
    const res = await api.post('/auth/change-password', { new_password: newPassword });
    const { status, user: u, token } = res.data;
    if (status === 'totp_required') { setLoginStep('totp_required'); return status; }
    if (status === 'totp_setup_suggested') { saveToken(token); setUser(u); setLoginStep('totp_setup_suggested'); return status; }
    saveToken(token); setUser(u); setLoginStep(null);
    return status;
  };

  const verifyTotp = async (code) => {
    const res = await api.post('/auth/totp/verify', { code });
    saveToken(res.data.token);
    setUser(res.data.user);
    setLoginStep(null);
    return res.data;
  };

  const setupTotp = async () => {
    const res = await api.post('/auth/totp/setup');
    return res.data; // { secret, qr }
  };

  const confirmTotp = async (code) => {
    const res = await api.post('/auth/totp/confirm', { code });
    // Refresh user so totp_enabled is updated. Keep loginStep as
    // 'totp_setup_suggested' so the setup component stays mounted long
    // enough for the user to see & copy their backup codes — the parent
    // clears loginStep when they click "Continue to Dashboard".
    const me = await api.get('/auth/me');
    setUser(me.data);
    return res.data; // { success, backup_codes }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('zl_token');
    localStorage.removeItem('zl_user');
    setUser(null);
    setLoginStep(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, loginStep, setLoginStep,
      login, logout, changePassword, verifyTotp, setupTotp, confirmTotp,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
