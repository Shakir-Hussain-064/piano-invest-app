const TelegramBot = require('node-telegram-bot-api');
const StarPayment = require('../models/StarPayment');
const { PLANS, STAR_RATE, findPlanById, findPlanByAmount } = require('../constants/plans');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8723665393:AAHbilt8olKbdZrBZfLIMTg2gfQuO6EikeY';

let bot = null;

function initBot() {
  if (!BOT_TOKEN) {
    console.error('[TELEGRAM BOT] ❌ BOT_TOKEN missing');
    return null;
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('[TELEGRAM BOT] ✅ Solar Wealth Bot initialized with polling');

  // Helper: Send plan invoice
  async function sendPlanInvoice(chatId, plan, appUserId = 'guest') {
    const payload = `plan_${plan.id}_${appUserId}_${Date.now()}`;
    const desc =
      `Buy ${plan.name}.\n` +
      `• Daily Yield: ₹${plan.dailyEarn.toLocaleString('en-IN')}/day\n` +
      `• Total Return: ₹${plan.totalReturn.toLocaleString('en-IN')} (over ${plan.totalDays} days)\n` +
      `• Wallet Value: ₹${plan.investedAmount.toLocaleString('en-IN')}\n\n` +
      `After payment, you will receive a unique code to add ₹${plan.investedAmount.toLocaleString('en-IN')} to your wallet.`;

    return bot.sendInvoice(
      chatId,
      `${plan.name} (₹${plan.investedAmount.toLocaleString('en-IN')})`,
      desc,
      payload,
      '', // provider_token empty for Telegram Stars
      'XTR', // Telegram Stars currency
      [{ label: plan.name, amount: plan.starsAmount }]
    );
  }

  // Helper: Send Plans Menu with interactive inline buttons
  async function sendPlansMenu(chatId, appUserId = 'guest') {
    let msg = `☀️ *SOLAR WEALTH — OFFICIAL INVESTMENT PLANS*\n\n`;
    msg += `Buy any plan using Telegram Stars ⭐. After payment, you'll get a *Unique Verification Code* to credit the exact plan amount to your app wallet.\n\n`;

    msg += `📋 *STANDARD PLANS (60 Days · 12x Return):*\n`;
    const standardPlans = PLANS.filter((p) => !p.isVip);
    standardPlans.forEach((p) => {
      msg += `• *${p.name}*: ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) → Earn ₹${p.dailyEarn}/day (Total: ₹${p.totalReturn.toLocaleString('en-IN')})\n`;
    });

    msg += `\n⚡ *VIP MEGA PLANS (High Yield):*\n`;
    const vipPlans = PLANS.filter((p) => p.isVip);
    vipPlans.forEach((p) => {
      msg += `• *${p.name}*: ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) → Earn ₹${p.dailyEarn}/day (Total: ₹${p.totalReturn.toLocaleString('en-IN')})\n`;
    });

    msg += `\n👇 *Select a plan below to buy with Telegram Stars:*`;

    // Inline buttons for Standard plans
    const standardButtons = standardPlans.map((p) => [
      {
        text: `${p.name} — ${p.starsAmount} ⭐ (₹${p.investedAmount.toLocaleString('en-IN')})`,
        callback_data: `buy_${p.id}_${appUserId}`,
      },
    ]);

    // Inline buttons for VIP plans
    const vipButtons = vipPlans.map((p) => [
      {
        text: `${p.name} — ${p.starsAmount} ⭐ (₹${p.investedAmount.toLocaleString('en-IN')})`,
        callback_data: `buy_${p.id}_${appUserId}`,
      },
    ]);

    return bot.sendMessage(chatId, msg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [...standardButtons, ...vipButtons],
      },
    });
  }

  // ── /start command ─────────────────────────────────────────
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match ? match[1] : null;

    if (!param) {
      return sendPlansMenu(chatId);
    }

    // Check if deep link is for a specific plan: plan_{planId}_{userId}
    if (param.startsWith('plan_')) {
      const parts = param.split('_');
      const planId = parts[1];
      const appUserId = parts.slice(2).join('_');
      const plan = findPlanById(planId);

      if (plan) {
        try {
          await sendPlanInvoice(chatId, plan, appUserId);
          return;
        } catch (err) {
          console.error('[TELEGRAM BOT] Invoice error for plan:', planId, err.message);
          return bot.sendMessage(chatId, `❌ Could not generate invoice for ${plan.name}. Please try again.`);
        }
      }
    }

    // Check if deep link is recharge_{stars}_{userId}
    if (param.startsWith('recharge_')) {
      const parts = param.split('_');
      const starsAmount = parseInt(parts[1]);
      const appUserId = parts.slice(2).join('_');
      const rupeesAmount = starsAmount * STAR_RATE;
      const matchedPlan = findPlanByAmount(rupeesAmount);

      try {
        if (matchedPlan) {
          await sendPlanInvoice(chatId, matchedPlan, appUserId);
        } else {
          await bot.sendInvoice(
            chatId,
            `Solar Wealth Recharge ₹${rupeesAmount.toLocaleString('en-IN')}`,
            `Recharge ₹${rupeesAmount.toLocaleString('en-IN')} to your Solar Wealth wallet using ${starsAmount} Stars.\n\nAfter payment, you will receive a unique verification code to enter in the app.`,
            `recharge_${appUserId}_${Date.now()}`,
            '',
            'XTR',
            [{ label: `₹${rupeesAmount.toLocaleString('en-IN')} Wallet Recharge`, amount: starsAmount }]
          );
        }
        return;
      } catch (err) {
        console.error('[TELEGRAM BOT] Recharge invoice error:', err.message);
      }
    }

    // Fallback: show plans menu
    return sendPlansMenu(chatId);
  });

  // ── /plans command ─────────────────────────────────────────
  bot.onText(/\/plans/, async (msg) => {
    return sendPlansMenu(msg.chat.id);
  });

  // ── Callback query handler for inline plan buttons ────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data || '';

    try {
      await bot.answerCallbackQuery(query.id);

      if (data.startsWith('buy_')) {
        const parts = data.split('_');
        const planId = parts[1];
        const appUserId = parts.slice(2).join('_') || 'guest';
        const plan = findPlanById(planId);

        if (!plan) {
          return bot.sendMessage(chatId, '❌ Plan not found. Please type /plans to view available plans.');
        }

        await sendPlanInvoice(chatId, plan, appUserId);
      }
    } catch (err) {
      console.error('[TELEGRAM BOT] Callback query error:', err.message);
    }
  });

  // ── Pre-checkout query - must answer within 10s ────────────
  bot.on('pre_checkout_query', async (query) => {
    try {
      await bot.answerPreCheckoutQuery(query.id, true);
    } catch (err) {
      console.error('[TELEGRAM BOT] Pre-checkout error:', err.message);
    }
  });

  // ── Successful payment handler ─────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;

    const payment = msg.successful_payment;
    const payload = payment.invoice_payload || '';
    const starsAmount = payment.total_amount;

    let planId = '';
    let planName = '';
    let rupeesAmount = starsAmount * STAR_RATE;
    let appUserId = '';

    if (payload.startsWith('plan_')) {
      const parts = payload.split('_');
      planId = parts[1];
      appUserId = parts[2] || '';
      const plan = findPlanById(planId);
      if (plan) {
        planName = plan.name;
        rupeesAmount = plan.investedAmount;
      }
    } else if (payload.startsWith('recharge_')) {
      const parts = payload.split('_');
      appUserId = parts[1] || '';
      const matched = findPlanByAmount(rupeesAmount);
      if (matched) {
        planId = matched.id;
        planName = matched.name;
      }
    }

    if (!planName) {
      planName = `Solar Wealth Recharge ₹${rupeesAmount.toLocaleString('en-IN')}`;
    }

    // Generate unique verification code (e.g. SW8F3K)
    const code = 'SW' + Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      await StarPayment.create({
        code,
        planId,
        planName,
        appUserId,
        telegramUserId: msg.from.id.toString(),
        telegramUsername: msg.from.username || msg.from.first_name || '',
        starsAmount,
        rupeesAmount,
        telegramPaymentId: payment.telegram_payment_charge_id,
        status: 'pending',
      });

      const responseText =
        `✅ *PAYMENT SUCCESSFUL!*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `☀️ *Plan:* ${planName}\n` +
        `💰 *Wallet Amount:* ₹${rupeesAmount.toLocaleString('en-IN')}\n` +
        `⭐ *Stars Paid:* ${starsAmount} Stars\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔑 *YOUR UNIQUE VERIFICATION CODE:*\n\n` +
        `\`${code}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *How to claim ₹${rupeesAmount.toLocaleString('en-IN')} in App:*\n` +
        `1️⃣ Tap the code above to copy\n` +
        `2️⃣ Open *Solar Wealth App* → *Wallet*\n` +
        `3️⃣ Paste code in the *Verification Code* box\n` +
        `4️⃣ Tap *Verify Code* → *₹${rupeesAmount.toLocaleString('en-IN')}* will be added to your wallet instantly!\n\n` +
        `🔒 *One-Time Use:* This unique code can only be used once.`;

      await bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'Markdown' });
      console.log(`[TELEGRAM BOT] ✅ Payment complete! Code: ${code} | Plan: ${planName} | ₹${rupeesAmount}`);
    } catch (err) {
      console.error('[TELEGRAM BOT] Payment save error:', err.message);
      await bot.sendMessage(
        msg.chat.id,
        `✅ Stars payment received, but code generation encountered an error.\nPayment ID: \`${payment.telegram_payment_charge_id}\`\nPlease contact support.`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[TELEGRAM BOT] Polling error:', err.code, err.message);
  });

  return bot;
}

module.exports = { initBot };
