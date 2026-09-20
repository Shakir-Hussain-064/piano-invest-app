export default function PlanCard({ plan, onBuy, walletBalance }) {
  const canAfford = walletBalance >= plan.investedAmount;
  const profitMultiplier = (plan.totalReturn / plan.investedAmount).toFixed(1);

  return (
    <div
      className={`relative rounded-2xl p-5 border transition-all duration-300 hover:shadow-md cursor-pointer ${
        plan.isVip
          ? 'bg-gradient-to-br from-amber-50 to-orange-50/60 border-amber-300 shadow-sm'
          : 'bg-white border-slate-200/90 shadow-sm'
      }`}
    >
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {profitMultiplier}× RETURN
        </span>
        {plan.isVip && (
          <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
            VIP
          </span>
        )}
      </div>

      <div className="mb-4">
        <h3 className={`text-lg font-extrabold ${ plan.isVip ? 'text-amber-800' : 'text-slate-900' }`}>
          {plan.name}
        </h3>
        <p className="text-slate-500 text-xs mt-0.5">{plan.totalDays} Days Solar Generation Cycle</p>
      </div>

      <div className="space-y-2 mb-4 bg-slate-50 rounded-xl p-3 border border-slate-200/60">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">Solar Investment</span>
          <span className="font-bold text-slate-800 text-sm">₹{plan.investedAmount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">Daily Power Yield</span>
          <span className={`font-bold text-sm ${ plan.isVip ? 'text-amber-700' : 'text-emerald-600' }`}>
            ₹{plan.dailyEarn.toLocaleString()}/day
          </span>
        </div>
        <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2">
          <span className="text-slate-700 font-semibold">Total 3× Return</span>
          <span className="font-black text-amber-600 text-base">₹{plan.totalReturn.toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={() => onBuy(plan)}
        disabled={!canAfford}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
          canAfford
            ? plan.isVip
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-orange-500/20'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
        }`}
      >
        {canAfford ? `⚡ Fund Solar Unit (₹${plan.investedAmount.toLocaleString()})` : 'Insufficient Wallet Balance'}
      </button>
    </div>
  );
}
