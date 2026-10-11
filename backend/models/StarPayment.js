const mongoose = require('mongoose');

const starPaymentSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  planId: { type: String, default: '' },
  planName: { type: String, default: '' },
  appUserId: { type: String, default: '' },
  telegramUserId: { type: String, required: true },
  telegramUsername: { type: String, default: '' },
  starsAmount: { type: Number, required: true },
  rupeesAmount: { type: Number, required: true },
  telegramPaymentId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'verified', 'expired'], default: 'pending' },
  verifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StarPayment', starPaymentSchema);
