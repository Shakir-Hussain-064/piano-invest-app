const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  upiId: {
    type: String,
    required: true,
  },
  brandName: {
    type: String,
    default: 'Solar Wealth',
  },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending',
  },
  utr: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  verifiedAt: {
    type: Date,
  },
});

// Enforce database-level uniqueness for verified UTRs so no UTR can ever be used twice
paymentOrderSchema.index(
  { utr: 1 },
  { unique: true, partialFilterExpression: { utr: { $gt: '' }, status: 'verified' } }
);

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
