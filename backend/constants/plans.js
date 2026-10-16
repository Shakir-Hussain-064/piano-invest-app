// Single Source of Truth for all Solar Wealth Investment Plans
// 1 Star = ₹2, so stars = Math.ceil(investedAmount / 2)

const STAR_RATE = 2;

const PLANS = [
  // ── Standard Solar Plans (45 Days Cycle · 15% Daily Yield = 6.75x Return) ────
  {
    id: 'starter',
    name: '☀️ Solar Spark 500',
    investedAmount: 500,
    starsAmount: 250,
    dailyEarn: 75, // 15% of 500
    totalReturn: 3375, // 75 * 45
    totalDays: 45,
    isVip: false,
  },
  {
    id: 'basic',
    name: '☀️ Solar Ray 1000',
    investedAmount: 1000,
    starsAmount: 500,
    dailyEarn: 150, // 15% of 1000
    totalReturn: 6750, // 150 * 45
    totalDays: 45,
    isVip: false,
  },
  {
    id: 'silver',
    name: '☀️ Solar Panel 2500',
    investedAmount: 2500,
    starsAmount: 1250,
    dailyEarn: 375, // 15% of 2500
    totalReturn: 16875, // 375 * 45
    totalDays: 45,
    isVip: false,
  },
  {
    id: 'gold',
    name: '☀️ Solar Grid 5000',
    investedAmount: 5000,
    starsAmount: 2500,
    dailyEarn: 750, // 15% of 5000
    totalReturn: 33750, // 750 * 45
    totalDays: 45,
    isVip: false,
  },
  {
    id: 'platinum',
    name: '☀️ Solar Station 10000',
    investedAmount: 10000,
    starsAmount: 5000,
    dailyEarn: 1500, // 15% of 10000
    totalReturn: 67500, // 1500 * 45
    totalDays: 45,
    isVip: false,
  },
  {
    id: 'diamond',
    name: '☀️ Solar Park 20000',
    investedAmount: 20000,
    starsAmount: 10000,
    dailyEarn: 3000, // 15% of 20000
    totalReturn: 135000, // 3000 * 45
    totalDays: 45,
    isVip: false,
  },

  // ── VIP Solar Mega Plans (60 Days Cycle · 15% Daily Yield) ──────────────────
  {
    id: 'vip-20k',
    name: '⚡ VIP Solar SuperGrid 20K',
    investedAmount: 20000,
    starsAmount: 10000,
    dailyEarn: 3000, // 15% of 20000
    totalReturn: 180000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-25k',
    name: '⚡ VIP Solar UltraPlant 25K',
    investedAmount: 25000,
    starsAmount: 12500,
    dailyEarn: 3750, // 15% of 25000
    totalReturn: 225000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-30k',
    name: '⚡ VIP Solar PowerHub 30K',
    investedAmount: 30000,
    starsAmount: 15000,
    dailyEarn: 4500, // 15% of 30000
    totalReturn: 270000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-40k',
    name: '⚡ VIP Solar InfinityGig 40K',
    investedAmount: 40000,
    starsAmount: 20000,
    dailyEarn: 6000, // 15% of 40000
    totalReturn: 360000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-50k',
    name: '⚡ VIP Gigawatt Empire 50K',
    investedAmount: 50000,
    starsAmount: 25000,
    dailyEarn: 7500, // 15% of 50000
    totalReturn: 450000,
    totalDays: 60,
    isVip: true,
  },
];

function findPlanById(planId) {
  if (!planId) return null;
  return PLANS.find((p) => p.id === planId) || null;
}

function findPlanByAmount(amt) {
  const num = Number(amt);
  return PLANS.find((p) => p.investedAmount === num) || null;
}

module.exports = {
  PLANS,
  STAR_RATE,
  findPlanById,
  findPlanByAmount,
};
