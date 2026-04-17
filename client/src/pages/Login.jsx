import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, KeyRound, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Step: credentials ─────────────────────────────────────────────────
function CredentialsStep({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const submit = async (emailArg, passwordArg) => {
    setLoading(true);
    try {
      const status = await login(emailArg, passwordArg);
      onDone(status);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(email, password);
  };

  const handleDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    submit(acc.email, acc.password);
  };

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in</h2>
      <p className="text-sm text-gray-500 mb-6">Al-Zanbaka Logistics Portal</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="input-field" placeholder="you@alzanbaka.com" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              className="input-field pr-10" placeholder="Enter password" required />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center mb-3">Demo Accounts</p>
        <div className="space-y-2">
          {[
            { label: 'Admin', email: 'admin@zainlogistics.com', password: 'admin123' },
            { label: 'Team', email: 'team@zainlogistics.com', password: 'team123' },
          ].map(acc => (
            <button key={acc.email} type="button" disabled={loading}
              onClick={() => handleDemo(acc)}
              className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-colors text-sm disabled:opacity-50">
              <span className="font-medium text-gray-700">{acc.label}</span>
              <span className="text-gray-400 ml-2">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Step: change password ─────────────────────────────────────────────
function ChangePasswordStep({ onDone }) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { changePassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pass.length < 8) return toast.error('Password must be at least 8 characters');
    if (pass !== confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const status = await changePassword(pass);
      onDone(status);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Change your password</h2>
          <p className="text-xs text-gray-500">You must set a new password before continuing</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            className="input-field" placeholder="At least 8 characters" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="input-field" placeholder="Repeat new password" required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Saving…' : 'Set New Password'}
        </button>
      </form>
    </>
  );
}

// ── Step: verify TOTP ─────────────────────────────────────────────────
function TotpVerifyStep({ onDone }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyTotp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyTotp(code);
      onDone('ok');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Two-factor authentication</h2>
          <p className="text-xs text-gray-500">Enter the code from your authenticator app</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">6-digit code</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-field text-center text-2xl tracking-widest font-mono"
            placeholder="000000"
            maxLength={6}
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">You can also enter a backup code.</p>
        </div>
        <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full py-2.5">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </>
  );
}

// ── Step: TOTP setup (suggested, not forced) ──────────────────────────
function TotpSetupStep({ onSkip, onDone }) {
  const [phase, setPhase] = useState('intro'); // intro | qr | backup
  const [qr, setQr]       = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode]   = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { setupTotp, confirmTotp } = useAuth();

  const startSetup = async () => {
    setLoading(true);
    try {
      const data = await setupTotp();
      setQr(data.qr); setSecret(data.secret);
      setPhase('qr');
    } catch { toast.error('Failed to generate QR code'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await confirmTotp(code);
      setBackupCodes(data.backup_codes);
      setPhase('backup');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (phase === 'backup') return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">2FA enabled!</h2>
          <p className="text-xs text-gray-500">Save these backup codes in a safe place</p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm grid grid-cols-2 gap-1 mb-3">
        {backupCodes.map((c, i) => <span key={i} className="text-gray-700">{c}</span>)}
      </div>
      <button onClick={copyBackupCodes} className="w-full flex items-center justify-center gap-2 btn-secondary text-sm mb-4">
        {copied ? <><Check className="w-4 h-4 text-emerald-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy all codes</>}
      </button>
      <p className="text-xs text-gray-400 mb-4">These codes are shown <strong>once</strong>. Each code can only be used one time.</p>
      <button onClick={onDone} className="btn-primary w-full py-2.5">Continue to Dashboard</button>
    </>
  );

  if (phase === 'qr') return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Set up 2FA</h2>
      <p className="text-xs text-gray-500 mb-4">Scan this QR with Google Authenticator, Authy, or similar</p>
      <div className="flex justify-center mb-4">
        <img src={qr} alt="QR Code" className="w-48 h-48 rounded-lg border border-gray-200" />
      </div>
      <p className="text-xs text-gray-400 text-center mb-1">Or enter this key manually:</p>
      <p className="font-mono text-xs text-center bg-gray-100 rounded px-3 py-2 break-all mb-4">{secret}</p>
      <form onSubmit={handleConfirm} className="space-y-3">
        <input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input-field text-center text-xl tracking-widest font-mono"
          placeholder="Enter 6-digit code to verify"
          maxLength={6} autoFocus
        />
        <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full py-2.5">
          {loading ? 'Verifying…' : 'Enable 2FA'}
        </button>
      </form>
    </>
  );

  // intro
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Secure your account</h2>
          <p className="text-xs text-gray-500">We recommend enabling two-factor authentication</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        2FA protects your account with an extra verification step. You'll need an authenticator app like Google Authenticator or Authy.
      </p>
      <button onClick={startSetup} disabled={loading} className="btn-primary w-full py-2.5 mb-3">
        {loading ? 'Loading…' : 'Set Up 2FA'}
      </button>
      <button onClick={onSkip} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">
        Skip for now
      </button>
    </>
  );
}

// ── Main Login page ───────────────────────────────────────────────────
export default function Login() {
  const { loginStep, setLoginStep } = useAuth();
  const navigate = useNavigate();

  const handleDone = (status) => {
    if (status === 'password_change_required') return; // AuthContext set loginStep
    if (status === 'totp_required') return;
    if (status === 'totp_setup_suggested') return;
    toast.success('Welcome back!');
    navigate('/');
  };

  const step = loginStep;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-white to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Al-Zanbaka" className="h-40 w-auto drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Al-Zanbaka</h1>
          <p className="text-sm text-gray-500 mt-1">Order Management & Shipment Tracking</p>
        </div>

        {/* Step indicator */}
        {step && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {['credentials', 'password_change_required', 'totp_required', 'totp_setup_suggested'].map((s, i) => (
              <span key={i} className={`w-2 h-2 rounded-full transition-colors ${
                (step === s || (!step && s === 'credentials')) ? 'bg-primary' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        )}

        <div className="card">
          {!step && <CredentialsStep onDone={handleDone} />}
          {step === 'password_change_required' && <ChangePasswordStep onDone={handleDone} />}
          {step === 'totp_required' && <TotpVerifyStep onDone={handleDone} />}
          {step === 'totp_setup_suggested' && (
            <TotpSetupStep
              onSkip={() => { setLoginStep(null); navigate('/'); }}
              onDone={() => { setLoginStep(null); navigate('/'); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
