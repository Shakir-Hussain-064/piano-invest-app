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
    <div className="min-h-screen bg-dark pb-24">
      {/* Header */}
      <div className="bg-card border-b border-accent/30 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-1.5">
            <span>🎹</span> Piano Plans
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Tune your 2× daily melody profits</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Wallet Balance</p>
          <p className="text-primary font-bold text-lg">₹{wallet?.balance?.toLocaleString() || '0'}</p>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`mx-4 mt-4 p-3 rounded-xl text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-500/20 border border-green-500/40 text-green-300'
            : 'bg-red-500/20 border border-red-500/40 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="mx-4 mt-4 flex bg-card rounded-xl p-1 border border-accent/30">
        <button
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'standard' ? 'bg-primary text-white shadow-md' : 'text-gray-400'
          }`}
        >
          🎹 Standard
        </button>
        <button
          onClick={() => setActiveTab('vip')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'vip' ? 'bg-yellow-500 text-black shadow-md' : 'text-gray-400'
          }`}
        >
          👑 VIP Piano
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'my' ? 'bg-accent text-white shadow-md' : 'text-gray-400'
          }`}
        >
          🎼 My Plans
        </button>
      </div>

      {/* Plans Content */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading plans...</div>
        ) : activeTab === 'standard' ? (
          <div className="grid grid-cols-1 gap-4">
            {standardPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} walletBalance={wallet?.balance || 0} />
            ))}
          </div>
        ) : activeTab === 'vip' ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
              <p className="text-yellow-400 text-sm font-semibold">👑 Exclusive VIP Plans</p>
              <p className="text-gray-400 text-xs mt-0.5">Higher returns, maximum profit</p>
            </div>
            {vipPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} walletBalance={wallet?.balance || 0} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {myPlans.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-400">No active plans yet</p>
                <p className="text-gray-600 text-sm mt-1">Purchase a plan to start earning</p>
              </div>
            ) : (
              myPlans.map(plan => (
                <div key={plan._id} className={`rounded-xl p-4 border ${
                  plan.isComplete
                    ? 'bg-gray-800/50 border-gray-700'
                    : plan.isVip
                      ? 'bg-yellow-900/20 border-yellow-500/40'
                      : 'bg-card border-primary/30'
                }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`font-bold ${ plan.isVip ? 'text-yellow-400' : 'text-primary' }`}>
                        {plan.planName} {plan.isVip && '👑'}
                      </h3>
                      <p className="text-gray-400 text-xs">
                        Started {new Date(plan.startDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      plan.isComplete ? 'bg-gray-700 text-gray-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {plan.isComplete ? 'Completed' : 'Active'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-dark/50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">Invested</p>
                      <p className="text-white font-bold text-sm">₹{plan.investedAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-dark/50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">Daily Earn</p>
                      <p className="text-green-400 font-bold text-sm">₹{plan.dailyEarn.toLocaleString()}</p>
                    </div>
                    <div className="bg-dark/50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">Earned So Far</p>
                      <p className="text-emerald-400 font-bold text-sm">₹{plan.earnedSoFar.toLocaleString()}</p>
                    </div>
                    <div className="bg-dark/50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">Total Return</p>
                      <p className="text-white font-bold text-sm">₹{plan.totalReturn.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Day {plan.daysCompleted}/{plan.totalDays}</span>
                      <span>{Math.round((plan.earnedSoFar / plan.totalReturn) * 100)}%</span>
                    </div>
                    <div className="w-full bg-dark/50 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${ plan.isVip ? 'bg-yellow-500' : 'bg-primary' }`}
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
