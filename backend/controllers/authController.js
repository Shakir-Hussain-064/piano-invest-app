const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey2024investmentapp', { expiresIn: '30d' });
};

exports.signup = async (req, res) => {
  try {
    const { email, password, name, referralCode } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const cleanName = (name || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists. Please Sign In.' });
    }

    let referredBy = null;
    let hasValidReferral = false;

    if (referralCode && referralCode.trim()) {
      const cleanRef = referralCode.trim().toUpperCase();
      const referrer = await User.findOne({ referralCode: cleanRef });
      if (referrer) {
        referredBy = referrer.referralCode;
        hasValidReferral = true;
      } else {
        return res.status(400).json({ message: `Referral code "${cleanRef}" is invalid. Please remove it or enter a valid code.` });
      }
    }

    // Generate unique referral code
    const uniqueRef = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const user = await User.create({
      email: cleanEmail,
      password: cleanPassword,
      name: cleanName || cleanEmail.split('@')[0],
      referralCode: uniqueRef,
      referredBy,
    });

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
    res.status(500).json({ message: error.message || 'Server error during signup. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ message: 'Please enter both email and password' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !(await user.matchPassword(cleanPassword))) {
      return res.status(401).json({ message: 'Invalid email or password. Please check your credentials.' });
    }

    // Self-healing: ensure wallet always exists
    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        userId: user._id,
        balance: 0,
        recharged: 0,
        totalEarned: 0,
        withdrawableBalance: 0,
        totalWithdrawn: 0,
        transactions: [],
      });
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
    res.status(500).json({ message: error.message || 'Server error during login. Please try again.' });
  }
};
