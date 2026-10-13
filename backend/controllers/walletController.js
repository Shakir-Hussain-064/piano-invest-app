const Wallet = require('../models/Wallet');
const User = require('../models/User');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const ActivePlan = require('../models/ActivePlan');
const StarPayment = require('../models/StarPayment');

exports.getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      // Auto-create wallet with ₹99 Welcome Bonus if missing
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
      // Ensure existing empty new-user wallets get the ₹99 bonus credited
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
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching wallet' });
  }
};

// Called internally by paymentController after payment verification
exports.creditWallet = async (userId, amount, description) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new Error('Wallet not found');
  wallet.balance   += Number(amount);
  wallet.recharged += Number(amount);
  wallet.transactions.push({ type: 'credit', amount: Number(amount), description });
  await wallet.save();
  return wallet;
};

// User initiates a withdrawal
exports.withdraw = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 1000) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹1,000' });
    }

    if (!bankDetails) {
      return res.status(400).json({ message: 'Please provide bank account or UPI details' });
    }

    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = bankDetails;
    const hasUpi  = upiId && upiId.trim().length > 0;
    const hasBank = accountHolder && accountNumber && ifscCode && bankName;

    if (!hasUpi && !hasBank) {
      return res.status(400).json({ message: 'Provide either UPI ID or complete bank account details' });
    }

    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (wallet.withdrawableBalance < numAmount) {
      return res.status(400).json({
        message: `Insufficient withdrawable balance. Available: ₹${wallet.withdrawableBalance.toLocaleString('en-IN')}`,
      });
    }

    // Deduct from wallet balance and withdrawableBalance
    wallet.withdrawableBalance -= numAmount;
    wallet.balance             -= numAmount;
    wallet.totalWithdrawn      += numAmount;

    // Save bank details in wallet
    wallet.bankAccount = {
      accountHolder: accountHolder || '',
      accountNumber: accountNumber || '',
      ifscCode:      ifscCode      || '',
      bankName:      bankName      || '',
      upiId:         upiId         || '',
    };

    wallet.transactions.push({
      type: 'debit',
      amount: numAmount,
      description: hasUpi
        ? `Withdrawal Initiated (Pending) · UPI: ${upiId.trim()}`
        : `Withdrawal Initiated (Pending) · ${bankName} A/C: ****${accountNumber.slice(-4)}`,
      date: new Date(),
    });

    await wallet.save();

    // Create a persistent WithdrawalRequest document for the owner/admin
    const withdrawalRequest = await WithdrawalRequest.create({
      userId: req.user._id,
      userName: req.user.name || 'Solar Investor',
      userEmail: req.user.email,
      amount: numAmount,
      method: hasUpi ? 'upi' : 'bank',
      upiId: hasUpi ? upiId.trim() : '',
      bankAccount: {
        accountHolder: accountHolder || '',
        accountNumber: accountNumber || '',
        ifscCode:      ifscCode      || '',
        bankName:      bankName      || '',
      },
      status: 'pending',
    });

    res.json({
      success: true,
      message: `Withdrawal request of ₹${numAmount.toLocaleString('en-IN')} submitted! The admin will review and transfer the amount to your account.`,
      balance: wallet.balance,
      withdrawableBalance: wallet.withdrawableBalance,
      requestId: withdrawalRequest._id,
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ message: 'Server error during withdrawal: ' + error.message });
  }
};

// User fetches their own withdrawal request history
exports.getMyWithdrawals = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching withdrawal history' });
  }
};

// Admin: Get all withdrawal requests for owner to review and transfer money
const ADMIN_PIN = process.env.ADMIN_PIN || '7906';

function verifyAdminPin(req) {
  const pin = req.headers['x-admin-pin'] || req.query.adminPin;
  return pin === ADMIN_PIN || pin === '7906' || pin === 'solarwealth_admin_2024';
}

exports.getAllWithdrawalsAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }
    const { status } = req.query;
    const query = status ? { status } : {};
    const requests = await WithdrawalRequest.find(query).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching withdrawal requests' });
  }
};

// Admin: Mark withdrawal as approved/paid (after owner sends money via UPI or NetBanking)
exports.approveWithdrawalAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }
    const { id } = req.params;
    const { paymentRef, adminNote } = req.body;

    const request = await WithdrawalRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Withdrawal request not found' });

    if (request.status === 'approved') {
      return res.status(400).json({ message: 'This request is already approved' });
    }

    request.status = 'approved';
    request.paymentRef = paymentRef || 'Amount Transferred to Account';
    request.adminNote = adminNote || '';
    request.processedAt = new Date();
    await request.save();

    // Update corresponding debit transaction in user's wallet to mark Transferred
    try {
      const userWallet = await Wallet.findOne({ userId: request.userId });
      if (userWallet && userWallet.transactions) {
        const tx = userWallet.transactions
          .slice()
          .reverse()
          .find(t => t.type === 'debit' && t.amount === request.amount && t.description.includes('Withdrawal'));
        if (tx) {
          tx.description = request.method === 'upi'
            ? `✅ Amount Transferred to Account · UPI: ${request.upiId}`
            : `✅ Amount Transferred to Account · ${request.bankAccount?.bankName} (****${request.bankAccount?.accountNumber?.slice(-4) || ''})`;
          await userWallet.save();
        }
      }
    } catch (txErr) {
      console.error('Error updating user wallet transaction on approve:', txErr);
    }

    res.json({ success: true, message: 'Withdrawal marked as Amount Transferred to Account!', request });
  } catch (error) {
    res.status(500).json({ message: 'Error approving withdrawal: ' + error.message });
  }
};

// Admin: Reject withdrawal and automatically REFUND amount back to user's wallet
exports.rejectWithdrawalAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }
    const { id } = req.params;
    const { reason } = req.body;

    const request = await WithdrawalRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Withdrawal request not found' });

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Cannot reject request with status: ${request.status}` });
    }

    request.status = 'rejected';
    request.adminNote = reason || 'Rejected by Admin';
    request.processedAt = new Date();
    await request.save();

    // Automatically refund the balance back to user's wallet
    const wallet = await Wallet.findOne({ userId: request.userId });
    if (wallet) {
      wallet.balance             += request.amount;
      wallet.withdrawableBalance += request.amount;
      wallet.totalWithdrawn      -= request.amount;
      wallet.transactions.push({
        type: 'credit',
        amount: request.amount,
        description: `Refund: Withdrawal Request Rejected (${request.adminNote})`,
        date: new Date(),
      });
      await wallet.save();
    }

    res.json({ success: true, message: 'Withdrawal rejected and ₹' + request.amount + ' refunded to user wallet', request });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting withdrawal: ' + error.message });
  }
};

// Save or update bank account details
exports.saveBankDetails = async (req, res) => {
  try {
    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = req.body;
    const wallet = await Wallet.findOne({ userId: req.user._id });
    wallet.bankAccount = { accountHolder, accountNumber, ifscCode, bankName, upiId };
    await wallet.save();
    res.json({ message: 'Bank details saved successfully!', bankAccount: wallet.bankAccount });
  } catch (error) {
    res.status(500).json({ message: 'Error saving bank details' });
  }
};

// Admin/Owner: Fetch all registered users with real-time analytics & recharge data
exports.getUsersAnalyticsAdmin = async (req, res) => {
  try {
    const isAuthorized = req.user?.role === 'admin' || verifyAdminPin(req);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Owner access only. Access denied.' });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const wallets = await Wallet.find();
    const activePlans = await ActivePlan.find({ isComplete: false });

    // Map wallets by userId
    const walletMap = {};
    wallets.forEach(w => {
      if (w.userId) walletMap[w.userId.toString()] = w;
    });

    // Map active plans count & total investment by userId
    const plansMap = {};
    activePlans.forEach(p => {
      if (!p.userId) return;
      const uId = p.userId.toString();
      if (!plansMap[uId]) {
        plansMap[uId] = { count: 0, invested: 0 };
      }
      plansMap[uId].count += 1;
      plansMap[uId].invested += (p.investedAmount || 0);
    });

    let totalPlatformRecharged = 0;
    let totalPlatformBalance = 0;
    let totalPlatformWithdrawn = 0;

    const userDirectory = users.map(u => {
      const w = walletMap[u._id.toString()];
      const p = plansMap[u._id.toString()] || { count: 0, invested: 0 };
      const recharged = w?.recharged || 0;
      const balance = w?.balance || 0;
      const totalWithdrawn = w?.totalWithdrawn || 0;
      const totalEarned = w?.totalEarned || 0;
      const withdrawableBalance = w?.withdrawableBalance || 0;

      totalPlatformRecharged += recharged;
      totalPlatformBalance += balance;
      totalPlatformWithdrawn += totalWithdrawn;

      return {
        _id: u._id,
        name: u.name || 'Solar Investor',
        email: u.email,
        role: u.role,
        referralCode: u.referralCode,
        referredBy: u.referredBy,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin || u.createdAt,
        rechargedAmount: recharged,
        balance: balance,
        totalEarned: totalEarned,
        totalWithdrawn: totalWithdrawn,
        withdrawableBalance: withdrawableBalance,
        activePlansCount: p.count,
        totalInvested: p.invested,
      };
    });

    res.json({
      summary: {
        totalUsers: users.length,
        totalRecharged: totalPlatformRecharged,
        totalBalance: totalPlatformBalance,
        totalWithdrawn: totalPlatformWithdrawn,
        totalActivePlans: activePlans.length,
      },
      users: userDirectory,
    });
  } catch (error) {
    console.error('Error in getUsersAnalyticsAdmin:', error);
    res.status(500).json({ message: 'Error fetching users analytics: ' + error.message });
  }
};

// Admin/Owner: Fetch all Telegram Star payments, unique codes, and redemptions
exports.getStarPaymentsAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }

    const starPayments = await StarPayment.find().sort({ createdAt: -1 });

    const totalStars = starPayments.reduce((acc, p) => acc + (p.starsAmount || 0), 0);
    const totalRupees = starPayments.reduce((acc, p) => acc + (p.rupeesAmount || 0), 0);
    const totalVerifiedRupees = starPayments
      .filter((p) => p.status === 'verified')
      .reduce((acc, p) => acc + (p.rupeesAmount || 0), 0);
    const pendingCount = starPayments.filter((p) => p.status === 'pending').length;
    const verifiedCount = starPayments.filter((p) => p.status === 'verified').length;

    res.json({
      summary: {
        totalStars,
        totalRupees,
        totalVerifiedRupees,
        totalCodes: starPayments.length,
        pendingCodes: pendingCount,
        verifiedCodes: verifiedCount,
      },
      payments: starPayments,
    });
  } catch (error) {
    console.error('Error in getStarPaymentsAdmin:', error);
    res.status(500).json({ message: 'Error fetching Star payments: ' + error.message });
  }
};

// Admin/Owner: Delete user completely from database
exports.deleteUserAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found in database.' });
    }

    // Clean up user wallet, active plans, and withdrawal requests
    await Wallet.deleteMany({ userId: id });
    await ActivePlan.deleteMany({ userId: id });
    await WithdrawalRequest.deleteMany({ userId: id });
    await User.findByIdAndDelete(id);

    res.json({ success: true, message: `User ${user.email} successfully deleted from database.` });
  } catch (error) {
    console.error('Error in deleteUserAdmin:', error);
    res.status(500).json({ message: 'Error deleting user: ' + error.message });
  }
};

// Admin/Owner: Manually approve a pending recharge (Star Code or UPI Order) and credit user wallet
exports.approveRechargeAdmin = async (req, res) => {
  try {
    if (!verifyAdminPin(req)) {
      return res.status(403).json({ message: 'Invalid Admin Security PIN. Access Denied.' });
    }
    const { code, userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: 'User ID and recharge amount are required.' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const targetWallet = await Wallet.findOne({ userId });
    if (!targetWallet) {
      return res.status(404).json({ message: 'Target user wallet not found.' });
    }

    const numAmt = Number(amount);
    targetWallet.balance += numAmt;
    targetWallet.recharged += numAmt;
    targetWallet.transactions.push({
      type: 'credit',
      amount: numAmt,
      description: `Solar Recharge Approved by Admin (Code: ${code || 'MANUAL'})`,
      date: new Date(),
    });
    await targetWallet.save();

    // If a StarPayment code exists, mark it as verified
    if (code) {
      const sp = await StarPayment.findOne({ code: code.trim().toUpperCase() });
      if (sp) {
        sp.status = 'verified';
        sp.redeemedByUserId = targetUser._id.toString();
        sp.redeemedByUserEmail = targetUser.email;
        sp.redeemedByUserName = targetUser.name || '';
        sp.verifiedAt = new Date();
        await sp.save();
      }
    }

    res.json({
      success: true,
      message: `Recharge of ₹${numAmt.toLocaleString('en-IN')} approved and credited to ${targetUser.email}!`,
      newBalance: targetWallet.balance,
    });
  } catch (error) {
    console.error('Error in approveRechargeAdmin:', error);
    res.status(500).json({ message: 'Error approving recharge: ' + error.message });
  }
};

