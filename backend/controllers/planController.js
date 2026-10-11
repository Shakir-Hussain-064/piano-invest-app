const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');
const { PLANS } = require('../constants/plans');

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
