const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

const PLANS = [
  // ── Standard Solar Plans (60 Days Cycle · 20% Daily Yield = 12x Return) ──────
  { id: 'starter',  name: '☀️ Solar Spark 500',        investedAmount: 500,   dailyEarn: 100,  totalReturn: 6000,   totalDays: 60, isVip: false },
  { id: 'basic',    name: '☀️ Solar Ray 1000',          investedAmount: 1000,  dailyEarn: 200,  totalReturn: 12000,  totalDays: 60, isVip: false },
  { id: 'silver',   name: '☀️ Solar Panel 2500',        investedAmount: 2500,  dailyEarn: 500,  totalReturn: 30000,  totalDays: 60, isVip: false },
  { id: 'gold',     name: '☀️ Solar Grid 5000',         investedAmount: 5000,  dailyEarn: 1000, totalReturn: 60000,  totalDays: 60, isVip: false },
  { id: 'platinum', name: '☀️ Solar Station 10000',     investedAmount: 10000, dailyEarn: 2000, totalReturn: 120000, totalDays: 60, isVip: false },
  { id: 'diamond',  name: '☀️ Solar Park 20000',        investedAmount: 20000, dailyEarn: 4000, totalReturn: 240000, totalDays: 60, isVip: false },
  { id: 'elite',    name: '☀️ Mega Solar Plant 25000',  investedAmount: 25000, dailyEarn: 5000, totalReturn: 300000, totalDays: 60, isVip: false },

  // ── VIP Solar Mega Plans (Accelerated High Yield · 60 Days) ──────────────────
  { id: 'vip-silver',   name: '⚡ VIP Solar SuperGrid',     investedAmount: 2500,  dailyEarn: 750,   totalReturn: 45000,  totalDays: 60, isVip: true },
  { id: 'vip-gold',     name: '⚡ VIP Solar UltraPlant',    investedAmount: 5000,  dailyEarn: 1600,  totalReturn: 96000,  totalDays: 60, isVip: true },
  { id: 'vip-platinum', name: '⚡ VIP Solar PowerHub',      investedAmount: 10000, dailyEarn: 3500,  totalReturn: 210000, totalDays: 60, isVip: true },
  { id: 'vip-diamond',  name: '⚡ VIP Solar InfinityGig',   investedAmount: 20000, dailyEarn: 7500,  totalReturn: 450000, totalDays: 60, isVip: true },
  { id: 'vip-elite',    name: '⚡ VIP Gigawatt SolarEmpire',investedAmount: 25000, dailyEarn: 10000, totalReturn: 600000, totalDays: 60, isVip: true },
];

exports.getPlans = (req, res) => {
  res.json(PLANS);
};

exports.buyPlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user._id;

    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < plan.investedAmount) {
      return res.status(400).json({ message: `Insufficient wallet balance. Please recharge at least ₹${plan.investedAmount}` });
    }

    // Deduct from wallet
    wallet.balance -= plan.investedAmount;
    wallet.transactions.push({
      type: 'debit',
      amount: plan.investedAmount,
      description: `Purchased ${plan.name} Plan`,
    });
    await wallet.save();

    // Create active plan
    const activePlan = await ActivePlan.create({
      userId,
      planId: plan.id,
      planName: plan.name,
      isVip: plan.isVip,
      investedAmount: plan.investedAmount,
      dailyEarn: plan.dailyEarn,
      totalReturn: plan.totalReturn,
      totalDays: plan.totalDays,
    });

    res.status(201).json({ message: 'Plan purchased successfully!', activePlan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error buying plan' });
  }
};

exports.getMyPlans = async (req, res) => {
  try {
    const plans = await ActivePlan.find({ userId: req.user._id }).sort({ startDate: -1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching plans' });
  }
};
