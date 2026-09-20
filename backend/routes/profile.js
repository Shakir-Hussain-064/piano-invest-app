const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const wallet = await Wallet.findOne({ userId: req.user._id });
    const activePlans = await ActivePlan.find({ userId: req.user._id, isComplete: false });
    const totalInvested = (await ActivePlan.find({ userId: req.user._id })).reduce((acc, p) => acc + p.investedAmount, 0);

    res.json({
      user,
      walletBalance: wallet ? wallet.balance : 0,
      totalEarned: wallet ? wallet.totalEarned : 0,
      totalWithdrawn: wallet ? wallet.totalWithdrawn : 0,
      activePlansCount: activePlans.length,
      totalInvested,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

module.exports = router;
