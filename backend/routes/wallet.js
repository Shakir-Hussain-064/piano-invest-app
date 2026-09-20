const express = require('express');
const router = express.Router();
const { getWallet, withdraw, saveBankDetails } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/',             protect, getWallet);
router.post('/withdraw',    protect, withdraw);
router.post('/bank-details',protect, saveBankDetails);

module.exports = router;
