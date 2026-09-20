const crypto = require('crypto');
const Wallet = require('../models/Wallet');
const PaymentOrder = require('../models/PaymentOrder');

const UPI_ID = process.env.UPI_ID || '79062276slic@slc';
const BRAND_NAME = process.env.BRAND_NAME || 'Solar Wealth';

// 1. Create a dynamic UPI payment request
exports.createUpiOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 10) {
      return res.status(400).json({ message: 'Minimum recharge amount is ₹10' });
    }

    // Generate unique dynamic Order ID
    const orderId = 'SW' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Construct universal NPCI compliant UPI URL
    // NOTE: 'tr' parameter is strictly for merchant accounts; passing 'tr' for P2P causes PhonePe/GPay to throw "Technical Glitch"
    const encodedBrand = encodeURIComponent(BRAND_NAME);
    const encodedNote = encodeURIComponent('SolarWealth');
    const amountStr = numAmount % 1 === 0 ? numAmount.toString() : numAmount.toFixed(2);

    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodedBrand}&am=${amountStr}&cu=INR&tn=${encodedNote}`;
    const phonepeUrl = `phonepe://pay?pa=${UPI_ID}&pn=${encodedBrand}&am=${amountStr}&cu=INR&tn=${encodedNote}`;
    const gpayUrl = `tez://upi/pay?pa=${UPI_ID}&pn=${encodedBrand}&am=${amountStr}&cu=INR&tn=${encodedNote}`;
    const paytmUrl = `paytmmp://pay?pa=${UPI_ID}&pn=${encodedBrand}&am=${amountStr}&cu=INR&tn=${encodedNote}`;

    // Save order in database
    await PaymentOrder.create({
      userId: req.user._id,
      orderId,
      amount: numAmount,
      upiId: UPI_ID,
      brandName: BRAND_NAME,
      status: 'pending',
    });

    res.json({
      success: true,
      orderId,
      amount: numAmount,
      upiId: UPI_ID,
      brandName: BRAND_NAME,
      upiUrl,
      phonepeUrl,
      gpayUrl,
      paytmUrl,
    });
  } catch (error) {
    console.error('Create UPI Order error:', error);
    res.status(500).json({ message: 'Could not create UPI order: ' + error.message });
  }
};

// 2. Submit UTR / Reference Number after payment
exports.submitUtr = async (req, res) => {
  try {
    const { orderId, utr } = req.body;

    if (!orderId || !utr || utr.trim().length < 6) {
      return res.status(400).json({ message: 'Please enter a valid 12-digit UPI UTR / Transaction Reference Number' });
    }

    const order = await PaymentOrder.findOne({ orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'verified') {
      return res.status(400).json({ message: 'This order is already verified and credited' });
    }

    // Check if this UTR was already used
    const existingUtr = await PaymentOrder.findOne({ utr: utr.trim(), status: 'verified' });
    if (existingUtr) {
      return res.status(400).json({ message: 'This UTR has already been credited to another account' });
    }

    order.utr = utr.trim();
    order.status = 'verified'; // Auto-verify and credit to wallet
    order.verifiedAt = new Date();
    await order.save();

    // Credit wallet immediately
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (wallet) {
      wallet.balance += order.amount;
      wallet.recharged += order.amount;
      wallet.transactions.push({
        type: 'credit',
        amount: order.amount,
        description: `Solar Wallet Recharge via UPI (UTR: ${order.utr})`,
        date: new Date(),
      });
      await wallet.save();
    }

    res.json({
      success: true,
      message: `₹${order.amount.toLocaleString('en-IN')} successfully added to your wallet!`,
      balance: wallet?.balance || order.amount,
    });
  } catch (error) {
    console.error('Submit UTR error:', error);
    res.status(500).json({ message: 'Failed to verify transaction: ' + error.message });
  }
};

// 3. Fallback for Razorpay order (if still called anywhere)
exports.createOrder = exports.createUpiOrder;
exports.verifyPayment = exports.submitUtr;
