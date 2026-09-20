import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

// Load Razorpay SDK dynamically
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function WalletPage() {
  const { user }                            = useAuth();
  const [wallet, setWallet]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [activeTab, setActiveTab]           = useState('overview');
  const [paying, setPaying]                 = useState(false);
  const [withdrawing, setWithdrawing]       = useState(false);
  const [message, setMessage]               = useState({ text: '', type: '' });

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payMethod, setPayMethod]           = useState('upi'); // 'upi' | 'bank'
  const [upiId, setUpiId]                   = useState('');
  const [bank, setBank]                     = useState({
    accountHolder: '', accountNumber: '', ifscCode: '', bankName: '',
  });

  useEffect(() => { fetchWallet(); }, []);

  const fetchWallet = async () => {
    try {
      const { data } = await API.get('/wallet');
      setWallet(data);
      // Pre-fill saved bank details
      if (data.bankAccount?.upiId)     setUpiId(data.bankAccount.upiId);
      if (data.bankAccount?.bankName)  setBank({
        accountHolder: data.bankAccount.accountHolder || '',
        accountNumber: data.bankAccount.accountNumber || '',
        ifscCode:      data.bankAccount.ifscCode      || '',
        bankName:      data.bankAccount.bankName      || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // ── Razorpay Payment Flow ─────────────────────────────────────
  const handleRazorpayRecharge = async () => {
    const amt = Number(rechargeAmount);
    if (!amt || amt < 100) { showMsg('Minimum recharge amount is ₹100', 'error'); return; }

    setPaying(true);
    try {
      const { data: order } = await API.post('/payment/create-order', { amount: amt });
      const ok = await loadRazorpay();
      if (!ok) { showMsg('Failed to load payment gateway. Check your internet.', 'error'); return; }

      const options = {
        key:         order.keyId || import.meta.env.VITE_RAZORPAY_KEY,
        amount:      order.amount,
        currency:    order.currency,
        name:        'PianoWealth',
        description: 'Wallet Tuning & Recharge',
        order_id:    order.orderId,
        handler: async (response) => {
          try {
            const { data } = await API.post('/payment/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              amount: order.amount,
            });
            showMsg(data.message, 'success');
            setRechargeAmount('');
            fetchWallet();
          } catch (err) {
            showMsg(err.response?.data?.message || 'Payment verification failed', 'error');
          }
        },
        prefill: {
          name:  user?.name || '',
          email: user?.email || '',
        },
        theme:  { color: '#6C63FF' },
        modal:  { ondismiss: () => { showMsg('Payment cancelled by user', 'error'); setPaying(false); } },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        showMsg(response.error?.description || response.error?.reason || 'Payment failed. Please try again.', 'error');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      showMsg(err.response?.data?.message || err.message || 'Could not initiate payment', 'error');
    } finally {
      setPaying(false);
    }
  };

  // ── Withdraw ──────────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 500) { showMsg('Minimum withdrawal is ₹500', 'error'); return; }

    const bankDetails = payMethod === 'upi'
      ? { upiId }
      : { ...bank };

    setWithdrawing(true);
    try {
      const { data } = await API.post('/wallet/withdraw', { amount: amt, bankDetails });
      showMsg(data.message, 'success');
      setWithdrawAmount('');
      fetchWallet();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Withdrawal failed', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const quickAmounts = [500, 1000, 2500, 5000, 10000];
  const txIcon  = (t) => ({ credit: '💳', earning: '💰', debit: '🏦' }[t] || '💳');
  const txBg    = (t) => ({ credit: 'bg-blue-500/15', earning: 'bg-green-500/15', debit: 'bg-red-500/15' }[t]);
  const txColor = (t) => (t === 'debit' ? 'text-red-400' : 'text-green-400');

  if (loading)
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading wallet…</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-dark pb-28">

      {/* ── Hero Header ─────────────────────────────────── */}
      <div className="relative px-5 pt-12 pb-10 overflow-hidden"
           style={{ background: 'linear-gradient(135deg,#0f3460 0%,#16213e 60%,#1a1a2e 100%)' }}>
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle,#6C63FF,transparent)' }} />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle,#FF6584,transparent)' }} />

        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">My Wallet</p>
        <p className="text-5xl font-extrabold text-white mt-1">
          ₹{wallet?.balance?.toLocaleString('en-IN') || '0'}
        </p>
        <p className="text-gray-400 text-xs mt-1">Total Balance</p>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Earned',      value: wallet?.totalEarned,          color: 'text-green-400',  dot: 'bg-green-400' },
            { label: 'Withdrawable',value: wallet?.withdrawableBalance,   color: 'text-yellow-400', dot: 'bg-yellow-400' },
            { label: 'Withdrawn',   value: wallet?.totalWithdrawn,        color: 'text-red-300',    dot: 'bg-red-400' },
          ].map((s) => (
            <div key={s.label}
                 className="rounded-xl p-2.5 text-center"
                 style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot} mx-auto mb-1`} />
              <p className={`font-bold text-sm ${s.color}`}>₹{(s.value || 0).toLocaleString('en-IN')}</p>
              <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Message ─────────────────────────────────────── */}
      {message.text && (
        <div className={`mx-4 mt-4 p-3.5 rounded-xl text-sm font-medium flex items-start gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/15 border border-green-500/30 text-green-300'
            : 'bg-red-500/15 border border-red-500/30 text-red-300'
        }`}>
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="mx-4 mt-4 flex bg-card rounded-2xl p-1.5 border border-white/5 gap-1">
        {[
          { id: 'overview', label: '📊  Overview' },
          { id: 'recharge', label: '💳  Recharge' },
          { id: 'withdraw', label: '🏦  Withdraw' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="px-4 mt-5">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* info banner */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2 items-start">
              <span className="text-lg">ℹ️</span>
              <p className="text-yellow-200 text-xs leading-relaxed">
                <strong>Note:</strong> Only <span className="text-yellow-300 font-bold">earned money</span> from investment plans can be withdrawn.
                Recharged money is used to purchase plans only.
              </p>
            </div>

            <p className="text-white font-bold text-sm">Transaction History</p>
            {!wallet?.transactions?.length ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <span className="text-6xl">📭</span>
                <p className="text-gray-400">No transactions yet</p>
              </div>
            ) : (
              [...wallet.transactions].reverse().slice(0, 30).map((tx, i) => (
                <div key={i} className="bg-card rounded-xl p-3.5 border border-white/5 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${txBg(tx.type)}`}>
                    <span className="text-lg">{txIcon(tx.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(tx.date).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <p className={`font-bold text-sm flex-shrink-0 ${txColor(tx.type)}`}>
                    {tx.type === 'debit' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* RECHARGE */}
        {activeTab === 'recharge' && (
          <div className="space-y-5">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-primary font-semibold text-sm">Secure Razorpay Payment</p>
                <p className="text-gray-400 text-xs mt-0.5">Pay via UPI, Card, Net Banking. Money added instantly to invest in plans.</p>
              </div>
            </div>

            {/* quick select */}
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Quick Select</p>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amt) => (
                  <button key={amt} onClick={() => setRechargeAmount(String(amt))}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                      rechargeAmount === String(amt)
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-card border-white/10 text-gray-300 hover:border-primary/40'
                    }`}>
                    ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Custom Amount</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="Enter amount (min ₹100)"
                  className="w-full bg-card border border-white/10 rounded-xl pl-8 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-primary transition" />
              </div>
            </div>

            <button onClick={handleRazorpayRecharge} disabled={paying || !rechargeAmount}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2">
              {paying ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Opening Payment…</>
              ) : (
                <><span>⚡</span> Pay ₹{Number(rechargeAmount || 0).toLocaleString('en-IN')} via Razorpay</>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-gray-600 text-xs">
              <span>🔒</span><span>256-bit SSL secured · Powered by Razorpay</span>
            </div>
          </div>
        )}

        {/* WITHDRAW */}
        {activeTab === 'withdraw' && (
          <div className="space-y-5">
            {/* info */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-emerald-300 font-semibold text-sm">Withdrawal Rules</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  Only <strong className="text-white">earned money</strong> can be withdrawn (min ₹500).
                  Withdrawable: <span className="text-yellow-400 font-bold">₹{(wallet?.withdrawableBalance || 0).toLocaleString('en-IN')}</span>
                </p>
              </div>
            </div>

            {/* amount */}
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Amount to Withdraw</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Min ₹500"
                  className="w-full bg-card border border-white/10 rounded-xl pl-8 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 transition" />
              </div>
            </div>

            {/* payment method tabs */}
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Payment Method</p>
              <div className="flex bg-dark rounded-xl p-1 gap-1 border border-white/5">
                <button onClick={() => setPayMethod('upi')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${payMethod === 'upi' ? 'bg-primary text-white' : 'text-gray-500'}`}>
                  📱  UPI / PhonePe / GPay
                </button>
                <button onClick={() => setPayMethod('bank')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${payMethod === 'bank' ? 'bg-primary text-white' : 'text-gray-500'}`}>
                  🏦  Bank Account
                </button>
              </div>
            </div>

            {/* UPI fields */}
            {payMethod === 'upi' && (
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">UPI ID</p>
                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@upi / 9876543210@paytm"
                  className="w-full bg-card border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 transition text-sm" />
              </div>
            )}

            {/* Bank Account fields */}
            {payMethod === 'bank' && (
              <div className="space-y-3">
                {[
                  { key: 'accountHolder', label: 'Account Holder Name', placeholder: 'As per bank records' },
                  { key: 'accountNumber', label: 'Account Number',      placeholder: 'Enter account number' },
                  { key: 'ifscCode',      label: 'IFSC Code',           placeholder: 'e.g. SBIN0001234' },
                  { key: 'bankName',      label: 'Bank Name',           placeholder: 'e.g. State Bank of India' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1.5">{label}</p>
                    <input type="text" value={bank[key]} onChange={(e) => setBank({ ...bank, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-400 transition text-sm" />
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
              {withdrawing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
              ) : (
                <><span>🏦</span> Withdraw ₹{Number(withdrawAmount || 0).toLocaleString('en-IN')}</>
              )}
            </button>

            <p className="text-gray-600 text-xs text-center">Processing time: 1–3 business days</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
