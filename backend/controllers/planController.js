const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

const PLANS = [
  // ── Standard Piano Plans (2x return in 20 days) ────────────────────────
  { id: 'starter',  name: '🎹 Piano Prelude',  investedAmount: 500,   dailyEarn: 50,   totalReturn: 1000,  totalDays: 20, isVip: false },
  { id: 'basic',    name: '🎹 Piano Sonata',   investedAmount: 1000,  dailyEarn: 100,  totalReturn: 2000,  totalDays: 20, isVip: false },
  { id: 'silver',   name: '🎹 Piano Symphony', investedAmount: 2500,  dailyEarn: 250,  totalReturn: 5000,  totalDays: 20, isVip: false },
  { id: 'gold',     name: '🎹 Piano Concerto', investedAmount: 5000,  dailyEarn: 500,  totalReturn: 10000, totalDays: 20, isVip: false },
  { id: 'platinum', name: '🎹 Piano Maestro',  investedAmount: 10000, dailyEarn: 1000, totalReturn: 20000, totalDays: 20, isVip: false },
  { id: 'diamond',  name: '🎹 Piano Virtuoso', investedAmount: 20000, dailyEarn: 2000, totalReturn: 40000, totalDays: 20, isVip: false },
  { id: 'elite',    name: '🎹 Grand Royal Piano', investedAmount: 25000, dailyEarn: 2500, totalReturn: 50000, totalDays: 20, isVip: false },

  // ── VIP Piano Plans (higher daily return, more profit) ──────────────────
  { id: 'vip-silver',   name: '👑 VIP Piano Symphony', investedAmount: 2500,  dailyEarn: 350,  totalReturn: 7000,  totalDays: 20, isVip: true },
  { id: 'vip-gold',     name: '👑 VIP Piano Concerto', investedAmount: 5000,  dailyEarn: 750,  totalReturn: 15000, totalDays: 20, isVip: true },
  { id: 'vip-platinum', name: '👑 VIP Piano Maestro',  investedAmount: 10000, dailyEarn: 1500, totalReturn: 30000, totalDays: 20, isVip: true },
  { id: 'vip-diamond',  name: '👑 VIP Piano Virtuoso', investedAmount: 20000, dailyEarn: 3000, totalReturn: 60000, totalDays: 20, isVip: true },
  { id: 'vip-elite',    name: '👑 VIP Grand Royal Piano', investedAmount: 25000, dailyEarn: 4000, totalReturn: 80000, totalDays: 20, isVip: true },
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
