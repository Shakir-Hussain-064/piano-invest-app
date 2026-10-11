const StarPayment = require('../models/StarPayment');
const { PLANS, STAR_RATE, findPlanById, findPlanByAmount } = require('../constants/plans');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8723665393:AAHbilt8olKbdZrBZfLIMTg2gfQuO6EikeY';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Helper: Call Telegram Bot API
async function callTelegram(method, data) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error(`[TELEGRAM BOT] API call ${method} failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Helper: Send message
async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return callTelegram('sendMessage', payload);
}

// Helper: Send plan invoice (Telegram Stars)
async function sendPlanInvoice(chatId, plan, appUserId = 'guest') {
  const payload = `plan_${plan.id}_${appUserId}_${Date.now()}`;
  const desc =
    `Buy ${plan.name} with Telegram Stars.\n` +
    `• Daily Yield: ₹${plan.dailyEarn.toLocaleString('en-IN')}/day\n` +
    `• Total Return: ₹${plan.totalReturn.toLocaleString('en-IN')} (over ${plan.totalDays} days)\n` +
    `• Wallet Value: ₹${plan.investedAmount.toLocaleString('en-IN')}\n\n` +
    `After payment, you will receive a unique code to add ₹${plan.investedAmount.toLocaleString('en-IN')} to your wallet.`;

  return callTelegram('sendInvoice', {
    chat_id: chatId,
    title: `${plan.name} (₹${plan.investedAmount.toLocaleString('en-IN')})`,
    description: desc,
    payload,
    provider_token: '', // empty for Telegram Stars
    currency: 'XTR',    // Telegram Stars
    prices: [{ label: plan.name, amount: plan.starsAmount }],
  });
}

// Helper: Send custom amount invoice
async function sendCustomInvoice(chatId, rupeesAmount, appUserId = 'guest') {
  const num = Number(rupeesAmount);
  const starsAmount = Math.ceil(num / STAR_RATE);
  const matchedPlan = findPlanByAmount(num);
  if (matchedPlan) {
    return sendPlanInvoice(chatId, matchedPlan, appUserId);
  }

  const payload = `recharge_${starsAmount}_${appUserId}_${Date.now()}`;
  return callTelegram('sendInvoice', {
    chat_id: chatId,
    title: `Solar Wealth Recharge ₹${num.toLocaleString('en-IN')}`,
    description: `Recharge ₹${num.toLocaleString('en-IN')} to your Solar Wealth wallet using ${starsAmount} Stars.\n\nAfter payment, you will receive a unique code to enter in the app.`,
    payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: `₹${num.toLocaleString('en-IN')} Wallet Recharge`, amount: starsAmount }],
  });
}

// Helper: Send Plans Menu with inline buttons
async function sendPlansMenu(chatId, appUserId = 'guest') {
  let msg = `☀️ *WELCOME TO SOLAR WEALTH INVESTMENT PLANS!*\n\n`;
  msg += `Aap Telegram Stars ⭐ se koi bhi plan buy kar sakte hain. Buy karne par aapko ek *Unique Code* milega jise app me enter karke aapke wallet me money add ho jayegi!\n\n`;

  msg += `📋 *STANDARD PLANS (60 Days · 12x Return):*\n`;
  const standardPlans = PLANS.filter((p) => !p.isVip);
  standardPlans.forEach((p) => {
    msg += `• *${p.name}*: ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) → Earn ₹${p.dailyEarn}/day\n`;
  });

  msg += `\n⚡ *VIP MEGA PLANS (High Yield):*\n`;
  const vipPlans = PLANS.filter((p) => p.isVip);
  vipPlans.forEach((p) => {
    msg += `• *${p.name}*: ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) → Earn ₹${p.dailyEarn}/day\n`;
  });

  msg += `\n👇 *Niche diye gaye buttons se plan select karein aur buy karein:*`;

  // Build inline buttons (2 columns)
  const buttons = [];
  standardPlans.forEach((p) => {
    buttons.push([
      {
        text: `${p.name} — ${p.starsAmount} ⭐ (₹${p.investedAmount.toLocaleString('en-IN')})`,
        callback_data: `buy_${p.id}_${appUserId}`,
      },
    ]);
  });
  vipPlans.forEach((p) => {
    buttons.push([
      {
        text: `${p.name} — ${p.starsAmount} ⭐ (₹${p.investedAmount.toLocaleString('en-IN')})`,
        callback_data: `buy_${p.id}_${appUserId}`,
      },
    ]);
  });

  return sendMessage(chatId, msg, { inline_keyboard: buttons });
}

// Handle single update
async function handleUpdate(update) {
  try {
    // 1. Message handler
    if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // Check successful payment
    if (msg.successful_payment) {
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
        appUserId = parts[2] || '';
        const matched = findPlanByAmount(rupeesAmount);
        if (matched) {
          planId = matched.id;
          planName = matched.name;
        }
      }

      if (!planName) {
        planName = `Solar Wealth Recharge ₹${rupeesAmount.toLocaleString('en-IN')}`;
      }

      // Generate unique code (e.g. SW8FK2)
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

        const reply =
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
          `3️⃣ Paste code in the *Verification Code / UTR* box\n` +
          `4️⃣ Tap *Verify Code* → *₹${rupeesAmount.toLocaleString('en-IN')}* wallet me turant add ho jayega!\n\n` +
          `🔒 *One-Time Use:* Yeh unique code sirf 1 baar redeem ho sakta hai.`;

        await sendMessage(chatId, reply);
        console.log(`[TELEGRAM BOT] ✅ Payment successful: ${code} | ₹${rupeesAmount} | Plan: ${planName}`);
      } catch (err) {
        console.error('[TELEGRAM BOT] Payment save error:', err.message);
        await sendMessage(
          chatId,
          `✅ Payment received! Payment ID: \`${payment.telegram_payment_charge_id}\`\nSupport se contact karein.`
        );
      }
      return;
    }

    // Command: /start [param]
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const param = parts[1] || '';

      if (param.startsWith('plan_')) {
        const pParts = param.split('_');
        const planId = pParts[1];
        const appUserId = pParts.slice(2).join('_');
        const plan = findPlanById(planId);
        if (plan) {
          return sendPlanInvoice(chatId, plan, appUserId);
        }
      } else if (param.startsWith('recharge_')) {
        const rParts = param.split('_');
        const starsAmount = parseInt(rParts[1]);
        const appUserId = rParts.slice(2).join('_');
        return sendCustomInvoice(chatId, starsAmount * STAR_RATE, appUserId);
      }

      return sendPlansMenu(chatId);
    }

    // Command: /plans
    if (text === '/plans') {
      return sendPlansMenu(chatId);
    }

    // If user types a number directly (like 500, 1000, 2500, etc.)
    const parsedNum = parseInt(text.replace(/[^0-9]/g, ''));
    if (parsedNum && parsedNum >= 200) {
      const matched = findPlanByAmount(parsedNum);
      if (matched) {
        return sendPlanInvoice(chatId, matched);
      }
      return sendCustomInvoice(chatId, parsedNum);
    }

    // Default response: show plans
    return sendPlansMenu(chatId);
  }

    // 2. Callback query (when user taps inline button)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data || '';

      // Acknowledge callback query immediately in background (non-blocking)
      callTelegram('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

      if (data.startsWith('buy_')) {
        const parts = data.split('_');
        const planId = parts[1];
        const appUserId = parts.slice(2).join('_') || 'guest';
        const plan = findPlanById(planId);
        if (plan) {
          return sendPlanInvoice(chatId, plan, appUserId);
        }
      }
      return;
    }

    // 3. Pre-checkout query (Telegram requires fast answer)
    if (update.pre_checkout_query) {
      const pc = update.pre_checkout_query;
      return callTelegram('answerPreCheckoutQuery', {
        pre_checkout_query_id: pc.id,
        ok: true,
      });
    }
  } catch (err) {
    console.error('[TELEGRAM BOT] handleUpdate error:', err.message);
  }
}

// Long-polling loop (ultra-fast sub-second cycle)
let isPolling = false;
let lastUpdateId = 0;

async function pollLoop() {
  if (!isPolling) return;

  try {
    const res = await callTelegram('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 1, // 1-second short poll: ensures instant update delivery without hanging
      limit: 100,
    });

    if (res.ok && Array.isArray(res.result) && res.result.length > 0) {
      // Process all incoming updates in parallel for instant speed
      await Promise.all(
        res.result.map(async (update) => {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          try {
            await handleUpdate(update);
          } catch (hErr) {
            console.error('[TELEGRAM BOT] update error:', hErr.message);
          }
        })
      );
    }
  } catch (err) {
    console.error('[TELEGRAM BOT] Poll error:', err.message);
    if (isPolling) {
      setTimeout(pollLoop, 3000);
      return;
    }
  }

  // Next poll after tiny 100ms breather
  if (isPolling) {
    setTimeout(pollLoop, 100);
  }
}

// Express webhook handler for zero-latency direct push
async function handleWebhookUpdate(req, res) {
  res.status(200).send({ ok: true });
  try {
    if (req.body && req.body.update_id) {
      await handleUpdate(req.body);
    }
  } catch (err) {
    console.error('[TELEGRAM BOT] Webhook error:', err.message);
  }
}

function initBot() {
  if (!BOT_TOKEN) return null;
  // If webhook is active on Vercel/cloud, do not run polling to avoid conflicts or deleting webhook
  if (process.env.USE_WEBHOOK === 'true' || process.env.POLL_BOT !== 'true') {
    console.log('[TELEGRAM BOT] Webhook mode active (no local polling needed)');
    return;
  }
  if (isPolling) {
    console.log('[TELEGRAM BOT] Polling already running');
    return;
  }

  isPolling = true;
  console.log('[TELEGRAM BOT] ⚡ Solar Wealth Polling Service started');
  pollLoop();
}

module.exports = { initBot, handleWebhookUpdate, callTelegram };
