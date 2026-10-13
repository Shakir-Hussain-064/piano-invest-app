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
  getStarPaymentsAdmin,
  deleteUserAdmin,
  approveRechargeAdmin,
  rejectRechargeAdmin,
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',                      protect, getWallet);
router.post('/withdraw',             protect, withdraw);
router.get('/my-withdrawals',        protect, getMyWithdrawals);
router.post('/bank-details',         protect, saveBankDetails);

// Admin routes to review and manage withdrawal requests, recharge approvals, & user database
router.get('/admin/withdrawals',             protect, getAllWithdrawalsAdmin);
router.post('/admin/withdrawals/:id/approve', protect, approveWithdrawalAdmin);
router.post('/admin/withdrawals/:id/reject',  protect, rejectWithdrawalAdmin);
router.get('/admin/users-analytics',         protect, getUsersAnalyticsAdmin);
router.get('/admin/star-payments',           protect, getStarPaymentsAdmin);
router.delete('/admin/users/:id',            protect, deleteUserAdmin);
router.post('/admin/recharge/approve',       protect, approveRechargeAdmin);
router.post('/admin/recharge/reject',        protect, rejectRechargeAdmin);

module.exports = router;
