const TelegramBot = require('node-telegram-bot-api');
const StarPayment = require('../models/StarPayment');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8723665393:AAHbilt8olKbdZrBZfLIMTg2gfQuO6EikeY';

if (!BOT_TOKEN) {
  console.error('[TELEGRAM BOT] ❌ TELEGRAM_BOT_TOKEN not set in environment!');
}

// Star-to-Rupee conversion: 1 Star = ₹2 (configurable)
const STAR_RATE = Number(process.env.STAR_RATE) || 2;

// Recharge plan options (Stars amount → Rupees)
const RECHARGE_PLANS = [
  { stars: 250,   rupees: 500 },
  { stars: 500,   rupees: 1000 },
  { stars: 1250,  rupees: 2500 },
  { stars: 2500,  rupees: 5000 },
  { stars: 5000,  rupees: 10000 },
  { stars: 7500,  rupees: 15000 },
  { stars: 10000, rupees: 20000 },
];

let bot = null;

function initBot() {
  if (!BOT_TOKEN) return null;

  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('[TELEGRAM BOT] ✅ Bot initialized with polling');

  // ── /start with deep link ──────────────────────────────────
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1]; // e.g. "recharge_250_userId123"

    if (!param) {
      // Plain /start - show welcome
      return bot.sendMessage(chatId,
        `🌟 *Welcome to Solar Wealth!*\n\n` +
        `This bot helps you recharge your Solar Wealth wallet using Telegram Stars ⭐\n\n` +
        `*How it works:*\n` +
        `1️⃣ Open the Solar Wealth app\n` +
        `2️⃣ Go to Wallet → Recharge\n` +
        `3️⃣ Select amount & tap "Open Telegram"\n` +
        `4️⃣ Pay with Stars here\n` +
        `5️⃣ Copy your unique code\n` +
        `6️⃣ Paste it in the app\n\n` +
        `Your wallet will be recharged instantly! 🚀`,
        { parse_mode: 'Markdown' }
      );
    }

    // Parse deep link: recharge_{stars}_{appUserId}
    const parts = param.split('_');
    if (parts[0] !== 'recharge' || parts.length < 3) {
      return bot.sendMessage(chatId, '❌ Invalid recharge link. Please use the Solar Wealth app to generate a valid link.');
    }

    const starsAmount = parseInt(parts[1]);
    const appUserId = parts.slice(2).join('_'); // Handle ObjectIDs with underscores

    if (!starsAmount || starsAmount < 1) {
      return bot.sendMessage(chatId, '❌ Invalid stars amount.');
    }

    const rupeesAmount = starsAmount * STAR_RATE;

    // Send Star Payment Invoice
    try {
      await bot.sendInvoice(
        chatId,
        `Solar Wealth Recharge ₹${rupeesAmount.toLocaleString()}`,  // title
        `Recharge ₹${rupeesAmount.toLocaleString()} to your Solar Wealth wallet.\n\nAfter payment, you'll receive a unique code. Paste it in the app to complete your recharge.`, // description
        `recharge_${appUserId}_${Date.now()}`,  // payload
        '',     // provider_token (empty for Telegram Stars)
        'XTR',  // currency (Telegram Stars)
        [{ label: `₹${rupeesAmount.toLocaleString()} Wallet Recharge`, amount: starsAmount }], // prices
        {
          // Optional: photo for the invoice
          // photo_url: 'https://example.com/logo.png',
        }
      );
    } catch (err) {
      console.error('[TELEGRAM BOT] Invoice error:', err.message);
      bot.sendMessage(chatId, '❌ Failed to create payment invoice. Please try again from the app.');
    }
  });

  // ── Pre-checkout query - always approve ────────────────────
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
    const payload = payment.invoice_payload; // "recharge_appUserId_timestamp"
    const parts = payload.split('_');

    // Extract appUserId (everything between first and last underscore segment)
    const appUserId = parts.slice(1, -1).join('_');
    const starsAmount = payment.total_amount;
    const rupeesAmount = starsAmount * STAR_RATE;

    // Generate unique alphanumeric code
    const code = 'SW' + Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      await StarPayment.create({
        code,
        appUserId,
        telegramUserId: msg.from.id.toString(),
        telegramUsername: msg.from.username || msg.from.first_name || '',
        starsAmount,
        rupeesAmount,
        telegramPaymentId: payment.telegram_payment_charge_id,
        status: 'pending',
      });

      await bot.sendMessage(msg.chat.id,
        `✅ *Payment Successful!*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔑 *Your Verification Code:*\n\n` +
        `\`${code}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *Amount:* ₹${rupeesAmount.toLocaleString()}\n` +
        `⭐ *Stars Paid:* ${starsAmount}\n\n` +
        `📋 *Next Steps:*\n` +
        `1. Copy the code above\n` +
        `2. Go back to Solar Wealth app\n` +
        `3. Paste it in the "Verification Code" field\n` +
        `4. Tap "Verify & Add to Wallet"\n\n` +
        `⏰ Code expires in 30 minutes`,
        { parse_mode: 'Markdown' }
      );

      console.log(`[TELEGRAM BOT] ✅ Payment ${code} | User: ${appUserId} | Stars: ${starsAmount} | ₹${rupeesAmount}`);

    } catch (err) {
      console.error('[TELEGRAM BOT] Payment save error:', err.message);
      await bot.sendMessage(msg.chat.id,
        `✅ Payment received but there was an error generating your code.\n\n` +
        `Please contact support with your Telegram Payment ID:\n` +
        `\`${payment.telegram_payment_charge_id}\``,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // ── Error handler ──────────────────────────────────────────
  bot.on('polling_error', (err) => {
    console.error('[TELEGRAM BOT] Polling error:', err.code, err.message);
  });

  return bot;
}

module.exports = { initBot, RECHARGE_PLANS, STAR_RATE };
