import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]        = useState({ email: '', password: '' });
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', form);
      login({ _id: data._id, email: data.email, name: data.name, referralCode: data.referralCode }, data.token);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 py-8"
         style={{ background: 'linear-gradient(160deg,#0f3460 0%,#1a1a2e 60%)' }}>

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl"
             style={{ background: 'linear-gradient(135deg,#111 0%,#24243e 100%)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 24px rgba(108,99,255,.4)' }}>
          🎹
        </div>
        <h1 className="text-2xl font-extrabold text-white">PianoWealth</h1>
        <p className="text-gray-400 text-xs mt-1">Welcome back, Maestro! Sign in to continue</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(22,33,62,0.95)', border: '1px solid rgba(108,99,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <h2 className="text-lg font-bold mb-5 text-white">Login</h2>

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4 flex items-start gap-2 text-red-300 text-sm">
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest block mb-1.5">Email Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              placeholder="yourname@gmail.com"
              className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm" />
          </div>

          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required
                placeholder="Your password"
                className="w-full bg-dark border border-white/10 rounded-xl px-4 pr-12 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            style={{ background: 'linear-gradient(135deg,#6C63FF,#5a54d4)', boxShadow: '0 4px 20px rgba(108,99,255,.4)' }}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in…</>
            ) : '🔑  Login'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-5 text-sm">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-bold hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
