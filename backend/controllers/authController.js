const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey2024investmentapp', { expiresIn: '30d' });
};

exports.signup = async (req, res) => {
  try {
    const { email, password, name, referralCode, captchaVerified } = req.body;

    if (!captchaVerified) {
      return res.status(400).json({ message: 'Please complete the CAPTCHA verification' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    let referredBy = null;
    let hasValidReferral = false;

    if (referralCode && referralCode.trim()) {
      const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
      if (referrer) {
        referredBy = referrer.referralCode;
        hasValidReferral = true;
      } else {
        return res.status(400).json({ message: 'Invalid referral code entered. Please check or leave blank.' });
      }
    }

    const user = await User.create({ email, password, name, referredBy });

    // Initial wallet balance: ₹100 Welcome Bonus if signed up with valid referral code
    const initialBalance = hasValidReferral ? 100 : 0;
    const initialTransactions = hasValidReferral
      ? [{
          type: 'credit',
          amount: 100,
          description: `🎁 Welcome Bonus (Referred by ${referredBy})`,
          date: new Date(),
        }]
      : [];

    // Create wallet for user
    await Wallet.create({
      userId: user._id,
      balance: initialBalance,
      recharged: 0,
      totalEarned: 0,
      withdrawableBalance: 0,
      totalWithdrawn: 0,
      transactions: initialTransactions,
    });

    res.status(201).json({
      _id: user._id,
      email: user.email,
      name: user.name,
      referralCode: user.referralCode,
      welcomeBonus: hasValidReferral ? 100 : 0,
      token: generateToken(user._id),
      message: hasValidReferral
        ? 'Account created! ₹100 Welcome Bonus has been credited to your wallet.'
        : 'Account created successfully!',
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      referralCode: user.referralCode,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};
