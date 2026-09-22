const express = require('express');
const router = express.Router();
const {
  getWallet,
  withdraw,
  saveBankDetails,
  getMyWithdrawals,
  getAllWithdrawalsAdmin,
  approveWithdrawalAdmin,
  rejectWithdrawalAdmin,
  getUsersAnalyticsAdmin,
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',                      protect, getWallet);
router.post('/withdraw',             protect, withdraw);
router.get('/my-withdrawals',        protect, getMyWithdrawals);
router.post('/bank-details',         protect, saveBankDetails);

// Admin routes to review and manage withdrawal requests & user analytics
router.get('/admin/withdrawals',             protect, getAllWithdrawalsAdmin);
router.post('/admin/withdrawals/:id/approve', protect, approveWithdrawalAdmin);
router.post('/admin/withdrawals/:id/reject',  protect, rejectWithdrawalAdmin);
router.get('/admin/users-analytics',         protect, getUsersAnalyticsAdmin);

module.exports = router;
