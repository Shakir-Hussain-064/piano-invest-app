import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    API.get('/profile').then(res => {
      setProfile(res.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(user?.referralCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-slate-400 font-semibold">Loading solar profile...</div></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-100 via-amber-50 to-slate-50 px-5 pt-10 pb-8 text-center border-b border-amber-200/50">
        <div className="w-20 h-20 rounded-full bg-amber-500 text-white border-4 border-white shadow-lg flex items-center justify-center mx-auto mb-3 text-4xl">
          ☀️
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">{profile?.user?.name || user?.name || 'Solar Partner'}</h2>
        <p className="text-slate-500 text-sm mt-0.5 font-medium">{profile?.user?.email || user?.email}</p>
        <p className="text-slate-400 text-xs mt-1">
          Solar Partner since {new Date(profile?.user?.createdAt || Date.now()).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mx-4 -mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Wallet Balance', value: `₹${profile?.walletBalance?.toLocaleString() || 0}`, icon: '💳', color: 'text-amber-700' },
          { label: 'Total Earned',   value: `₹${profile?.totalEarned?.toLocaleString() || 0}`,   icon: '⚡', color: 'text-emerald-700' },
          { label: 'Total Invested', value: `₹${profile?.totalInvested?.toLocaleString() || 0}`, icon: '📈', color: 'text-blue-700' },
          { label: 'Active Units',   value: profile?.activePlansCount || 0,                      icon: '☀️', color: 'text-orange-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className={`font-black text-lg ${stat.color}`}>{stat.value}</p>
            <p className="text-slate-400 text-xs font-semibold">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral Code */}
      <div className="mx-4 mt-4">
        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
          <p className="text-slate-800 text-sm font-extrabold mb-2">🎁 Your Referral Code</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
              <span className="text-amber-700 font-black text-lg tracking-widest">{user?.referralCode || 'N/A'}</span>
            </div>
            <button
              onClick={copyReferral}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 transition-all"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
            <span className="text-emerald-700 text-xs font-black">🎁 ₹100 Welcome Bonus:</span>
            <span className="text-slate-500 text-[11px] font-medium">Friends who join with your code get ₹100 instantly!</span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="mx-4 mt-4 space-y-2">
        {[
          { icon: '☀️', label: 'My Solar Plans', action: () => navigate('/plans') },
          { icon: '👛', label: 'Solar Wallet', action: () => navigate('/wallet') },
          { icon: '🔔', label: 'Power Notifications', action: () => {} },
          { icon: '🛡️', label: 'Account Security', action: () => {} },
          { icon: '📞', label: 'Solar Help Support', action: () => { window.location.href = 'https://www.instagram.com/solar_wealth/'; } },
          { icon: 'ℹ️', label: 'About SolarWealth', action: () => navigate('/home') },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-4 hover:border-amber-300 shadow-sm transition-all text-left"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-slate-800 text-sm font-bold flex-1">{item.label}</span>
            <span className="text-slate-400">›</span>
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleLogout}
          className="w-full bg-rose-50 border border-rose-200 text-rose-700 font-bold py-3.5 rounded-2xl hover:bg-rose-100 shadow-sm transition-all"
        >
          🚪 Logout
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
