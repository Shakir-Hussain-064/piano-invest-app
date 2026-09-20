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
    <div className="min-h-screen flex flex-col justify-center px-5 py-8 bg-slate-50"
         style={{ background: 'linear-gradient(180deg, #FEF3C7 0%, #FFFBEB 40%, #F8FAFC 100%)' }}>

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl shadow-xl border border-amber-200"
             style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#ea580c 100%)' }}>
          ☀️
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">SolarWealth</h1>
        <p className="text-slate-500 text-xs mt-1 font-medium">Welcome back, Solar Partner! Sign in to continue</p>
      </div>

      {/* Card */}
      <div className="rounded-3xl p-6 bg-white border border-slate-200/90 shadow-xl">
        <h2 className="text-xl font-black mb-5 text-slate-900">Sign In</h2>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-rose-700 text-sm font-semibold">
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Email Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              placeholder="yourname@gmail.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
          </div>

          <div>
            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required
                placeholder="Your password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 pr-12 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full text-white font-extrabold py-3.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in…</>
            ) : '🔑  Sign In to SolarWealth'}
          </button>
        </form>

        <p className="text-center text-slate-500 mt-5 text-sm font-medium">
          Don't have an account?{' '}
          <Link to="/signup" className="text-amber-600 font-extrabold hover:underline">Register Now</Link>
        </p>
      </div>
    </div>
  );
}
