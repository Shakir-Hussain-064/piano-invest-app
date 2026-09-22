import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import BottomNav from '../components/BottomNav';

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

  useEffect(() => {
    if (pin) {
      fetchWithdrawals(pin);
    }
  }, [pin]);

  // Polling: auto-check for new withdrawal requests every 10 seconds silently
  useEffect(() => {
    if (!pin || !isUnlocked) return;
    const interval = setInterval(() => {
      fetchWithdrawalsSilently(pin);
    }, 10000);
    return () => clearInterval(interval);
  }, [pin, isUnlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Please enter Owner PIN');
      return;
    }
    setPin(pinInput.trim());
    fetchWithdrawals(pinInput.trim());
  };

  const handleLock = () => {
    sessionStorage.removeItem('owner_pin');
    setPin('');
    setPinInput('');
    setIsUnlocked(false);
    setRequests([]);
    setNotification(null);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

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
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to approve', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

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
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to reject', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 pt-8 pb-6 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/profile')} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 text-sm">
              ← Back
            </button>
            <h1 className="text-xl font-black">Owner Panel 👑</h1>
          </div>
          {isUnlocked && (
            <div className="flex items-center gap-2">
              <button onClick={() => fetchWithdrawals(pin)} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl font-bold">
                🔄 Refresh
              </button>
              <button onClick={handleLock} className="text-xs bg-rose-600/80 hover:bg-rose-700 px-3 py-1.5 rounded-xl font-bold">
                🔒 Lock
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-amber-100 mt-2 font-medium">
          Owner Portal for processing payouts to users directly from your UPI / Bank App.
        </p>
      </div>

      {/* PIN LOCK SCREEN (If not unlocked) */}
      {!isUnlocked ? (
        <div className="mx-4 mt-8 bg-white rounded-3xl p-6 border border-amber-200 shadow-xl text-center space-y-4 max-w-sm mx-auto">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
            🔐
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Owner Access Only</h2>
            <p className="text-xs text-slate-500 mt-1">Enter your 4-digit Owner Security PIN to unlock user withdrawal requests.</p>
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

      <BottomNav />
    </div>
  );
}
