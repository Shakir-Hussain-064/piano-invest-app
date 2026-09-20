const express = require('express');
const router = express.Router();
const { getPlans, buyPlan, getMyPlans } = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPlans);
router.post('/buy', protect, buyPlan);
router.get('/my', protect, getMyPlans);

module.exports = router;
