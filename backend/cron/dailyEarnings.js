const cron = require('node-cron');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

/**
 * isSameDay — returns true if both dates fall on the same calendar day (IST)
 */
function isSameDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/**
 * creditDailyEarnings — core logic extracted so it can be called on demand too.
 * Runs through every active (isComplete: false) plan and credits one day's earning
 * IF that plan has NOT already been credited today.
 */
async function creditDailyEarnings() {
  const now = new Date();
  console.log('[CRON] creditDailyEarnings fired at', now.toISOString());

  try {
    const activePlans = await ActivePlan.find({ isComplete: false });
    let credited = 0;
    let skipped  = 0;

    for (const plan of activePlans) {
      // Skip if already credited today
      if (plan.lastCreditDate && isSameDay(plan.lastCreditDate, now)) {
        skipped++;
        continue;
      }

      const wallet = await Wallet.findOne({ userId: plan.userId });
      if (!wallet) continue;

      const earn = plan.dailyEarn;

      // Update plan
      plan.earnedSoFar   += earn;
      plan.daysCompleted += 1;
      plan.lastCreditDate = now;

      if (plan.daysCompleted >= plan.totalDays || plan.earnedSoFar >= plan.totalReturn) {
        plan.earnedSoFar = plan.totalReturn;
        plan.isComplete  = true;
      }

      await plan.save();

      // Update wallet
      wallet.balance             += earn;
      wallet.totalEarned         += earn;
      wallet.withdrawableBalance  = (wallet.withdrawableBalance || 0) + earn;
      wallet.transactions.push({
        type: 'earning',
        amount: earn,
        description: `Daily earning — ${plan.planName} (Day ${plan.daysCompleted}/${plan.totalDays})`,
        date: now,
      });
      await wallet.save();

      credited++;
      console.log(`[CRON] ✅ Credited ₹${earn} to userId=${plan.userId} | Plan: ${plan.planName} | Day ${plan.daysCompleted}/${plan.totalDays}`);
    }

    console.log(`[CRON] Done: credited=${credited}, already_done_today=${skipped}, total=${activePlans.length}`);
  } catch (err) {
    console.error('[CRON] Error in creditDailyEarnings:', err);
  }
}

// ── Schedule: every 6 hours so Render free tier can't miss it ──────────────
// Even if server was sleeping at midnight, it will catch up at 6am / 12pm / 6pm
// The isSameDay guard prevents double-credit within the same calendar day.
cron.schedule('0 */6 * * *', creditDailyEarnings);

// Also run once at startup (catches any missed credits if server just restarted)
setTimeout(creditDailyEarnings, 5000);

console.log('[CRON] Daily earnings scheduler initialized (every 6h + startup run)');

module.exports = { creditDailyEarnings };
