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

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-dark pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/50 to-dark px-5 pt-10 pb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-3">
          <span className="text-4xl">👤</span>
        </div>
        <h2 className="text-xl font-bold text-white">{profile?.user?.name || 'User'}</h2>
        <p className="text-gray-400 text-sm mt-1">{profile?.user?.email}</p>
        <p className="text-gray-500 text-xs mt-1">
          Member since {new Date(profile?.user?.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mx-4 -mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Wallet Balance', value: `₹${profile?.walletBalance?.toLocaleString() || 0}`, icon: '💳', color: 'text-primary' },
          { label: 'Total Earned', value: `₹${profile?.totalEarned?.toLocaleString() || 0}`, icon: '💰', color: 'text-green-400' },
          { label: 'Total Invested', value: `₹${profile?.totalInvested?.toLocaleString() || 0}`, icon: '📈', color: 'text-yellow-400' },
          { label: 'Active Plans', value: profile?.activePlansCount || 0, icon: '🚀', color: 'text-blue-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-accent/30">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className={`font-bold text-lg ${stat.color}`}>{stat.value}</p>
            <p className="text-gray-500 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral Code */}
      <div className="mx-4 mt-4">
        <div className="bg-card rounded-xl p-4 border border-primary/30">
          <p className="text-gray-400 text-sm mb-2">🎁 Your Referral Code</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-dark rounded-lg px-4 py-2.5 border border-accent/30">
              <span className="text-primary font-bold text-lg tracking-widest">{user?.referralCode || 'N/A'}</span>
            </div>
            <button
              onClick={copyReferral}
              className="bg-primary hover:bg-primary/80 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/5">
            <span className="text-emerald-400 text-xs font-bold">🎁 ₹100 Welcome Bonus:</span>
            <span className="text-gray-400 text-[11px]">Friends who join with your code get ₹100 instantly!</span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="mx-4 mt-4 space-y-2">
        {[
          { icon: '📋', label: 'My Investment Plans', action: () => navigate('/plans') },
          { icon: '👛', label: 'My Wallet', action: () => navigate('/wallet') },
          { icon: '🔔', label: 'Notifications', action: () => {} },
          { icon: '🛡️', label: 'Security Settings', action: () => {} },
          { icon: '📞', label: 'Customer Support', action: () => {} },
          { icon: 'ℹ️', label: 'About PianoWealth', action: () => navigate('/home') },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full bg-card border border-accent/20 rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-all text-left"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-white text-sm font-medium flex-1">{item.label}</span>
            <span className="text-gray-500">›</span>
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleLogout}
          className="w-full bg-red-500/10 border border-red-500/40 text-red-400 font-bold py-3.5 rounded-xl hover:bg-red-500/20 transition-all"
        >
          🚪 Logout
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
