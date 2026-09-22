const Wallet = require('../models/Wallet');
const PaymentOrder = require('../models/PaymentOrder');

// BharatPe VPA - used to receive payments
const PAYEE_VPA  = process.env.UPI_ID || 'BHARATPE2V0A0L7H9O51145@unitype';
const BRAND_NAME = process.env.BRAND_NAME || 'Solar Wealth';

// 1. Create a clean UPI payment order (no bpsign - causes UPI Risk warning)
exports.createUpiOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount < 500) {
      return res.status(400).json({ message: 'Minimum recharge amount is ₹500' });
    }

    const orderId  = 'SW' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const amtStr   = numAmount % 1 === 0 ? numAmount.toString() : numAmount.toFixed(2);

    // Clean NPCI-standard UPI deep link — NO bpsign, NO tr
    // bpsign causes "UPI Risk / Suspicious" warning on PhonePe & GPay for non-registered merchant VPAs
    const upiUrl     = `upi://pay?pa=${PAYEE_VPA}&pn=${encodeURIComponent(BRAND_NAME)}&am=${amtStr}&cu=INR`;
    const phonepeUrl = `phonepe://pay?pa=${PAYEE_VPA}&pn=${encodeURIComponent(BRAND_NAME)}&am=${amtStr}&cu=INR`;
    const gpayUrl    = `tez://upi/pay?pa=${PAYEE_VPA}&pn=${encodeURIComponent(BRAND_NAME)}&am=${amtStr}&cu=INR`;
    const paytmUrl   = `paytmmp://pay?pa=${PAYEE_VPA}&pn=${encodeURIComponent(BRAND_NAME)}&am=${amtStr}&cu=INR`;

    await PaymentOrder.create({
      userId: req.user._id,
      orderId,
      amount: numAmount,
      upiId: PAYEE_VPA,
      brandName: BRAND_NAME,
      status: 'pending',
    });

    res.json({
      success: true,
      orderId,
      amount: numAmount,
      upiUrl,
      phonepeUrl,
      gpayUrl,
      paytmUrl,
    });
  } catch (error) {
    console.error('createUpiOrder error:', error);
    res.status(500).json({ message: 'Could not create payment order: ' + error.message });
  }
};

// 2. Submit UTR / Reference Number after payment
exports.submitUtr = async (req, res) => {
  try {
    const { orderId, utr } = req.body;

    if (!orderId || !utr) {
      return res.status(400).json({ message: 'Order ID and UTR Number are required' });
    }

    // Clean and normalize UTR (remove spaces, uppercase)
    const cleanUtr = utr.trim().replace(/\s+/g, '').toUpperCase();

    if (cleanUtr.length < 10) {
      return res.status(400).json({
        message: 'Please enter a valid 12-digit UPI UTR / Transaction Reference Number (min 10 characters)',
      });
    }

    const order = await PaymentOrder.findOne({ orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or unauthorized' });
    }

    if (order.status === 'verified') {
      return res.status(400).json({ message: 'This recharge order is already verified and credited to your wallet.' });
    }

    // ── STRICT ONE-TIME USE CHECK ──────────────────────────────
    // 1. Check if this UTR has EVER been verified for ANY order in the database
    const existingVerifiedOrder = await PaymentOrder.findOne({
      utr: cleanUtr,
      status: 'verified',
    });

    if (existingVerifiedOrder) {
      return res.status(400).json({
        message: '⚠️ This UTR has already been used and credited. Each UTR is one-time use only!',
      });
    }

    // 2. Double-check if any wallet transaction in the database already recorded this UTR
    const existingWalletTx = await Wallet.findOne({
      'transactions.description': { $regex: cleanUtr, $options: 'i' },
    });

    if (existingWalletTx) {
      return res.status(400).json({
        message: '⚠️ This UTR has already been credited in a previous transaction. Duplicate use is not allowed!',
      });
    }

    order.utr = cleanUtr;
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
        description: `Solar Wallet Recharge via UPI (UTR: ${cleanUtr})`,
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
    // Handle MongoDB duplicate key error (E11000) gracefully
    if (error.code === 11000) {
      return res.status(400).json({
        message: '⚠️ Duplicate UTR detected: This UTR has already been used and cannot be submitted again.',
      });
    }
    res.status(500).json({ message: 'Failed to verify transaction: ' + error.message });
  }
};

// 3. Fallback for Razorpay order (if still called anywhere)
exports.createOrder = exports.createUpiOrder;
exports.verifyPayment = exports.submitUtr;
