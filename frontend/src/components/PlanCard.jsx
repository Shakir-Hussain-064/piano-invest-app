export default function PlanCard({ plan, onBuy, walletBalance }) {
  const canAfford = walletBalance >= plan.investedAmount;
  const profitMultiplier = (plan.totalReturn / plan.investedAmount).toFixed(1);

  return (
    <div
      className={`relative rounded-2xl p-5 border transition-all duration-300 hover:scale-105 cursor-pointer ${
        plan.isVip
          ? 'bg-gradient-to-br from-yellow-900/40 to-yellow-600/20 border-yellow-500/50 shadow-yellow-500/20 shadow-lg'
          : 'bg-gradient-to-br from-card to-accent/30 border-primary/30 shadow-primary/10 shadow-lg'
      }`}
    >
      {plan.isVip && (
        <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          VIP
        </div>
      )}
      <div className="mb-4">
        <h3 className={`text-xl font-bold ${ plan.isVip ? 'text-yellow-400' : 'text-primary' }`}>
          {plan.name}
        </h3>
        <p className="text-gray-400 text-sm mt-1">{plan.totalDays} days plan</p>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Investment</span>
          <span className="font-bold text-white">₹{plan.investedAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Daily Earn</span>
          <span className={`font-bold ${ plan.isVip ? 'text-yellow-400' : 'text-green-400' }`}>
            ₹{plan.dailyEarn.toLocaleString()}/day
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Total Return</span>
          <span className="font-bold text-green-300">₹{plan.totalReturn.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center border-t border-white/10 pt-2">
          <span className="text-gray-400 text-sm">Profit</span>
          <span className="font-bold text-emerald-400">{profitMultiplier}x Return</span>
        </div>
      </div>
      <button
        onClick={() => onBuy(plan)}
        disabled={!canAfford}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
          canAfford
            ? plan.isVip
              ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
              : 'bg-primary hover:bg-primary/80 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {canAfford ? `Invest ₹${plan.investedAmount.toLocaleString()}` : 'Insufficient Balance'}
      </button>
    </div>
  );
}
