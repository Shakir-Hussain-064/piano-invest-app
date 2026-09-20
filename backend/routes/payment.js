const express = require('express');
const router = express.Router();
const { createUpiOrder, submitUtr, createOrder, verifyPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// UPI dynamic payment endpoints
router.post('/create-order', protect, createUpiOrder);
router.post('/create-upi', protect, createUpiOrder);
router.post('/submit-utr', protect, submitUtr);
router.post('/verify', protect, submitUtr);

module.exports = router;
