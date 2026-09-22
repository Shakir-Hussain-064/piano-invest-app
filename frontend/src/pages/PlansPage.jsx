import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import PlanCard from '../components/PlanCard';
import API from '../api/axios';

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [myPlans, setMyPlans] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, walletRes, myPlansRes] = await Promise.all([
        API.get('/plans'),
        API.get('/wallet'),
        API.get('/plans/my'),
      ]);
      setPlans(plansRes.data);
      setWallet(walletRes.data);
      setMyPlans(myPlansRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (plan) => {
    setMessage({ text: '', type: '' });
    try {
      const { data } = await API.post('/plans/buy', { planId: plan.id });
      setMessage({ text: data.message, type: 'success' });
      fetchData();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Purchase failed', type: 'error' });
    }
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const standardPlans = plans.filter(p => !p.isVip);
  const vipPlans = plans.filter(p => p.isVip);

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-1.5">
            <span>☀️</span> Solar Plans
          </h1>
          <p className="text-amber-600 font-bold text-xs mt-0.5">60 Days Solar Cycles · Daily Power Dividends</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-semibold">Wallet Balance</p>
          <p className="text-amber-600 font-black text-lg">₹{wallet?.balance?.toLocaleString() || '0'}</p>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`mx-4 mt-4 p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold transition-all ${
            activeTab === 'standard' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          ☀️ Standard (60D)
        </button>
        <button
          onClick={() => setActiveTab('vip')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold transition-all ${
            activeTab === 'vip' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          ⚡ VIP Mega
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold transition-all ${
            activeTab === 'my' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🔋 My Units
        </button>
      </div>

      {/* Plans Content */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading solar plans...</div>
        ) : activeTab === 'standard' ? (
          <div className="grid grid-cols-1 gap-4">
            {standardPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} walletBalance={wallet?.balance || 0} />
            ))}
          </div>
        ) : activeTab === 'vip' ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center shadow-sm">
              <p className="text-amber-900 text-sm font-extrabold">👑 Exclusive VIP Solar Mega Stations</p>
              <p className="text-amber-700 text-xs mt-0.5">Industrial grade solar grids with accelerated daily yield</p>
            </div>
            {vipPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} walletBalance={wallet?.balance || 0} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {myPlans.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <div className="text-5xl mb-3">☀️</div>
                <p className="text-slate-700 font-bold">No active solar units yet</p>
                <p className="text-slate-400 text-xs mt-1">Fund a solar unit to start earning daily power dividends</p>
              </div>
            ) : (
              myPlans.map(plan => (
                <div key={plan._id} className={`rounded-2xl p-4 border shadow-sm ${
                  plan.isComplete
                    ? 'bg-slate-50 border-slate-200 opacity-80'
                    : plan.isVip
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-300'
                      : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        {plan.planName} {plan.isVip && '👑'}
                      </h3>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Activated on {new Date(plan.startDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      plan.isComplete ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {plan.isComplete ? 'Completed' : '● Generating Power'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Invested</p>
                      <p className="text-slate-900 font-extrabold text-sm">₹{plan.investedAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Daily Earning</p>
                      <p className="text-emerald-600 font-extrabold text-sm">₹{plan.dailyEarn.toLocaleString()}/day</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Earned So Far</p>
                      <p className="text-emerald-700 font-extrabold text-sm">₹{plan.earnedSoFar.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/60">
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Return</p>
                      <p className="text-amber-700 font-black text-sm">₹{plan.totalReturn.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 font-semibold mb-1">
                      <span>Day {plan.daysCompleted} of {plan.totalDays}</span>
                      <span className="text-amber-700 font-bold">{Math.round((plan.earnedSoFar / plan.totalReturn) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${Math.min((plan.earnedSoFar / plan.totalReturn) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
