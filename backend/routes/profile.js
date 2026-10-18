const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');
const { reconcileDailyEarningsForUser } = require('../cron/dailyEarnings');

router.get('/', protect, async (req, res) => {
  try {
    // Reconcile daily earnings for this user before fetching profile
    await reconcileDailyEarningsForUser(req.user._id);

    const user = await User.findById(req.user._id).select('-password');
    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        balance: 50,
        recharged: 0,
        totalEarned: 50,
        withdrawableBalance: 50,
        totalWithdrawn: 0,
        transactions: [{
          type: 'credit',
          amount: 50,
          description: '🎁 Welcome Signup Bonus ₹50',
          date: new Date(),
        }],
      });
    } else if (wallet.balance === 0 && (!wallet.transactions || wallet.transactions.length === 0)) {
      wallet.balance = 50;
      wallet.totalEarned = 50;
      wallet.withdrawableBalance = 50;
      wallet.transactions.push({
        type: 'credit',
        amount: 50,
        description: '🎁 Welcome Signup Bonus ₹50',
        date: new Date(),
      });
      await wallet.save();
    }
    const activePlans = await ActivePlan.find({ userId: req.user._id, isComplete: false });
    const totalInvested = (await ActivePlan.find({ userId: req.user._id })).reduce((acc, p) => acc + p.investedAmount, 0);

    res.json({
      user,
      walletBalance: wallet ? wallet.balance : 50,
      totalEarned: wallet ? wallet.totalEarned : 50,
      totalWithdrawn: wallet ? wallet.totalWithdrawn : 0,
      activePlansCount: activePlans.length,
      totalInvested,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

module.exports = router;
