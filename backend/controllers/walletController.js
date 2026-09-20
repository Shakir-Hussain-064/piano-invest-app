const Wallet = require('../models/Wallet');

exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching wallet' });
  }
};

// Called internally by paymentController after Razorpay verification
exports.creditWallet = async (userId, amount, description) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new Error('Wallet not found');
  wallet.balance   += Number(amount);
  wallet.recharged += Number(amount);
  wallet.transactions.push({ type: 'credit', amount: Number(amount), description });
  await wallet.save();
  return wallet;
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;

    if (!amount || Number(amount) < 500) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹500' });
    }

    // Bank/UPI validation
    if (!bankDetails) {
      return res.status(400).json({ message: 'Please provide bank account or UPI details' });
    }
    const { accountHolder, accountNumber, ifscCode, bankName, upiId } = bankDetails;

    // Either UPI or full bank account must be provided
    const hasUpi  = upiId && upiId.trim().length > 0;
    const hasBank = accountHolder && accountNumber && ifscCode && bankName;
    if (!hasUpi && !hasBank) {
      return res.status(400).json({ message: 'Provide either UPI ID or complete bank account details' });
    }

    const wallet = await Wallet.findOne({ userId: req.user._id });

    // Only earned money (from plans) can be withdrawn
    if (wallet.withdrawableBalance < Number(amount)) {
      return res.status(400).json({
        message: `Insufficient withdrawable balance. You can only withdraw earned money. Available: ₹${wallet.withdrawableBalance.toLocaleString('en-IN')}`,
      });
    }

    // Deduct from withdrawable balance AND overall balance
    wallet.withdrawableBalance -= Number(amount);
    wallet.balance             -= Number(amount);
    wallet.totalWithdrawn      += Number(amount);

    // Save bank details for future reference
    wallet.bankAccount = {
      accountHolder: accountHolder || '',
      accountNumber: accountNumber || '',
      ifscCode:      ifscCode      || '',
      bankName:      bankName      || '',
      upiId:         upiId         || '',
    };

    wallet.transactions.push({
      type: 'debit',
      amount: Number(amount),
      description: hasUpi
        ? `Withdrawal to UPI: ${upiId}`
        : `Withdrawal to ${bankName} ****${accountNumber.slice(-4)}`,
    });

    await wallet.save();

    res.json({
      message: `₹${Number(amount).toLocaleString('en-IN')} withdrawal request submitted! Processing in 1-3 business days.`,
      balance: wallet.balance,
      withdrawableBalance: wallet.withdrawableBalance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during withdrawal' });
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
