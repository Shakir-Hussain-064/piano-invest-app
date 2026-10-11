const express = require('express');
const router = express.Router();
const {
  createTelegramOrder,
  verifyStarCode,
  createUpiOrder,
  submitUtr,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Telegram Stars payment endpoints
router.post('/telegram-order', protect, createTelegramOrder);
router.post('/verify-star-code', protect, verifyStarCode);

// UPI dynamic payment endpoints (fallback)
router.post('/create-order', protect, createUpiOrder);
router.post('/create-upi', protect, createUpiOrder);
router.post('/submit-utr', protect, submitUtr);
router.post('/verify', protect, submitUtr);

module.exports = router;
