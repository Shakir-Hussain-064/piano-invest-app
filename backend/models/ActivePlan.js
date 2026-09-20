const mongoose = require('mongoose');

const activePlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  isVip: { type: Boolean, default: false },
  investedAmount: { type: Number, required: true },
  dailyEarn: { type: Number, required: true },
  totalReturn: { type: Number, required: true },
  earnedSoFar: { type: Number, default: 0 },
  daysCompleted: { type: Number, default: 0 },
  totalDays: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  lastCreditDate: { type: Date, default: null },
  isComplete: { type: Boolean, default: false },
});

module.exports = mongoose.model('ActivePlan', activePlanSchema);
