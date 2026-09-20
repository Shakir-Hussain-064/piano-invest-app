export default function PlanCard({ plan, onBuy, walletBalance }) {
  const canAfford = walletBalance >= plan.investedAmount;
  const profitMultiplier = (plan.totalReturn / plan.investedAmount).toFixed(1);

  return (
    <div
      className={`relative rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
        plan.isVip
          ? 'bg-gradient-to-br from-amber-950/60 to-yellow-900/30 border-yellow-500/50 shadow-yellow-500/10 shadow-xl'
          : 'bg-gradient-to-br from-slate-900/90 to-card border-yellow-500/30 shadow-lg'
      }`}
    >
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {profitMultiplier}× RETURN
        </span>
        {plan.isVip && (
          <span className="bg-yellow-400 text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            VIP
          </span>
        )}
      </div>

      <div className="mb-4">
        <h3 className={`text-lg font-extrabold ${ plan.isVip ? 'text-yellow-400' : 'text-white' }`}>
          {plan.name}
        </h3>
        <p className="text-gray-400 text-xs mt-0.5">{plan.totalDays} Days Solar Generation Cycle</p>
      </div>

      <div className="space-y-2 mb-4 bg-dark/60 rounded-xl p-3 border border-white/5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Solar Investment</span>
          <span className="font-bold text-white text-sm">₹{plan.investedAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Daily Power Yield</span>
          <span className={`font-bold text-sm ${ plan.isVip ? 'text-yellow-400' : 'text-emerald-400' }`}>
            ₹{plan.dailyEarn.toLocaleString()}/day
          </span>
        </div>
        <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2">
          <span className="text-gray-300 font-semibold">Total 3× Return</span>
          <span className="font-black text-yellow-400 text-base">₹{plan.totalReturn.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={() => onBuy(plan)}
        disabled={!canAfford}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
          canAfford
            ? plan.isVip
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black shadow-lg shadow-yellow-500/20'
              : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-lg shadow-yellow-500/20'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
        }`}
      >
        {canAfford ? `⚡ Fund Solar Unit (₹${plan.investedAmount.toLocaleString()})` : 'Insufficient Wallet Balance'}
      </button>
    </div>
  );
}
