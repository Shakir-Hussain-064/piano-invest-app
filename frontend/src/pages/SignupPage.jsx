import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', referralCode: '' });
  const [captchaChecked, setCaptchaChecked] = useState(true);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/signup', {
        ...form,
        email: form.email.trim().toLowerCase(),
        captchaVerified: true,
      });
      login({ _id: data._id, email: data.email, name: data.name, referralCode: data.referralCode }, data.token);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Signup failed. Please try again.');
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
        <p className="text-slate-500 text-xs mt-1 font-medium">Invest in green energy & earn high daily returns</p>
      </div>

      {/* Card */}
      <div className="rounded-3xl p-6 bg-white border border-slate-200/90 shadow-xl">
        <h2 className="text-xl font-black mb-5 text-slate-900">Create Account</h2>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-rose-700 text-sm font-semibold">
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Full Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required
              placeholder="Enter your full name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
          </div>

          {/* Email */}
          <div>
            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Gmail Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              placeholder="yourname@gmail.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
          </div>

          {/* Password */}
          <div>
            <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required
                placeholder="Min 6 characters"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 pr-12 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Referral */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-600 text-xs font-bold uppercase tracking-widest">
                Referral Code
              </label>
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                🎁 Get ₹100 Free Bonus
              </span>
            </div>
            <input type="text" name="referralCode" value={form.referralCode} onChange={handleChange}
              placeholder="e.g. REFXXXXXX (optional)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm uppercase tracking-wider font-semibold shadow-sm" />
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Enter a referral code to unlock an instant ₹100 Welcome Bonus in your wallet.</p>
          </div>

          {/* CAPTCHA */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <input type="checkbox" id="captcha" checked={captchaChecked}
              onChange={(e) => setCaptchaChecked(e.target.checked)}
              className="w-5 h-5 accent-amber-500 cursor-pointer rounded" />
            <label htmlFor="captcha" className="text-slate-700 text-sm font-semibold cursor-pointer flex-1">I'm not a robot</label>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold">reCAPTCHA</p>
              <p className="text-[10px] text-slate-300">Privacy · Terms</p>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full text-white font-extrabold py-3.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Account…</>
            ) : '☀️  Create Solar Account'}
          </button>
        </form>

        <p className="text-center text-slate-500 mt-5 text-sm font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-600 font-extrabold hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
