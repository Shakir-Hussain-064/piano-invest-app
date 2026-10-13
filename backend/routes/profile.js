const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        balance: 99,
        recharged: 0,
        totalEarned: 99,
        withdrawableBalance: 99,
        totalWithdrawn: 0,
        transactions: [{
          type: 'credit',
          amount: 99,
          description: '🎁 Welcome Signup Bonus ₹99',
          date: new Date(),
        }],
      });
    } else if (wallet.balance === 0 && (!wallet.transactions || wallet.transactions.length === 0)) {
      wallet.balance = 99;
      wallet.totalEarned = 99;
      wallet.withdrawableBalance = 99;
      wallet.transactions.push({
        type: 'credit',
        amount: 99,
        description: '🎁 Welcome Signup Bonus ₹99',
        date: new Date(),
      });
      await wallet.save();
    }
    const activePlans = await ActivePlan.find({ userId: req.user._id, isComplete: false });
    const totalInvested = (await ActivePlan.find({ userId: req.user._id })).reduce((acc, p) => acc + p.investedAmount, 0);

    res.json({
      user,
      walletBalance: wallet ? wallet.balance : 99,
      totalEarned: wallet ? wallet.totalEarned : 99,
      totalWithdrawn: wallet ? wallet.totalWithdrawn : 0,
      activePlansCount: activePlans.length,
      totalInvested,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

module.exports = router;
