import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';

const SOLAR_PLANS = [
  // ── Standard Solar Plans (60 Days Cycle · 20% Daily Yield = 12x Return) ──────
  { id: 'starter',  name: '☀️ Solar Spark 500',        investedAmount: 500,   starsAmount: 250,   dailyEarn: 100,  totalReturn: 6000,   totalDays: 60, isVip: false },
  { id: 'basic',    name: '☀️ Solar Ray 1000',          investedAmount: 1000,  starsAmount: 500,   dailyEarn: 200,  totalReturn: 12000,  totalDays: 60, isVip: false },
  { id: 'silver',   name: '☀️ Solar Panel 2500',        investedAmount: 2500,  starsAmount: 1250,  dailyEarn: 500,  totalReturn: 30000,  totalDays: 60, isVip: false },
  { id: 'gold',     name: '☀️ Solar Grid 5000',         investedAmount: 5000,  starsAmount: 2500,  dailyEarn: 1000, totalReturn: 60000,  totalDays: 60, isVip: false },
  { id: 'platinum', name: '☀️ Solar Station 10000',     investedAmount: 10000, starsAmount: 5000,  dailyEarn: 2000, totalReturn: 120000, totalDays: 60, isVip: false },
  { id: 'diamond',  name: '☀️ Solar Park 20000',        investedAmount: 20000, starsAmount: 10000, dailyEarn: 4000, totalReturn: 240000, totalDays: 60, isVip: false },

  // ── VIP Solar Mega Plans (Accelerated High Yield · 60 Days) ──────────────────
  { id: 'vip-20k',  name: '⚡ VIP Solar SuperGrid 20K',     investedAmount: 20000, starsAmount: 10000, dailyEarn: 6000,  totalReturn: 360000,  totalDays: 60, isVip: true },
  { id: 'vip-25k',  name: '⚡ VIP Solar UltraPlant 25K',    investedAmount: 25000, starsAmount: 12500, dailyEarn: 8000,  totalReturn: 480000,  totalDays: 60, isVip: true },
  { id: 'vip-30k',  name: '⚡ VIP Solar PowerHub 30K',      investedAmount: 30000, starsAmount: 15000, dailyEarn: 10000, totalReturn: 600000,  totalDays: 60, isVip: true },
  { id: 'vip-40k',  name: '⚡ VIP Solar InfinityGig 40K',   investedAmount: 40000, starsAmount: 20000, dailyEarn: 15000, totalReturn: 900000,  totalDays: 60, isVip: true },
  { id: 'vip-50k',  name: '⚡ VIP Gigawatt Empire 50K',     investedAmount: 50000, starsAmount: 25000, dailyEarn: 20000, totalReturn: 1200000, totalDays: 60, isVip: true },
];

export default function WalletPage() {
  const { user }                            = useAuth();
  const [wallet, setWallet]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState('500');
  const [activeTab, setActiveTab]           = useState('overview');
  const [planCategoryTab, setPlanCategoryTab] = useState('standard'); // 'standard' | 'vip'
  const [selectedPlanId, setSelectedPlanId] = useState('starter');
  const [withdrawing, setWithdrawing]       = useState(false);
  const [message, setMessage]               = useState({ text: '', type: '' });

  // Telegram Stars Payment state
  const [starOrder, setStarOrder]           = useState(null);
  const [starCodeInput, setStarCodeInput]   = useState('');
  const [verifyingCode, setVerifyingCode]   = useState(false);
  const [openingTelegram, setOpeningTelegram] = useState(false);
  const [manualCodeMode, setManualCodeMode] = useState(false);

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

  // ── Step 1: Open Telegram Bot for Plan / Star Payment ────────
  const handleBuyPlanTelegram = async (plan) => {
    setOpeningTelegram(true);
    try {
      const { data } = await API.post('/payment/telegram-order', {
        amount: plan.investedAmount,
        planId: plan.id,
      });
      setStarOrder({
        ...data,
        planName: plan.name,
      });
      setStarCodeInput('');
      window.open(data.telegramUrl, '_blank');
      showMsg(`Telegram opened! Buy ${plan.name} for ${plan.starsAmount} ⭐ Stars in @${data.botUsername}. Enter your verification code below.`, 'success');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Could not open Telegram recharge', 'error');
    } finally {
      setOpeningTelegram(false);
    }
  };

  const handleOpenTelegram = async () => {
    const amt = Number(rechargeAmount);
    if (!amt || amt < 200) { showMsg('Minimum recharge amount is ₹200', 'error'); return; }

    setOpeningTelegram(true);
    try {
      const { data } = await API.post('/payment/telegram-order', { amount: amt });
      setStarOrder(data);
      setStarCodeInput('');
      // Open Telegram deep link in new window / app
      window.open(data.telegramUrl, '_blank');
      showMsg(`Telegram opened! Pay ${data.starsAmount} ⭐ Stars in @${data.botUsername} and enter the received code below.`, 'success');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Could not open Telegram recharge', 'error');
    } finally {
      setOpeningTelegram(false);
    }
  };

  // ── Step 2: Verify Unique Code Received from Bot ─────────────
  const handleVerifyStarCode = async (e) => {
    e.preventDefault();
    const clean = starCodeInput.trim().toUpperCase();
    if (!clean || clean.length < 4) {
      showMsg('Please enter a valid Verification Code received from @SolarWealthBot (e.g. SW7XK9)', 'error');
      return;
    }

    setVerifyingCode(true);
    try {
      const { data } = await API.post('/payment/verify-star-code', { code: clean });
      showMsg(data.message, 'success');
      setStarOrder(null);
      setManualCodeMode(false);
      setRechargeAmount('500');
      setStarCodeInput('');
      fetchWallet();
      setActiveTab('overview');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Verification failed. Please check the code.', 'error');
    } finally {
      setVerifyingCode(false);
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
          { id: 'recharge', label: '⭐  Stars Recharge' },
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

        {/* RECHARGE (TELEGRAM STARS & UNIQUE CODE) */}
        {activeTab === 'recharge' && (
          <div className="space-y-5">
            {!starOrder && !manualCodeMode ? (
              // Step 1: Amount & Stars Selection
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex gap-3 shadow-sm">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="text-amber-900 font-extrabold text-sm">Telegram Stars Instant Recharge</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      Pay via Telegram Stars ⭐ in <strong>@SolarWealthBot</strong>. Rate: 1 Star = ₹2.
                    </p>
                  </div>
                </div>

                {/* Plans Category Switcher */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setPlanCategoryTab('standard')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition ${
                      planCategoryTab === 'standard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ☀️ Standard Plans (6)
                  </button>
                  <button
                    onClick={() => setPlanCategoryTab('vip')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition ${
                      planCategoryTab === 'vip' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ⚡ VIP Mega Plans (5)
                  </button>
                </div>

                {/* Plans List */}
                <div className="space-y-3">
                  {SOLAR_PLANS.filter((p) => (planCategoryTab === 'vip' ? p.isVip : !p.isVip)).map((plan) => (
                    <div
                      key={plan.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-amber-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{plan.name}</h4>
                          <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                            ₹{plan.dailyEarn.toLocaleString('en-IN')}/day · Total Return: ₹{plan.totalReturn.toLocaleString('en-IN')} (60 Days)
                          </p>
                        </div>
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 font-black text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                          {plan.starsAmount} ⭐
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Plan Price</span>
                          <span className="text-base font-black text-slate-900">
                            ₹{plan.investedAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleBuyPlanTelegram(plan)}
                          disabled={openingTelegram}
                          className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5"
                        >
                          <span>✈️</span> Buy with {plan.starsAmount} ⭐
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Amount Section */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Or Custom Recharge Amount (₹)</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      placeholder="Enter amount (min ₹200)"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-sm font-semibold text-sm"
                    />
                  </div>
                  {rechargeAmount && Number(rechargeAmount) >= 200 && (
                    <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Telegram Stars Required:</span>
                      <span className="text-amber-700 font-black">{Math.ceil(Number(rechargeAmount) / 2)} ⭐ Stars</span>
                    </div>
                  )}
                  <button
                    onClick={handleOpenTelegram}
                    disabled={openingTelegram || !rechargeAmount || Number(rechargeAmount) < 200}
                    className="w-full bg-slate-900 hover:bg-black text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>✈️</span> Open Bot for Custom ₹{Number(rechargeAmount || 0).toLocaleString('en-IN')}
                  </button>
                </div>

                {/* Option to enter code directly */}
                <div className="text-center pt-1">
                  <button
                    onClick={() => setManualCodeMode(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 underline decoration-blue-300"
                  >
                    🔑 Already bought a plan in @SolarWealthBot? Enter Code here →
                  </button>
                </div>
              </div>
            ) : (
              // Step 2: Enter Verification Code from Telegram Bot
              <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-xl space-y-5 text-center">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="text-left">
                    <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                      ✈️ Telegram Stars Verification
                    </span>
                    <p className="text-slate-900 font-black text-2xl mt-1">
                      {starOrder ? `₹${Number(starOrder.amount).toLocaleString('en-IN')} (${starOrder.starsAmount} ⭐)` : 'Enter Code'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setStarOrder(null); setManualCodeMode(false); }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    ✕ Back
                  </button>
                </div>

                {/* Step Instructions */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>📋</span> <span>Follow these steps:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 font-medium leading-relaxed">
                    <li>Telegram me <strong>@SolarWealthBot</strong> par invoice pay karein</li>
                    <li>Payment success hone par bot ek <strong>Unique Verification Code</strong> bhejega</li>
                    <li>Wo Code niche enter karke <strong>Verify</strong> par tap karein</li>
                  </ol>
                  {starOrder?.telegramUrl && (
                    <div className="pt-2">
                      <a
                        href={starOrder.telegramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl transition"
                      >
                        <span>✈️</span> Re-open @SolarWealthBot in Telegram ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Code Entry Form */}
                <form onSubmit={handleVerifyStarCode} className="space-y-4 pt-2 border-t border-slate-100 text-left">
                  <div>
                    <label className="text-slate-800 text-xs font-black block mb-1.5">
                      🔑 Enter Unique Verification Code from Bot:
                    </label>
                    <input
                      type="text"
                      value={starCodeInput}
                      onChange={(e) => setStarCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. SW7XK9"
                      maxLength={12}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-lg tracking-widest font-black shadow-inner uppercase text-center"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                      Code is generated automatically by @SolarWealthBot after Stars payment.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingCode || !starCodeInput || starCodeInput.length < 4}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {verifyingCode ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying Code…</>
                    ) : (
                      <><span>✓</span> Verify Code & Add to Wallet</>
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
