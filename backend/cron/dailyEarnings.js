const cron = require('node-cron');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

// Runs every day at midnight 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running daily earnings credit at midnight...');
  try {
    const activePlans = await ActivePlan.find({ isComplete: false });

    for (const plan of activePlans) {
      const wallet = await Wallet.findOne({ userId: plan.userId });
      if (!wallet) continue;

      const earn = plan.dailyEarn;
      plan.earnedSoFar += earn;
      plan.daysCompleted += 1;
      plan.lastCreditDate = new Date();

      if (plan.earnedSoFar >= plan.totalReturn) {
        plan.earnedSoFar = plan.totalReturn;
        plan.isComplete = true;
      }

      await plan.save();

      wallet.balance             += earn;
      wallet.totalEarned         += earn;
      wallet.withdrawableBalance += earn;   // earned money = withdrawable
      wallet.transactions.push({
        type: 'earning',
        amount: earn,
        description: `Daily earning from ${plan.planName} Plan`,
      });
      await wallet.save();

      console.log(`[CRON] Credited ₹${earn} to user ${plan.userId} for plan ${plan.planName}`);
    }

    console.log(`[CRON] Done. Processed ${activePlans.length} plans.`);
  } catch (err) {
    console.error('[CRON] Error:', err);
  }
});

console.log('[CRON] Daily earnings scheduler initialized');
