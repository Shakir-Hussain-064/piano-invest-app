const cron = require('node-cron');
const ActivePlan = require('../models/ActivePlan');
const Wallet = require('../models/Wallet');

/**
 * getIstDayNumber:
 * Returns the calendar day number (since Unix epoch) in Indian Standard Time (Asia/Kolkata, UTC+5:30).
 * Midnight 00:00:00 IST is the boundary where the day number increments by 1.
 */
function getIstDayNumber(d) {
  const date = d ? new Date(d) : new Date();
  const istTime = new Date(date.getTime() + (330 * 60 * 1000));
  return Math.floor(istTime.getTime() / (24 * 60 * 60 * 1000));
}

/**
 * reconcileDailyEarningsForUser:
 * Reconciles any daily earnings that became due at 00:00 midnight IST.
 * - Idempotent: Can be called multiple times on the same day without duplicate crediting.
 * - Catch-up safe: If server was asleep at midnight, credits all missed midnights when user logs in/views page.
 * - Never credits on the purchase day (day 0), only after midnight passes.
 */
async function reconcileDailyEarningsForUser(userId) {
  if (!userId) return { creditedDays: 0, creditedAmount: 0 };
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return { creditedDays: 0, creditedAmount: 0 };

  const now = new Date();
  const todayIstDay = getIstDayNumber(now);

  const activePlans = await ActivePlan.find({ userId, isComplete: false });
  if (!activePlans.length) return { creditedDays: 0, creditedAmount: 0 };

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) return { creditedDays: 0, creditedAmount: 0 };

  let totalCreditedDays = 0;
  let totalCreditedAmount = 0;
  let walletModified = false;

  for (const plan of activePlans) {
    const lastCreditedDay = plan.lastCreditDate
      ? getIstDayNumber(plan.lastCreditDate)
      : getIstDayNumber(plan.startDate);

    const daysDue = Math.max(0, todayIstDay - lastCreditedDay);
    if (daysDue <= 0) continue;

    const daysRemaining = Math.max(0, plan.totalDays - plan.daysCompleted);
    const daysToCredit = Math.min(daysDue, daysRemaining);
    if (daysToCredit <= 0) {
      if (plan.daysCompleted >= plan.totalDays || plan.earnedSoFar >= plan.totalReturn) {
        plan.isComplete = true;
        await plan.save();
      }
      continue;
    }

    for (let i = 1; i <= daysToCredit; i++) {
      const dayNum = plan.daysCompleted + 1;
      const earn = plan.dailyEarn;

      plan.daysCompleted = dayNum;
      plan.earnedSoFar += earn;

      wallet.balance += earn;
      wallet.totalEarned += earn;
      wallet.withdrawableBalance = (wallet.withdrawableBalance || 0) + earn;
      wallet.transactions.push({
        type: 'earning',
        amount: earn,
        description: `Daily earning — ${plan.planName} (Day ${dayNum}/${plan.totalDays})`,
        date: new Date(now.getTime() - ((daysToCredit - i) * 60 * 1000)),
      });

      totalCreditedDays += 1;
      totalCreditedAmount += earn;
      walletModified = true;

      if (plan.daysCompleted >= plan.totalDays || plan.earnedSoFar >= plan.totalReturn) {
        plan.earnedSoFar = plan.totalReturn;
        plan.isComplete = true;
        break;
      }
    }

    plan.lastCreditDate = now;
    await plan.save();
  }

  if (walletModified) {
    await wallet.save();
    console.log(`[EARNINGS] Reconciled userId=${userId}: +${totalCreditedDays} days, +₹${totalCreditedAmount}`);
  }

  return { creditedDays: totalCreditedDays, creditedAmount: totalCreditedAmount };
}

/**
 * reconcileAllDailyEarnings:
 * Loops through all active plans in the system and reconciles them.
 */
async function reconcileAllDailyEarnings() {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    console.log('[CRON] Skip reconciliation: Mongo not connected yet');
    return { skipped: true };
  }
  const now = new Date();
  console.log('[CRON] reconcileAllDailyEarnings triggered at', now.toISOString());
  try {
    const activePlans = await ActivePlan.find({ isComplete: false });
    const userIds = [...new Set(activePlans.map(p => p.userId.toString()))];

    let totalDays = 0;
    let totalAmt = 0;

    for (const uId of userIds) {
      const res = await reconcileDailyEarningsForUser(uId);
      totalDays += res.creditedDays;
      totalAmt += res.creditedAmount;
    }

    console.log(`[CRON] Done: ${userIds.length} users checked, credited ${totalDays} total days, ₹${totalAmt}`);
    return { processedUsers: userIds.length, totalDays, totalAmt };
  } catch (err) {
    console.error('[CRON] Error in reconcileAllDailyEarnings:', err);
    return { error: err.message };
  }
}

// ── Schedules ────────────────────────────────────────────────────────
// 1. Strictly at 00:00 Midnight IST (18:30 UTC)
cron.schedule('30 18 * * *', () => {
  console.log('[CRON] Midnight 00:00 IST reached. Running daily yield credit...');
  reconcileAllDailyEarnings();
}, {
  timezone: 'Asia/Kolkata'
});

// 2. Hourly heartbeat check (to guarantee any missed midnights are reconciled even if sleep occurred)
cron.schedule('0 * * * *', () => {
  reconcileAllDailyEarnings();
});

// 3. Catch-up immediately on boot (5 seconds after server start)
setTimeout(() => {
  console.log('[CRON] Boot-time reconciliation running...');
  reconcileAllDailyEarnings();
}, 5000);

console.log('[CRON] Daily earnings scheduler initialized (Midnight + Hourly + On-Demand)');

module.exports = {
  reconcileDailyEarningsForUser,
  reconcileAllDailyEarnings,
  creditDailyEarnings: reconcileAllDailyEarnings,
};
