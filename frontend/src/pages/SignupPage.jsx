import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', referralCode: '' });
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captchaChecked) { setError('Please verify the CAPTCHA'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/signup', { ...form, captchaVerified: true });
      login({ _id: data._id, email: data.email, name: data.name, referralCode: data.referralCode }, data.token);
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
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
        <p className="text-gray-400 text-xs mt-1">Play the keys to daily financial freedom</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(22,33,62,0.95)', border: '1px solid rgba(108,99,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <h2 className="text-lg font-bold mb-5 text-white">Create Account</h2>

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 mb-4 flex items-start gap-2 text-red-300 text-sm">
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest block mb-1.5">Full Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required
              placeholder="Enter your name"
              className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm" />
          </div>

          {/* Email */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest block mb-1.5">Gmail Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required
              placeholder="yourname@gmail.com"
              className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm" />
          </div>

          {/* Password */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest block mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required
                placeholder="Min 6 characters"
                className="w-full bg-dark border border-white/10 rounded-xl px-4 pr-12 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Referral */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                Referral Code
              </label>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                🎁 Get ₹100 Free Bonus
              </span>
            </div>
            <input type="text" name="referralCode" value={form.referralCode} onChange={handleChange}
              placeholder="e.g. REFXXXXXX (optional)"
              className="w-full bg-dark border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition text-sm uppercase tracking-wider" />
            <p className="text-[11px] text-gray-500 mt-1">Enter a friend's referral code to unlock an instant ₹100 Welcome Bonus in your wallet.</p>
          </div>

          {/* CAPTCHA */}
          <div className="bg-dark border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <input type="checkbox" id="captcha" checked={captchaChecked}
              onChange={(e) => setCaptchaChecked(e.target.checked)}
              className="w-5 h-5 accent-primary cursor-pointer rounded" />
            <label htmlFor="captcha" className="text-gray-300 text-sm cursor-pointer flex-1">I'm not a robot</label>
            <div className="text-right">
              <p className="text-[10px] text-gray-600">reCAPTCHA</p>
              <p className="text-[10px] text-gray-700">Privacy · Terms</p>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            style={{ background: 'linear-gradient(135deg,#6C63FF,#5a54d4)', boxShadow: '0 4px 20px rgba(108,99,255,.4)' }}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Account…</>
            ) : '🚀  Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-5 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
