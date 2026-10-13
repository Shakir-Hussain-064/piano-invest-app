// Vercel Serverless Function: 24/7 Telegram Webhook for @SolarWealthPayBot
// Never sleeps, 100% cloud uptime, responds in <100ms

const mongoose = require('mongoose');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8627256001:AAFALX1gy0Smc5Rz4p2Gp0gXSKebFxcURd4';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const NEW_CLUSTER0_URI = 'mongodb://shakirhusain2021_db_user:vu8Tk9BB9fUiOOPQ@ac-6hicwaq-shard-00-00.detfc3h.mongodb.net:27017,ac-6hicwaq-shard-00-01.detfc3h.mongodb.net:27017,ac-6hicwaq-shard-00-02.detfc3h.mongodb.net:27017/?ssl=true&replicaSet=atlas-2hfwrq-shard-0&authSource=admin&appName=Cluster0';
const MONGO_URI = (process.env.MONGO_URI && process.env.MONGO_URI.includes('detfc3h'))
  ? process.env.MONGO_URI
  : NEW_CLUSTER0_URI;

const STAR_RATE = 2;

const PLANS = [
  { id: 'starter', name: '☀️ Solar Spark 500', investedAmount: 500, starsAmount: 250, dailyEarn: 100, totalReturn: 6000, totalDays: 60, isVip: false },
  { id: 'basic', name: '☀️ Solar Ray 1000', investedAmount: 1000, starsAmount: 500, dailyEarn: 200, totalReturn: 12000, totalDays: 60, isVip: false },
  { id: 'silver', name: '☀️ Solar Panel 2500', investedAmount: 2500, starsAmount: 1250, dailyEarn: 500, totalReturn: 30000, totalDays: 60, isVip: false },
  { id: 'gold', name: '☀️ Solar Grid 5000', investedAmount: 5000, starsAmount: 2500, dailyEarn: 1000, totalReturn: 60000, totalDays: 60, isVip: false },
  { id: 'platinum', name: '☀️ Solar Station 10000', investedAmount: 10000, starsAmount: 5000, dailyEarn: 2000, totalReturn: 120000, totalDays: 60, isVip: false },
  { id: 'diamond', name: '☀️ Solar Park 20000', investedAmount: 20000, starsAmount: 10000, dailyEarn: 4000, totalReturn: 240000, totalDays: 60, isVip: false },
  { id: 'vip-20k', name: '⚡ VIP Solar SuperGrid 20K', investedAmount: 20000, starsAmount: 10000, dailyEarn: 6000, totalReturn: 360000, totalDays: 60, isVip: true },
  { id: 'vip-25k', name: '⚡ VIP Solar UltraPlant 25K', investedAmount: 25000, starsAmount: 12500, dailyEarn: 8000, totalReturn: 480000, totalDays: 60, isVip: true },
  { id: 'vip-30k', name: '⚡ VIP Solar PowerHub 30K', investedAmount: 30000, starsAmount: 15000, dailyEarn: 10000, totalReturn: 600000, totalDays: 60, isVip: true },
  { id: 'vip-40k', name: '⚡ VIP Solar InfinityGig 40K', investedAmount: 40000, starsAmount: 20000, dailyEarn: 15000, totalReturn: 900000, totalDays: 60, isVip: true },
  { id: 'vip-50k', name: '⚡ VIP Gigawatt Empire 50K', investedAmount: 50000, starsAmount: 25000, dailyEarn: 20000, totalReturn: 1200000, totalDays: 60, isVip: true },
];

function findPlanById(id) {
  return PLANS.find((p) => p.id === id) || null;
}
function findPlanByAmount(amt) {
  return PLANS.find((p) => p.investedAmount === Number(amt)) || null;
}

// Connect MongoDB Atlas cached connection
let cachedDb = null;
async function connectDb() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  try {
    cachedDb = await mongoose.connect(MONGO_URI);
    return cachedDb;
  } catch (err) {
    console.error('Mongo error:', err);
    return null;
  }
}

// StarPayment Mongoose Model
let StarPayment;
try {
  StarPayment = mongoose.model('StarPayment');
} catch (_) {
  const schema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    planId: { type: String, default: '' },
    planName: { type: String, default: '' },
    appUserId: { type: String, default: '' },
    telegramUserId: { type: String, required: true },
    telegramUsername: { type: String, default: '' },
    starsAmount: { type: Number, required: true },
    rupeesAmount: { type: Number, required: true },
    telegramPaymentId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'verified', 'expired'], default: 'pending', index: true },
    verifiedAt: { type: Date, default: null },
    redeemedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    redeemedByUserEmail: { type: String, default: '' },
    redeemedByUserName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  });
  StarPayment = mongoose.model('StarPayment', schema);
}

async function callTelegram(method, data) {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    console.error(`Telegram API error (${method}):`, e.message);
    return { ok: false, error: e.message };
  }
}

async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return callTelegram('sendMessage', payload);
}

async function sendPlanInvoice(chatId, plan, appUserId = 'guest') {
  const payload = `plan_${plan.id}_${appUserId}_${Date.now()}`;
  const desc =
    `Buy ${plan.name} with Telegram Stars.\n` +
    `• Daily Yield: ₹${plan.dailyEarn.toLocaleString('en-IN')}/day\n` +
    `• Total Return: ₹${plan.totalReturn.toLocaleString('en-IN')} (${plan.totalDays} days)\n` +
    `• Wallet Value: ₹${plan.investedAmount.toLocaleString('en-IN')}\n\n` +
    `After payment, you will receive a unique code to add ₹${plan.investedAmount.toLocaleString('en-IN')} to your wallet.`;

  return callTelegram('sendInvoice', {
    chat_id: chatId,
    title: `${plan.name} (₹${plan.investedAmount.toLocaleString('en-IN')})`,
    description: desc,
    payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.name, amount: plan.starsAmount }],
  });
}

async function sendPlansMenu(chatId, appUserId = 'guest') {
  let msg = `☀️ *SOLAR WEALTH PLANS*\n\n`;
  msg += `Plan buy karne ke liye niche diye gaye button par click karein:\n\n`;

  const standardPlans = PLANS.filter((p) => !p.isVip);
  standardPlans.forEach((p) => {
    msg += `• *${p.name}*\n  💰 ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) | Daily ₹${p.dailyEarn}\n\n`;
  });

  const vipPlans = PLANS.filter((p) => p.isVip);
  msg += `⚡ *VIP PLANS:*\n`;
  vipPlans.forEach((p) => {
    msg += `• *${p.name}*\n  💰 ₹${p.investedAmount.toLocaleString('en-IN')} (${p.starsAmount} ⭐) | Daily ₹${p.dailyEarn}\n\n`;
  });

  msg += `👇 *Apna plan select karein aur turant buy karein:*`;

  const buttons = [];
  standardPlans.forEach((p) => {
    buttons.push([{ text: `💳 Buy ${p.name} — ${p.starsAmount} ⭐`, callback_data: `buy_${p.id}_${appUserId}` }]);
  });
  vipPlans.forEach((p) => {
    buttons.push([{ text: `⚡ Buy ${p.name} — ${p.starsAmount} ⭐`, callback_data: `buy_${p.id}_${appUserId}` }]);
  });

  return sendMessage(chatId, msg, { inline_keyboard: buttons });
}

// Serverless Handler
module.exports = async function handler(req, res) {
  // Always respond 200 fast to Telegram
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'SolarWealth Telegram Webhook Active 24/7' });
  }

  const update = req.body;
  if (!update) return res.status(200).json({ ok: true });

  try {
    // 1. Pre-checkout query (Must respond immediately)
    if (update.pre_checkout_query) {
      await callTelegram('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
      return res.status(200).json({ ok: true });
    }

    // 2. Callback query (Inline button taps)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data || '';

      callTelegram('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

      if (data.startsWith('buy_')) {
        const parts = data.split('_');
        const planId = parts[1];
        const appUserId = parts.slice(2).join('_') || 'guest';
        const plan = findPlanById(planId);
        if (plan) {
          await sendPlanInvoice(chatId, plan, appUserId);
        }
      }
      return res.status(200).json({ ok: true });
    }

    // 3. Messages
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();

      // Successful Stars Payment
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
        }

        if (!planName) {
          planName = `Solar Wealth Recharge ₹${rupeesAmount.toLocaleString('en-IN')}`;
        }

        const code = 'SW' + Math.random().toString(36).substring(2, 8).toUpperCase();

        await connectDb();
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
          `3️⃣ Paste code in the *Verification Code* box\n` +
          `4️⃣ Tap *Submit Code* → *₹${rupeesAmount.toLocaleString('en-IN')}* wallet me turant add ho jayega!\n\n` +
          `🔒 *One-Time Use:* Yeh unique code sirf 1 baar redeem ho sakta hai.`;

        await sendMessage(chatId, reply);
        return res.status(200).json({ ok: true, code });
      }

      // /start [param]
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const param = parts[1] || '';

        if (param.startsWith('plan_')) {
          const pParts = param.split('_');
          const planId = pParts[1];
          const appUserId = pParts.slice(2).join('_');
          const plan = findPlanById(planId);
          if (plan) {
            await sendPlanInvoice(chatId, plan, appUserId);
            return res.status(200).json({ ok: true });
          }
        }

        await sendPlansMenu(chatId);
        return res.status(200).json({ ok: true });
      }

      if (text === '/plans') {
        await sendPlansMenu(chatId);
        return res.status(200).json({ ok: true });
      }

      // Default: show menu
      await sendPlansMenu(chatId);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
