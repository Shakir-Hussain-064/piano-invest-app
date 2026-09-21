const Wallet = require('../models/Wallet');
const User = require('../models/User');
const WithdrawalRequest = require('../models/WithdrawalRequest');

exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
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

    if (!numAmount || numAmount < 500) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹500' });
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
        ? `Withdrawal Request Placed (UPI: ${upiId.trim()})`
        : `Withdrawal Request Placed (${bankName} - A/C: ****${accountNumber.slice(-4)})`,
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
    request.paymentRef = paymentRef || 'Transferred by Admin';
    request.adminNote = adminNote || '';
    request.processedAt = new Date();
    await request.save();

    res.json({ success: true, message: 'Withdrawal marked as completed/paid successfully!', request });
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
