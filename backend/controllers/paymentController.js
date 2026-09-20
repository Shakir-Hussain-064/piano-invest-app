const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../models/Wallet');

// Lazy-initialize Razorpay so server starts even without keys set yet
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('REPLACE')) {
    throw new Error('Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
  }
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// Create a Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({ message: 'Minimum recharge amount is ₹100' });
    }

    let razorpay;
    try {
      razorpay = getRazorpay();
    } catch (e) {
      return res.status(503).json({ message: e.message });
    }

    const options = {
      amount:   Number(amount) * 100, // Razorpay works in paise
      currency: 'INR',
      receipt:  `receipt_${req.user._id}_${Date.now()}`,
      notes: {
        userId:    req.user._id.toString(),
        userEmail: req.user.email,
      },
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay order error:', error.message);
    res.status(500).json({ message: 'Failed to create payment order: ' + error.message });
  }
};

// Verify payment and credit wallet
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    let razorpay;
    try {
      razorpay = getRazorpay();
    } catch (e) {
      return res.status(503).json({ message: e.message });
    }

    // Verify signature using HMAC SHA256
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    // Credit wallet — recharge money goes to balance but NOT withdrawableBalance
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const creditAmount = Number(amount) / 100; // convert paise back to rupees
    wallet.balance   += creditAmount;
    wallet.recharged += creditAmount;           // track recharged separately (non-withdrawable)
    wallet.transactions.push({
      type:        'credit',
      amount:      creditAmount,
      description: `Wallet Recharge via Razorpay (${razorpay_payment_id})`,
    });
    await wallet.save();

    res.json({
      success:   true,
      message:   `₹${creditAmount.toLocaleString('en-IN')} added to your wallet successfully!`,
      balance:   wallet.balance,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ message: 'Payment verification failed' });
  }
};
