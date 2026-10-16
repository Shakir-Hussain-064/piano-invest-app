const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');
const { PLANS } = require('../constants/plans');
const { reconcileDailyEarningsForUser } = require('../cron/dailyEarnings');

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
    if (wallet.withdrawableBalance > wallet.balance) {
      wallet.withdrawableBalance = wallet.balance;
    }
    wallet.transactions.push({
      type: 'debit',
      amount: plan.investedAmount,
      description: `Purchased ${plan.name} Plan`,
      date: new Date(),
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
      daysCompleted: 0,
      earnedSoFar: 0,
      startDate: new Date(),
      lastCreditDate: null,
      isComplete: false,
    });

    res.status(201).json({ message: 'Plan purchased successfully!', activePlan });
  } catch (error) {
    console.error('buyPlan error:', error);
    res.status(500).json({ message: 'Server error buying plan: ' + error.message });
  }
};

exports.getMyPlans = async (req, res) => {
  try {
    // Reconcile daily earnings for this user before fetching
    await reconcileDailyEarningsForUser(req.user._id);

    const plans = await ActivePlan.find({ userId: req.user._id }).sort({ startDate: -1 });
    res.json(plans);
  } catch (error) {
    console.error('getMyPlans error:', error);
    res.status(500).json({ message: 'Server error fetching plans: ' + error.message });
  }
};
