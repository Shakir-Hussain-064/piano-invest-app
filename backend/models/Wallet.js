const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['credit', 'debit', 'earning'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  date: { type: Date, default: Date.now },
});

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },          // total spendable balance (recharge + earnings)
  recharged: { type: Number, default: 0 },         // total money ever recharged (non-withdrawable)
  totalEarned: { type: Number, default: 0 },       // total earned from plans (withdrawable)
  withdrawableBalance: { type: Number, default: 0 }, // only earned money available to withdraw
  totalWithdrawn: { type: Number, default: 0 },
  bankAccount: {
    accountHolder: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode:      { type: String, default: '' },
    bankName:      { type: String, default: '' },
    upiId:         { type: String, default: '' },
  },
  transactions: [transactionSchema],
});

module.exports = mongoose.model('Wallet', walletSchema);
