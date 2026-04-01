import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome to Zain Logistics!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-white to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Zain Logistics</h1>
          <p className="text-gray-500 mt-1">Order Management & Shipment Tracking</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="admin@zainlogistics.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="input-field pr-10" placeholder="Enter password" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Demo Accounts</p>
            <div className="space-y-2">
              <button onClick={() => { setEmail('admin@zainlogistics.com'); setPassword('admin123'); }} className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:border-accent/30 hover:bg-accent/5 transition-colors text-sm">
                <span className="font-medium text-gray-700">Admin</span>
                <span className="text-gray-400 ml-2">admin@zainlogistics.com</span>
              </button>
              <button onClick={() => { setEmail('team@zainlogistics.com'); setPassword('team123'); }} className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:border-accent/30 hover:bg-accent/5 transition-colors text-sm">
                <span className="font-medium text-gray-700">Team</span>
                <span className="text-gray-400 ml-2">team@zainlogistics.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
