import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';

export default function WalletPage() {
  const { user }                            = useAuth();
  const [wallet, setWallet]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [activeTab, setActiveTab]           = useState('overview');
  const [paying, setPaying]                 = useState(false);
  const [withdrawing, setWithdrawing]       = useState(false);
  const [message, setMessage]               = useState({ text: '', type: '' });

  // Dynamic UPI Payment state
  const [activeOrder, setActiveOrder]       = useState(null);
  const [utrInput, setUtrInput]             = useState('');
  const [submittingUtr, setSubmittingUtr]   = useState(false);

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payMethod, setPayMethod]           = useState('upi'); // 'upi' | 'bank'
  const [upiId, setUpiId]                   = useState('');
  const [myWithdrawals, setMyWithdrawals]   = useState([]);
  const [bank, setBank]                     = useState({
    accountHolder: '', accountNumber: '', ifscCode: '', bankName: '',
  });

  useEffect(() => {
    fetchWallet();
    // Auto-poll wallet & withdrawal requests every 10 seconds so status updates live
    const interval = setInterval(() => {
      fetchWallet();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchWallet = async () => {
    try {
      const { data } = await API.get('/wallet');
      setWallet(data);
      if (data.bankAccount?.upiId)     setUpiId(data.bankAccount.upiId);
      if (data.bankAccount?.bankName)  setBank({
        accountHolder: data.bankAccount.accountHolder || '',
        accountNumber: data.bankAccount.accountNumber || '',
        ifscCode:      data.bankAccount.ifscCode      || '',
        bankName:      data.bankAccount.bankName      || '',
      });

      // Fetch user's own withdrawal requests
      const wRes = await API.get('/wallet/my-withdrawals');
      setMyWithdrawals(wRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 6000);
  };

  // ── Step 1: Generate Dynamic UPI QR & Intent ──────────────────
  const handleGenerateUpi = async () => {
    const amt = Number(rechargeAmount);
    if (!amt || amt < 500) { showMsg('Minimum recharge amount is ₹500', 'error'); return; }

    setPaying(true);
    try {
      const { data } = await API.post('/payment/create-order', { amount: amt });
      setActiveOrder(data);
      setUtrInput('');
      showMsg(`Dynamic Solar UPI QR generated for ₹${amt}. Pay & enter 12-digit UTR below.`, 'success');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Could not generate UPI QR', 'error');
    } finally {
      setPaying(false);
    }
  };

  // ── Step 2: Submit 12-digit UTR / Reference ID ────────────────
  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    const clean = utrInput.trim().replace(/\s+/g, '');
    if (!clean || clean.length < 10) {
      showMsg('Please enter a valid 12-digit UPI UTR / Reference Number from your payment receipt', 'error');
      return;
    }

    setSubmittingUtr(true);
    try {
      const { data } = await API.post('/payment/submit-utr', {
        orderId: activeOrder.orderId,
        utr: utrInput.trim(),
      });
      showMsg(data.message, 'success');
      setActiveOrder(null);
      setRechargeAmount('');
      setUtrInput('');
      fetchWallet();
      setActiveTab('overview');
    } catch (err) {
      showMsg(err.response?.data?.message || 'UTR verification failed. Check the reference number.', 'error');
    } finally {
      setSubmittingUtr(false);
    }
  };

  // ── Withdraw ──────────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 1000) { showMsg('Minimum withdrawal is ₹1,000', 'error'); return; }

    const bankDetails = payMethod === 'upi'
      ? { upiId }
      : { ...bank };

    setWithdrawing(true);
    try {
      const { data } = await API.post('/wallet/withdraw', { amount: amt, bankDetails });
      showMsg(`Withdrawal of ₹${amt.toLocaleString('en-IN')} initiated! Amount has been deducted from your wallet. Status: Pending until owner transfers funds to your account.`, 'success');
      setWithdrawAmount('');
      fetchWallet();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Withdrawal failed', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const quickAmounts = [500, 1000, 2500, 5000, 10000, 20000, 25000, 30000, 50000];
  const txIcon  = (t) => ({ credit: '💳', earning: '☀️', debit: '🏦' }[t] || '💳');
  const txBg    = (t) => ({ credit: 'bg-blue-50 border border-blue-200 text-blue-700', earning: 'bg-emerald-50 border border-emerald-200 text-emerald-700', debit: 'bg-rose-50 border border-rose-200 text-rose-700' }[t]);
  const txColor = (t) => (t === 'debit' ? 'text-rose-600' : 'text-emerald-600');

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">Loading solar wallet…</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-800">

      {/* ── Hero Header ─────────────────────────────────── */}
      <div className="relative px-5 pt-12 pb-10 overflow-hidden border-b border-amber-200/60"
           style={{ background: 'linear-gradient(180deg, #FEF3C7 0%, #FFFBEB 60%, #F8FAFC 100%)' }}>
        <p className="text-amber-800 text-xs font-extrabold uppercase tracking-widest mb-1">My Solar Energy Wallet</p>
        <p className="text-5xl font-black text-slate-900 mt-1">
          ₹{wallet?.balance?.toLocaleString('en-IN') || '0'}
        </p>
        <p className="text-slate-500 text-xs font-semibold mt-1">Total Available Balance</p>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Total Earned', value: wallet?.totalEarned,          color: 'text-emerald-700', dot: 'bg-emerald-500' },
            { label: 'Withdrawable', value: wallet?.withdrawableBalance,   color: 'text-amber-700',   dot: 'bg-amber-500' },
            { label: 'Withdrawn',    value: wallet?.totalWithdrawn,        color: 'text-slate-600',   dot: 'bg-slate-400' },
          ].map((s) => (
            <div key={s.label}
                 className="rounded-2xl p-3 text-center bg-white border border-amber-100 shadow-sm">
              <div className={`w-1.5 h-1.5 rounded-full ${s.dot} mx-auto mb-1`} />
              <p className={`font-extrabold text-sm ${s.color}`}>₹{(s.value || 0).toLocaleString('en-IN')}</p>
              <p className="text-slate-400 text-[10px] font-bold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Message ─────────────────────────────────────── */}
      {message.text && (
        <div className={`mx-4 mt-4 p-3.5 rounded-xl text-sm font-semibold flex items-start gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="mx-4 mt-4 flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm gap-1">
        {[
          { id: 'overview', label: '📊  Overview' },
          { id: 'recharge', label: '⚡  UPI Recharge' },
          { id: 'withdraw', label: '🏦  Withdraw' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
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
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex gap-2.5 items-start">
              <span className="text-lg">💡</span>
              <p className="text-amber-900 text-xs leading-relaxed">
                <strong>Rule:</strong> Only <span className="text-amber-800 font-extrabold">earned power dividends</span> from solar plans can be withdrawn.
                Recharged balance is dedicated to purchasing solar units.
              </p>
            </div>

            <p className="text-slate-900 font-extrabold text-sm">Solar Dividend Transactions</p>
            {!wallet?.transactions?.length ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <span className="text-5xl block mb-2">📭</span>
                <p className="text-slate-600 font-bold">No transactions yet</p>
              </div>
            ) : (
              [...wallet.transactions].reverse().slice(0, 30).map((tx, i) => (
                <div key={i} className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${txBg(tx.type)}`}>
                    <span className="text-lg">{txIcon(tx.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-sm font-bold truncate">{tx.description}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {new Date(tx.date).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <p className={`font-black text-sm flex-shrink-0 ${txColor(tx.type)}`}>
                    {tx.type === 'debit' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* RECHARGE (DYNAMIC UPI QR + INTENT) */}
        {activeTab === 'recharge' && (
          <div className="space-y-5">
            {!activeOrder ? (
              // Step 1: Amount Selection
              <div className="space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 shadow-sm">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <p className="text-amber-900 font-extrabold text-sm">Direct UPI Instant Recharge</p>
                    <p className="text-amber-700 text-xs mt-0.5">Pay via Google Pay, PhonePe, Paytm, or BHIM UPI using verified Dynamic QR.</p>
                  </div>
                </div>

                {/* quick select */}
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Select Solar Capacity</p>
                  <div className="grid grid-cols-3 gap-2">
                    {quickAmounts.map((amt) => (
                      <button key={amt} onClick={() => setRechargeAmount(String(amt))}
                        className={`py-3 rounded-xl text-sm font-black border transition-all ${
                          rechargeAmount === String(amt)
                            ? 'bg-amber-500 border-amber-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-400'
                        }`}>
                        ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Or Custom Amount</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)}
                      placeholder="Enter amount (min ₹500)"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-sm font-semibold" />
                  </div>
                </div>

                <button onClick={handleGenerateUpi} disabled={paying || !rechargeAmount}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 text-sm">
                  {paying ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating QR…</>
                  ) : (
                    <><span>📱</span> Proceed to Pay ₹{Number(rechargeAmount || 0).toLocaleString('en-IN')}</>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                  <span>🔒</span><span>Direct UPI Banking · Zero Payment Gateway Fees</span>
                </div>
              </div>
            ) : (
              // Step 2: Scan QR & Pay
              <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-xl space-y-5 text-center">

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="text-left">
                    <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                      ☀️ Solar Wealth · Scan & Pay
                    </span>
                    <p className="text-slate-900 font-black text-2xl mt-1">₹{Number(activeOrder.amount).toLocaleString('en-IN')}</p>
                  </div>
                  <button
                    onClick={() => setActiveOrder(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    ✕ Change
                  </button>
                </div>

                {/* QR Code — scan-only, no direct UPI ID buttons */}
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-2xl border-2 border-amber-400 shadow-md inline-block mx-auto">
                    <QRCodeSVG
                      value={activeOrder.upiUrl}
                      size={220}
                      level="M"
                      includeMargin={true}
                    />
                  </div>

                  {/* Scan instruction banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-left space-y-1">
                    <p className="text-blue-800 font-black text-xs flex items-center gap-1.5">
                      📷 Iss QR ko apne UPI app se scan karein
                    </p>
                    <p className="text-blue-700 text-[11px] font-medium leading-relaxed">
                      PhonePe / GPay / Paytm open karein → <strong>"Scan QR"</strong> ya camera icon tap karein → Phone ka camera QR par point karein → ₹{Number(activeOrder.amount).toLocaleString('en-IN')} auto-fill ho jayega → Pay karein.
                    </p>
                  </div>

                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-left">
                    <p className="text-rose-700 text-[11px] font-semibold">
                      ⚠️ <strong>UPI ID manually type na karein</strong> — yeh QR-only merchant account hai. Sirf QR scan karke hi payment hogi.
                    </p>
                  </div>
                </div>

                {/* UTR Entry */}
                <form onSubmit={handleSubmitUtr} className="space-y-3 pt-3 border-t border-slate-100 text-left">
                  <div>
                    <label className="text-slate-800 text-xs font-black block mb-1.5">
                      Payment ke baad UTR / Ref No daalen (12 digits):
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="e.g. 426789123456"
                      maxLength={12}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono text-base tracking-widest font-bold shadow-inner"
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      💡 PhonePe / GPay / Paytm payment receipt me <strong>"UPI Ref No"</strong> ya <strong>"UTR"</strong> milega.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-left mt-2">
                      <p className="text-amber-800 text-[11px] font-bold">
                        🔒 <strong>One-Time Use:</strong> Har UTR sirf 1 baar use ho sakta hai. Duplicate ya already used UTR accept nahi hoga.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUtr || !utrInput || utrInput.length < 10}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {submittingUtr ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying…</>
                    ) : (
                      <><span>✓</span> Submit UTR & Add ₹{Number(activeOrder.amount).toLocaleString('en-IN')} to Wallet</>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* WITHDRAW */}
        {activeTab === 'withdraw' && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 shadow-sm">
              <span className="text-2xl">🏦</span>
              <div>
                <p className="text-emerald-900 font-extrabold text-sm">Solar Profit Cashout</p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  Available to withdraw: <span className="text-emerald-900 font-black">₹{(wallet?.withdrawableBalance || 0).toLocaleString('en-IN')}</span> (Min ₹1,000)
                </p>
                <p className="text-emerald-800 text-[11px] mt-1 font-medium">
                  ⚡ <em>Amount will be deducted from your wallet immediately. Status remains <strong>Pending</strong> until the owner transfers funds to your account, after which status changes to <strong>Transferred</strong>.</em>
                </p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Amount to Withdraw</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Min ₹1,000"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-sm font-semibold" />
              </div>
            </div>

            {/* payment method tabs */}
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Payout Destination</p>
              <div className="flex bg-white rounded-xl p-1 gap-1 border border-slate-200 shadow-sm">
                <button onClick={() => setPayMethod('upi')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${payMethod === 'upi' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}>
                  📱  UPI / PhonePe / GPay
                </button>
                <button onClick={() => setPayMethod('bank')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${payMethod === 'bank' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}>
                  🏦  Bank Account
                </button>
              </div>
            </div>

            {/* UPI fields */}
            {payMethod === 'upi' && (
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">UPI ID</p>
                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank / 9876543210@paytm"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition text-sm shadow-sm font-medium" />
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
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1.5">{label}</p>
                    <input type="text" value={bank[key]} onChange={(e) => setBank({ ...bank, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition text-sm shadow-sm font-medium" />
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
              {withdrawing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing Cashout…</>
              ) : (
                <><span>🏦</span> Withdraw ₹{Number(withdrawAmount || 0).toLocaleString('en-IN')}</>
              )}
            </button>

            <p className="text-slate-400 text-xs text-center font-medium">Payout processing: Owner transfers directly to your UPI/Bank within 24 hours</p>

            {/* ── User's Withdrawal History & Status ──────── */}
            {myWithdrawals && myWithdrawals.length > 0 && (
              <div className="pt-4 border-t border-slate-200 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-slate-900 font-extrabold text-xs uppercase tracking-wider">Your Cashout Requests</p>
                  <span className="text-[11px] text-slate-400 font-bold">{myWithdrawals.length} Total</span>
                </div>

                {myWithdrawals.slice(0, 10).map((req) => (
                  <div key={req._id} className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-black text-sm">₹{req.amount.toLocaleString('en-IN')}</span>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          req.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {req.status === 'pending' ? '⏳ Pending' : req.status === 'approved' ? '✅ Transferred' : '❌ Refunded'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1 font-medium">
                        {req.method === 'upi' ? `UPI: ${req.upiId}` : `Bank: ${req.bankAccount?.bankName || 'A/C'} (****${req.bankAccount?.accountNumber?.slice(-4) || ''})`}
                      </p>
                      <p className="text-slate-400 text-[10px] mt-0.5">
                        {new Date(req.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {req.status === 'pending' && ' · ⏳ Amount deducted from wallet · Transfer under process by owner'}
                        {req.status === 'approved' && ` · 🎉 Status: Transferred to your account (${req.paymentRef || 'Transferred'})`}
                        {req.status === 'rejected' && ` · ❌ Cancelled: ${req.adminNote || 'Amount refunded back to wallet'}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
