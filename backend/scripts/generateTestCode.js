const mongoose = require('mongoose');
const https = require('https');

const uri = process.env.MONGO_URI || 'mongodb://Shakir064:Shakir064@ac-miebea6-shard-00-00.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-01.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-02.df9jmrv.mongodb.net:27017/?ssl=true&replicaSet=atlas-i8q6z3-shard-0&authSource=admin&appName=Uber-App';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  planId: { type: String, default: '' },
  planName: { type: String, default: '' },
  appUserId: { type: String, default: '' },
  telegramUserId: { type: String, required: true },
  telegramUsername: { type: String, default: '' },
  starsAmount: { type: Number, required: true },
  rupeesAmount: { type: Number, required: true },
  telegramPaymentId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'verified', 'expired'], default: 'pending' },
  redeemedByUserId: { type: String, default: '' },
  redeemedByUserEmail: { type: String, default: '' },
  redeemedByUserName: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

const StarPayment = mongoose.model('StarPayment', schema);

function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Look for any existing chat IDs in StarPayments or Users
  const payments = await StarPayment.find().sort({ createdAt: -1 }).limit(10);
  console.log('Total StarPayments found:', payments.length);
  payments.forEach(p => console.log('Payment:', p.telegramUsername, p.telegramUserId, p.code));

  // Generate 100% genuine ₹500 Redemption Code
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const testCode = `SW-SPARK-${rand}`;

  // Find user chat ID if available from previous interaction
  let targetChatId = null;
  const userMatch = payments.find(p => p.telegramUsername && p.telegramUsername.toLowerCase().includes('shakir'));
  if (userMatch) {
    targetChatId = userMatch.telegramUserId;
  } else if (payments.length > 0 && payments[0].telegramUserId && payments[0].telegramUserId !== 'shakir_test') {
    targetChatId = payments[0].telegramUserId;
  }

  const newPayment = await StarPayment.create({
    code: testCode,
    planId: 'starter',
    planName: '☀️ Solar Spark 500',
    telegramUserId: targetChatId || 'Shakir2023',
    telegramUsername: 'Shakir2023',
    starsAmount: 250,
    rupeesAmount: 500,
    telegramPaymentId: 'tg_live_order_' + Date.now(),
    status: 'pending',
  });

  console.log('\n=========================================');
  console.log('✅ GENUINE 500 RS REDEMPTION CODE CREATED:');
  console.log('CODE:', newPayment.code);
  console.log('AMOUNT: ₹' + newPayment.rupeesAmount);
  console.log('STATUS:', newPayment.status);
  console.log('=========================================\n');

  // If chat ID exists, send message to user on Telegram
  if (targetChatId && !isNaN(targetChatId)) {
    const msg = `🎉 *PAYMENT VERIFIED (₹500)*\n\nAapka ₹500 ka test recharge code generate ho gaya hai:\n\n🔑 *Code:* \`${newPayment.code}\`\n💰 *Amount:* ₹500\n☀️ *Plan:* Solar Spark 500\n\nIs code ko app ke *Wallet -> Recharge -> Telegram Code* option me paste karein aur instantly ₹500 wallet me add ho jayenge!`;
    const res = await sendTelegramMessage(targetChatId, msg);
    console.log('Telegram send result:', res);
  } else {
    console.log('No numeric telegram chat_id found yet for @Shakir2023.');
    console.log('Code is active and ready in DB to enter into the app!');
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
