import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function AdminWithdrawalsPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState(sessionStorage.getItem('owner_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!!sessionStorage.getItem('owner_pin'));
  const [pinError, setPinError] = useState('');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [copiedId, setCopiedId] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [notification, setNotification] = useState(null);

  // Users Directory & Analytics state
  const [dashboardTab, setDashboardTab] = useState('withdrawals'); // 'withdrawals' | 'starcodes' | 'users'
  const [usersData, setUsersData] = useState({ summary: {}, users: [] });
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Telegram Star Payments & Unique Codes state
  const [starData, setStarData] = useState({ summary: {}, payments: [] });
  const [starLoading, setStarLoading] = useState(false);
  const [starSearch, setStarSearch] = useState('');
  const [starFilter, setStarFilter] = useState('all'); // 'all' | 'pending' | 'verified'

  const prevPendingCountRef = useRef(null);

  // Audio chime using Web Audio API when new withdrawal request arrives
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);       // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);    // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Chime error:', e);
    }
  };

  const fetchWithdrawalsSilently = async (activePin = pin) => {
    if (!activePin) return;
    try {
      const { data } = await API.get('/wallet/admin/withdrawals', {
        headers: { 'x-admin-pin': activePin },
      });
      const newPending = data.filter(r => r.status === 'pending');
      if (prevPendingCountRef.current !== null && newPending.length > prevPendingCountRef.current) {
        playNotificationChime();
        const latest = newPending[0];
        setNotification({
          text: `🔔 New Withdrawal Initiated! ₹${latest?.amount?.toLocaleString('en-IN')} requested by ${latest?.userName || latest?.userEmail}. Transfer pending.`,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
      prevPendingCountRef.current = newPending.length;
      setRequests(data);
    } catch (err) {
      // background silent fetch
    }
  };

  const fetchWithdrawals = async (activePin = pin) => {
    if (!activePin) return;
    setLoading(true);
    try {
      const { data } = await API.get('/wallet/admin/withdrawals', {
        headers: { 'x-admin-pin': activePin },
      });
      setRequests(data);
      const pendingList = data.filter(r => r.status === 'pending');
      prevPendingCountRef.current = pendingList.length;
      setIsUnlocked(true);
      sessionStorage.setItem('owner_pin', activePin);
      setPinError('');
    } catch (err) {
      if (err.response?.status === 403) {
        setPinError('Incorrect Owner PIN. Access Denied.');
        setIsUnlocked(false);
        sessionStorage.removeItem('owner_pin');
      } else {
        setMessage({ text: err.response?.data?.message || 'Failed to load requests', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersAnalytics = async (activePin = pin) => {
    if (!activePin) return;
    setUsersLoading(true);
    try {
      const { data } = await API.get('/wallet/admin/users-analytics', {
        headers: { 'x-admin-pin': activePin },
      });
      setUsersData(data);
    } catch (err) {
      console.error('Error loading users analytics:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchStarPayments = async (activePin = pin) => {
    if (!activePin) return;
    setStarLoading(true);
    try {
      const { data } = await API.get('/wallet/admin/star-payments', {
        headers: { 'x-admin-pin': activePin },
      });
      setStarData(data);
    } catch (err) {
      console.error('Error loading star payments:', err);
    } finally {
      setStarLoading(false);
    }
  };

  useEffect(() => {
    if (pin) {
      fetchWithdrawals(pin);
      fetchUsersAnalytics(pin);
      fetchStarPayments(pin);
    }
  }, [pin]);

  // Auto-refresh disabled: Dashboard will only refresh when Owner clicks the 🔄 Refresh button
  // No automatic background polling or screen flashing

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Please enter Owner PIN');
      return;
    }
    const cleanPin = pinInput.trim();
    setPin(cleanPin);
    fetchWithdrawals(cleanPin);
    fetchUsersAnalytics(cleanPin);
    fetchStarPayments(cleanPin);
  };

  const handleLock = () => {
    sessionStorage.removeItem('owner_pin');
    setPin('');
    setPinInput('');
    setIsUnlocked(false);
    setRequests([]);
    setNotification(null);
  };

  const refreshAll = () => {
    if (!pin) return;
    setMessage({ text: '🔄 Refreshing data...', type: 'info' });
    fetchWithdrawals(pin);
    fetchUsersAnalytics(pin);
    fetchStarPayments(pin);
    setTimeout(() => setMessage({ text: '', type: '' }), 1500);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // 1. APPROVE WITHDRAWAL
  const handleApprove = async (id) => {
    const paymentRef = window.prompt(
      'Confirm amount transfer to user account:\nEnter UTR / UPI Reference No (or click OK to confirm):',
      'Amount Transferred to Account'
    );
    if (paymentRef === null) return;

    setActionLoading(id);
    try {
      const { data } = await API.post(`/wallet/admin/withdrawals/${id}/approve`, { paymentRef: paymentRef || 'Amount Transferred to Account' }, {
        headers: { 'x-admin-pin': pin },
      });
      setMessage({ text: '✅ Amount marked as Transferred to user account successfully!', type: 'success' });
      fetchWithdrawals(pin);
      fetchUsersAnalytics(pin);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to approve', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // 2. REJECT WITHDRAWAL
  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (User amount will be refunded):', 'Invalid Bank/UPI Details');
    if (!reason) return;

    setActionLoading(id);
    try {
      const { data } = await API.post(`/wallet/admin/withdrawals/${id}/reject`, { reason }, {
        headers: { 'x-admin-pin': pin },
      });
      setMessage({ text: data.message || 'Withdrawal rejected & refunded', type: 'success' });
      fetchWithdrawals(pin);
      fetchUsersAnalytics(pin);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to reject', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // 3. DELETE USER FROM DATABASE
  const handleDeleteUser = async (user) => {
    const confirmDelete = window.confirm(
      `⚠️ ARE YOU SURE?\n\nDo you want to permanently delete user "${user.name || user.email}" (${user.email}) from the database?\n\nTheir wallet, active plans, and withdrawal history will also be deleted!`
    );
    if (!confirmDelete) return;

    setActionLoading(user._id);
    try {
      const { data } = await API.delete(`/wallet/admin/users/${user._id}`, {
        headers: { 'x-admin-pin': pin },
      });
      setMessage({ text: `🗑️ ${data.message || 'User deleted successfully!'}`, type: 'success' });
      fetchUsersAnalytics(pin);
      fetchWithdrawals(pin);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to delete user', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // 4. APPROVE RECHARGE MANUALLY
  const handleApproveRechargeModal = async (targetUser) => {
    const amtStr = window.prompt(
      `Approve Recharge for ${targetUser.name || targetUser.email}:\nEnter recharge amount to credit in ₹:`,
      '500'
    );
    if (!amtStr) return;
    const amount = Number(amtStr);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const code = window.prompt('Enter Transaction / Code / UTR (optional):', 'MANUAL_APPROVAL') || 'MANUAL_APPROVAL';

    setActionLoading(targetUser._id);
    try {
      const { data } = await API.post(
        '/wallet/admin/recharge/approve',
        { userId: targetUser._id, amount, code },
        { headers: { 'x-admin-pin': pin } }
      );
      setMessage({ text: `✅ ${data.message}`, type: 'success' });
      fetchUsersAnalytics(pin);
      fetchStarPayments(pin);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to approve recharge', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // 5. APPROVE PENDING STAR CODE RECHARGE
  const handleApproveStarCode = async (starPayment) => {
    let userEmail = starPayment.redeemedByUserEmail;
    if (!userEmail) {
      userEmail = window.prompt(
        `Approve Recharge for Code ${starPayment.code} (₹${starPayment.rupeesAmount}):\nEnter User's Email to credit:`,
        starPayment.telegramUsername?.includes('@') ? starPayment.telegramUsername : ''
      );
    }
    if (!userEmail) return;

    // Find user by email from usersData or by starPayment.redeemedByUserId
    let matched = (usersData.users || []).find((u) => u.email.toLowerCase() === userEmail.trim().toLowerCase());
    if (!matched && starPayment.redeemedByUserId) {
      matched = (usersData.users || []).find((u) => u._id.toString() === starPayment.redeemedByUserId.toString());
    }

    if (!matched) {
      alert(`User with email "${userEmail}" not found in current directory. Please check email.`);
      return;
    }

    const confirmApprove = window.confirm(
      `Approve & Credit ₹${starPayment.rupeesAmount.toLocaleString('en-IN')} to user "${matched.name || matched.email}" (${matched.email}) for Code ${starPayment.code}?`
    );
    if (!confirmApprove) return;

    setActionLoading(starPayment._id);
    try {
      const { data } = await API.post(
        '/wallet/admin/recharge/approve',
        { userId: matched._id, amount: starPayment.rupeesAmount, code: starPayment.code },
        { headers: { 'x-admin-pin': pin } }
      );
      setMessage({ text: `✅ ${data.message}`, type: 'success' });
      fetchStarPayments(pin);
      fetchUsersAnalytics(pin);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to approve star recharge', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const filteredUsers = (usersData.users || []).filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.referralCode && u.referralCode.toLowerCase().includes(q)) ||
      (u.referredBy && u.referredBy.toLowerCase().includes(q))
    );
  });

  const filteredStarPayments = (starData.payments || []).filter((p) => {
    if (starFilter !== 'all' && p.status !== starFilter) return false;
    if (!starSearch.trim()) return true;
    const q = starSearch.toLowerCase();
    return (
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.telegramUsername && p.telegramUsername.toLowerCase().includes(q)) ||
      (p.telegramUserId && p.telegramUserId.toLowerCase().includes(q)) ||
      (p.redeemedByUserEmail && p.redeemedByUserEmail.toLowerCase().includes(q)) ||
      (p.planName && p.planName.toLowerCase().includes(q))
    );
  });

  const handleOwnerLogout = () => {
    sessionStorage.removeItem('owner_pin');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-16 text-slate-800 font-sans">
      {/* Executive Owner Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5 text-white shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h1 className="text-lg font-black tracking-wide text-white">SolarWealth Command Console</h1>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/30">
                  Owner Admin Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Privileged System Administration · User Directory & Financial Settlements
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={refreshAll}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3.5 py-2 rounded-xl font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <span>🔄</span> <span>Refresh</span>
              </button>
            )}
            <button
              onClick={handleOwnerLogout}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl font-black transition flex items-center gap-1 shadow-sm"
            >
              <span>🚪</span> <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* PIN LOCK SCREEN (If not unlocked) */}
      {!isUnlocked ? (
        <div className="mx-4 mt-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl text-center space-y-5 max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-md border border-slate-800">
            🔐
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Admin Authentication Required</h2>
            <p className="text-xs text-slate-500 mt-1">Enter authorized Owner Security PIN to access platform records & banking controls.</p>
          </div>

          {pinError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-2.5 rounded-xl">
              ❌ {pinError}
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter Owner PIN (Default: 7906)"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3.5 text-center text-xl font-mono tracking-widest text-slate-900 placeholder:text-xs placeholder:tracking-normal focus:outline-none focus:border-amber-500 font-bold shadow-inner"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying PIN...' : '🔓 Unlock Owner Dashboard'}
            </button>
          </form>
          <p className="text-[11px] text-slate-400">Default PIN: <strong>7906</strong></p>
        </div>
      ) : (
        /* UNLOCKED DASHBOARD */
        <>
          {/* Real-time New Withdrawal Notification Banner */}
          {notification && (
            <div className="mx-4 mt-3 bg-amber-500 text-white rounded-2xl p-4 shadow-lg flex items-start justify-between gap-3 border-2 border-amber-300">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-black text-sm">{notification.text}</p>
                  <p className="text-[10px] text-amber-100 font-semibold mt-0.5">Received at {notification.time}</p>
                </div>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-2 py-1 text-xs font-black"
              >
                ✕
              </button>
            </div>
          )}

          {/* Message Toast */}
          {message.text && (
            <div className={`mx-4 mt-3 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm ${
              message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <span>{message.text}</span>
              <button onClick={() => setMessage({ text: '', type: '' })} className="ml-2 font-black">✕</button>
            </div>
          )}

          {/* Main Dashboard Navigation Switcher */}
          <div className="mx-4 mt-3 flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm gap-1">
            <button
              onClick={() => setDashboardTab('withdrawals')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                dashboardTab === 'withdrawals'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>💸</span>
              <span>Withdrawals ({pendingCount > 0 ? `${pendingCount} P` : requests.length})</span>
            </button>
            <button
              onClick={() => {
                setDashboardTab('starcodes');
                fetchStarPayments(pin);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                dashboardTab === 'starcodes'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⭐</span>
              <span>Star Codes ({starData.summary?.totalCodes || starData.payments?.length || 0})</span>
            </button>
            <button
              onClick={() => {
                setDashboardTab('users');
                if (!usersData.users?.length) fetchUsersAnalytics(pin);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                dashboardTab === 'users'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👥</span>
              <span>Users ({usersData.summary?.totalUsers || usersData.users?.length || 0})</span>
            </button>
          </div>

          {dashboardTab === 'starcodes' ? (
            /* ── TELEGRAM STARS & UNIQUE CODES DIRECTORY ────── */
            <div className="px-4 mt-4 space-y-4">
              {/* Star Analytics Summary */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⭐</span>
                    <span className="text-amber-800 text-[10px] font-bold uppercase">Total Stars Paid</span>
                  </div>
                  <p className="text-2xl font-black text-amber-700">{(starData.summary?.totalStars || 0).toLocaleString('en-IN')} ⭐</p>
                  <p className="text-[10px] text-amber-600 font-semibold">≈ ₹{(starData.summary?.totalRupees || 0).toLocaleString('en-IN')} Value</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">✅</span>
                    <span className="text-emerald-800 text-[10px] font-bold uppercase">Redeemed to Wallet</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">₹{(starData.summary?.totalVerifiedRupees || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">{starData.summary?.verifiedCodes || 0} Codes Claimed</p>
                </div>
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🔑</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Total Codes Generated</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{starData.summary?.totalCodes || 0}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Unique One-Time Codes</p>
                </div>
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⏳</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Pending Redemption</span>
                  </div>
                  <p className="text-2xl font-black text-amber-600">{starData.summary?.pendingCodes || 0}</p>
                  <p className="text-[10px] text-amber-500 font-semibold">Awaiting User Entry</p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: `All Codes (${starData.payments?.length || 0})` },
                  { id: 'pending', label: `Pending (${starData.summary?.pendingCodes || 0})` },
                  { id: 'verified', label: `Redeemed (${starData.summary?.verifiedCodes || 0})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStarFilter(t.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                      starFilter === t.id
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={starSearch}
                  onChange={(e) => setStarSearch(e.target.value)}
                  placeholder="Search code (e.g. SW...), Telegram user, email..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* List of Star Payments */}
              {starLoading ? (
                <div className="py-16 text-center text-slate-400 font-bold">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading Telegram Star payments...
                </div>
              ) : filteredStarPayments.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
                  <span className="text-4xl block mb-2">⭐</span>
                  <p className="text-slate-800 font-bold">No star codes found</p>
                  <p className="text-slate-400 text-xs mt-1">Codes will appear here as users pay Telegram Stars in @SolarWealthPayBot</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStarPayments.map((p) => (
                    <div key={p._id} className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-3 hover:border-amber-300 transition">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 tracking-wider">
                              {p.code}
                            </span>
                            <button
                              onClick={() => handleCopy(p.code, p._id)}
                              className="text-[10px] text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-bold"
                            >
                              {copiedId === p._id ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-xs font-black text-slate-900 mt-1">{p.planName || 'Solar Recharge'}</p>
                          <p className="text-[11px] text-slate-400 font-medium">Telegram: @{p.telegramUsername || p.telegramUserId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black text-emerald-700">₹{(p.rupeesAmount || 0).toLocaleString('en-IN')}</p>
                          <span className="text-[11px] font-bold text-amber-600 block">{p.starsAmount} ⭐ Stars</span>
                          <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full mt-1 ${
                            p.status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {p.status === 'verified' ? '✓ Redeemed' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Redemption Details */}
                      <div className="text-[11px] space-y-1 text-slate-500">
                        {p.status === 'verified' ? (
                          <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100">
                            <p className="text-emerald-800 font-bold text-[11px]">
                              ✅ Credited to: {p.redeemedByUserEmail || 'User'} {p.redeemedByUserName && `(${p.redeemedByUserName})`}
                            </p>
                            <p className="text-[10px] text-emerald-600">
                              Redeemed on: {new Date(p.verifiedAt || p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div>
                              <p className="text-amber-900 font-extrabold text-xs flex items-center gap-1.5">
                                <span className="animate-pulse">🔔</span>
                                <span>Code Submitted · Waiting for Owner Approval</span>
                              </p>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                User: <strong className="text-slate-900">{p.redeemedByUserEmail || p.telegramUsername || 'Investor'}</strong>
                                {p.redeemedByUserName && ` (${p.redeemedByUserName})`}
                              </p>
                              <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                                Value: ₹{(p.rupeesAmount || 0).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <button
                              onClick={() => handleApproveStarCode(p)}
                              disabled={actionLoading === p._id}
                              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition disabled:opacity-50 whitespace-nowrap self-end sm:self-center flex items-center gap-1.5 active:scale-95"
                            >
                              <span>{actionLoading === p._id ? 'Approving...' : '✓ Approve & Credit ₹' + (p.rupeesAmount || 0)}</span>
                            </button>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                          <span>Created: {new Date(p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="font-mono text-[9px]">ID: {p.telegramPaymentId ? p.telegramPaymentId.slice(-8) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : dashboardTab === 'users' ? (
            /* ── USERS DIRECTORY & RECHARGE ANALYTICS ──────── */
            <div className="px-4 mt-4 space-y-4">
              {/* Analytics Summary Banner */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">👥</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Total Users</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{usersData.summary?.totalUsers || 0}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Registered Investors</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">💳</span>
                    <span className="text-emerald-800 text-[10px] font-bold uppercase">Total Recharged</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">₹{(usersData.summary?.totalRecharged || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Deposited Capital</p>
                </div>
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">👛</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Total Balances</span>
                  </div>
                  <p className="text-lg font-black text-amber-700">₹{(usersData.summary?.totalBalance || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">In User Wallets</p>
                </div>
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">☀️</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Active Units</span>
                  </div>
                  <p className="text-lg font-black text-orange-700">{usersData.summary?.totalActivePlans || 0}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Generating Daily Yield</p>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or referral code..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs font-semibold shadow-sm"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                    ✕
                  </button>
                )}
              </div>

              {/* Users List */}
              {usersLoading ? (
                <div className="py-16 text-center text-slate-400 font-bold">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading users analytics...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6">
                  <span className="text-4xl block mb-2">👤</span>
                  <p className="text-slate-800 font-bold">No users match search</p>
                  <p className="text-slate-400 text-xs mt-1">Try another search term</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u._id} className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                      {/* User Header */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm border border-amber-200 shadow-sm">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-slate-900 font-extrabold text-sm">{u.name}</h3>
                              {u.role === 'admin' && (
                                <span className="bg-rose-100 text-rose-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                                  Owner
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs font-mono select-all">{u.email}</p>
                          </div>
                        </div>
                        {/* Recharged Amount Badge */}
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Recharged</span>
                          <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-block">
                            ₹{u.rechargedAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Wallet Breakdown Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-2xl p-2.5 border border-slate-200/60 text-center">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Balance</p>
                          <p className="text-xs font-black text-slate-900">₹{u.balance.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Earned</p>
                          <p className="text-xs font-black text-emerald-600">₹{u.totalEarned.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Withdrawn</p>
                          <p className="text-xs font-black text-slate-600">₹{u.totalWithdrawn.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      {/* Activity & Referral Footer */}
                      <div className="space-y-1 pt-1 text-[11px] text-slate-500">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">📅 Registered:</span>
                          <span className="font-semibold text-slate-700">
                            {new Date(u.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">🕒 Last Login / Activity:</span>
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            {new Date(u.lastLogin).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-[10px]">
                          <span className="text-slate-400">Referral Code: <strong className="text-amber-700 font-mono">{u.referralCode}</strong></span>
                          {u.referredBy && <span className="text-slate-400">Referred By: <strong className="text-slate-700 font-mono">{u.referredBy}</strong></span>}
                        </div>

                        {/* Owner Actions for User: Approve Recharge & Delete User */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveRechargeModal(u)}
                            disabled={actionLoading === u._id}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black px-3 py-1.5 rounded-xl transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          >
                            <span>💳</span>
                            <span>Approve Recharge</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={actionLoading === u._id || u.role === 'admin'}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black px-3 py-1.5 rounded-xl transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          >
                            <span>🗑️</span>
                            <span>Delete User</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── WITHDRAWALS TAB ───────────────────────────── */
            <>
              {/* Filter Tabs */}
              <div className="flex px-4 mt-4 gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: `All (${requests.length})` },
                  { id: 'pending', label: `Pending (${pendingCount})`, badge: pendingCount > 0 },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFilter(t.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      filter === t.id
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="px-4 mt-4 space-y-3">
                {loading ? (
                  <div className="py-16 text-center text-slate-400 font-bold">
                    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading withdrawal requests...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6">
                    <span className="text-4xl block mb-2">🎉</span>
                    <p className="text-slate-800 font-bold">No {filter !== 'all' ? filter : ''} requests</p>
                    <p className="text-slate-400 text-xs mt-1">All user payouts are up to date!</p>
                  </div>
                ) : (
                  filtered.map((req) => (
                    <div key={req._id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
                      {/* Top Row: User and Amount */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-900 font-black text-sm">{req.userName || 'User'}</p>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              req.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {req.status === 'pending' ? '⏳ Pending' : req.status === 'approved' ? '✅ Transferred' : '❌ Refunded'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs font-mono">{req.userEmail}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">
                            {new Date(req.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-emerald-600">₹{req.amount.toLocaleString('en-IN')}</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{req.method === 'upi' ? '⚡ UPI Transfer' : '🏦 Bank Transfer'}</span>
                        </div>
                      </div>

                      {/* Payment Destination Details (UPI or Bank) */}
                      {req.method === 'upi' ? (
                        <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-200/70 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Send to UPI ID:</span>
                            <span className="text-slate-900 font-mono font-black text-sm select-all">{req.upiId}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(req.upiId, req._id + '_upi')}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-1.5 rounded-xl transition text-xs shadow-sm"
                          >
                            {copiedId === req._id + '_upi' ? '✓ Copied' : '📋 Copy UPI'}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">A/C Holder:</span>
                            <span className="text-slate-900 font-bold">{req.bankAccount?.accountHolder}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Bank Name:</span>
                            <span className="text-slate-900 font-bold">{req.bankAccount?.bankName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Account No:</span>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                              <span>{req.bankAccount?.accountNumber}</span>
                              <button
                                onClick={() => handleCopy(req.bankAccount?.accountNumber, req._id + '_acc')}
                                className="text-[10px] bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-700"
                              >
                                {copiedId === req._id + '_acc' ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">IFSC Code:</span>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                              <span>{req.bankAccount?.ifscCode}</span>
                              <button
                                onClick={() => handleCopy(req.bankAccount?.ifscCode, req._id + '_ifsc')}
                                className="text-[10px] bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded text-slate-700"
                              >
                                {copiedId === req._id + '_ifsc' ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status info if already processed */}
                      {req.status === 'approved' && (
                        <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-semibold flex items-center gap-1.5">
                          <span>✅</span>
                          <span><strong>Status: Transferred to Account</strong> · {req.paymentRef || 'Amount Transferred'} ({req.processedAt ? new Date(req.processedAt).toLocaleDateString('en-IN') : ''})</span>
                        </p>
                      )}
                      {req.status === 'rejected' && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200 font-medium">
                          ✕ Rejected & Refunded: {req.adminNote || 'Cancelled by Admin'}
                        </p>
                      )}

                      {/* Action Buttons (Only for Pending requests) */}
                      {req.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleApprove(req._id)}
                            disabled={actionLoading === req._id}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {actionLoading === req._id ? 'Processing...' : '💸 Mark as Transferred to Account'}
                          </button>
                          <button
                            onClick={() => handleReject(req._id)}
                            disabled={actionLoading === req._id}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-3 px-4 rounded-xl transition text-xs disabled:opacity-50"
                          >
                            ✕ Reject & Refund
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
