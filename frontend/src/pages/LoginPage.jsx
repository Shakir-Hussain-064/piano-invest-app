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
  const [success, setSuccess]  = useState('');
  const [showPass, setShowPass] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [resetForm, setResetForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const [resetLoading, setResetLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleResetChange = (e) => setResetForm({ ...resetForm, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', form);
      login({ _id: data._id, email: data.email, name: data.name, role: data.role, referralCode: data.referralCode }, data.token);
      
      // If owner logs in, redirect directly to Owner Dashboard
      if (data.role === 'admin' || data.email === 'owner@solarwealth.com') {
        navigate('/admin/withdrawals');
      } else {
        navigate('/home');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials or try again in a few seconds.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetForm.email || !resetForm.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (resetForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setResetLoading(true);
    try {
      const { data } = await API.post('/auth/reset-password', {
        email: resetForm.email.trim().toLowerCase(),
        newPassword: resetForm.newPassword,
      });
      setSuccess(data.message || 'Password reset successful! Please sign in with your new password.');
      setForm({ email: resetForm.email, password: '' });
      setShowForgot(false);
      setResetForm({ email: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password. Please verify your email.');
    } finally {
      setResetLoading(false);
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
      <div className="rounded-3xl p-6 bg-white border border-slate-200/90 shadow-xl max-w-md mx-auto w-full">
        
        {/* Success Alert */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-emerald-700 text-sm font-semibold">
            <span>✅</span><span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-rose-700 text-sm font-semibold">
            <span>❌</span><span>{error}</span>
          </div>
        )}

        {!showForgot ? (
          /* STANDARD SIGN IN FORM */
          <>
            <h2 className="text-xl font-black mb-5 text-slate-900">Sign In</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Email Address</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required
                  placeholder="yourname@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-600 text-xs font-bold uppercase tracking-widest">Password</label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setError(''); setSuccess(''); }}
                    className="text-xs text-amber-600 hover:text-amber-700 font-bold"
                  >
                    Forgot Password?
                  </button>
                </div>
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
          </>
        ) : (
          /* FORGOT / RESET PASSWORD FORM */
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900">Reset Password</h2>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setError(''); }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 bg-slate-100 rounded-lg"
              >
                ✕ Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Enter your registered email and set a new password to recover access.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Registered Email</label>
                <input
                  type="email"
                  name="email"
                  value={resetForm.email}
                  onChange={handleResetChange}
                  required
                  placeholder="yourname@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm"
                />
              </div>

              <div>
                <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={resetForm.newPassword}
                  onChange={handleResetChange}
                  required
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm"
                />
              </div>

              <div>
                <label className="text-slate-600 text-xs font-bold uppercase tracking-widest block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={resetForm.confirmPassword}
                  onChange={handleResetChange}
                  required
                  placeholder="Re-enter new password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition text-sm font-medium shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full text-white font-extrabold py-3.5 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white shadow-lg"
              >
                {resetLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating Password…</>
                ) : '🔐 Update Password'}
              </button>

              <button
                type="button"
                onClick={() => { setShowForgot(false); setError(''); }}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 mt-2 block"
              >
                ← Back to Sign In
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
