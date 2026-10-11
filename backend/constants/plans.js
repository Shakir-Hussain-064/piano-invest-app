// Single Source of Truth for all Solar Wealth Investment Plans
// 1 Star = ₹2, so stars = Math.ceil(investedAmount / 2)

const STAR_RATE = 2;

const PLANS = [
  // ── Standard Solar Plans (60 Days Cycle · 20% Daily Yield = 12x Return) ──────
  {
    id: 'starter',
    name: '☀️ Solar Spark 500',
    investedAmount: 500,
    starsAmount: 250,
    dailyEarn: 100,
    totalReturn: 6000,
    totalDays: 60,
    isVip: false,
  },
  {
    id: 'basic',
    name: '☀️ Solar Ray 1000',
    investedAmount: 1000,
    starsAmount: 500,
    dailyEarn: 200,
    totalReturn: 12000,
    totalDays: 60,
    isVip: false,
  },
  {
    id: 'silver',
    name: '☀️ Solar Panel 2500',
    investedAmount: 2500,
    starsAmount: 1250,
    dailyEarn: 500,
    totalReturn: 30000,
    totalDays: 60,
    isVip: false,
  },
  {
    id: 'gold',
    name: '☀️ Solar Grid 5000',
    investedAmount: 5000,
    starsAmount: 2500,
    dailyEarn: 1000,
    totalReturn: 60000,
    totalDays: 60,
    isVip: false,
  },
  {
    id: 'platinum',
    name: '☀️ Solar Station 10000',
    investedAmount: 10000,
    starsAmount: 5000,
    dailyEarn: 2000,
    totalReturn: 120000,
    totalDays: 60,
    isVip: false,
  },
  {
    id: 'diamond',
    name: '☀️ Solar Park 20000',
    investedAmount: 20000,
    starsAmount: 10000,
    dailyEarn: 4000,
    totalReturn: 240000,
    totalDays: 60,
    isVip: false,
  },

  // ── VIP Solar Mega Plans (Accelerated High Yield · 60 Days) ──────────────────
  {
    id: 'vip-20k',
    name: '⚡ VIP Solar SuperGrid 20K',
    investedAmount: 20000,
    starsAmount: 10000,
    dailyEarn: 6000,
    totalReturn: 360000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-25k',
    name: '⚡ VIP Solar UltraPlant 25K',
    investedAmount: 25000,
    starsAmount: 12500,
    dailyEarn: 8000,
    totalReturn: 480000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-30k',
    name: '⚡ VIP Solar PowerHub 30K',
    investedAmount: 30000,
    starsAmount: 15000,
    dailyEarn: 10000,
    totalReturn: 600000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-40k',
    name: '⚡ VIP Solar InfinityGig 40K',
    investedAmount: 40000,
    starsAmount: 20000,
    dailyEarn: 15000,
    totalReturn: 900000,
    totalDays: 60,
    isVip: true,
  },
  {
    id: 'vip-50k',
    name: '⚡ VIP Gigawatt Empire 50K',
    investedAmount: 50000,
    starsAmount: 25000,
    dailyEarn: 20000,
    totalReturn: 1200000,
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
