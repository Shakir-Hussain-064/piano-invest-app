const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const walletRoutes = require('./routes/wallet');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payment');

// Initialize daily cron scheduler
try {
  require('./cron/dailyEarnings');
} catch (cronErr) {
  console.error('[CRON] Failed to initialize cron:', cronErr.message);
}

// Initialize Telegram Stars Bot
try {
  const { initBot } = require('./bot/telegramBot');
  initBot();
} catch (botErr) {
  console.error('[TELEGRAM BOT] Failed to initialize bot:', botErr.message);
}

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Safe MongoDB connection
const DEFAULT_MONGO_URI = 'mongodb://Shakir064:Shakir064@ac-miebea6-shard-00-00.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-01.df9jmrv.mongodb.net:27017,ac-miebea6-shard-00-02.df9jmrv.mongodb.net:27017/?ssl=true&replicaSet=atlas-i8q6z3-shard-0&authSource=admin&appName=Uber-App';
const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB Connected successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Admin: manually trigger daily earnings (protected by secret key)
app.post('/api/admin/run-earnings', async (req, res) => {
  const { secret } = req.body;
  if (secret !== (process.env.ADMIN_SECRET || 'solarwealth_admin_2024')) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  try {
    const { creditDailyEarnings } = require('./cron/dailyEarnings');
    await creditDailyEarnings();
    res.json({ success: true, message: 'Daily earnings credited successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payment', paymentRoutes);

// Keep-alive: self-ping every 10 minutes to prevent Render free tier spin-down
// This ensures the bot and server stay awake 24/7 even when idle
const BACKEND_URL = process.env.BACKEND_URL || 'https://piano-invest-app.onrender.com';
if (BACKEND_URL && !BACKEND_URL.includes('localhost')) {
  setInterval(() => {
    try {
      const https = require('https');
      https.get(`${BACKEND_URL}/health`, (r) => {
        console.log('[KEEP-ALIVE] Pinged /health →', r.statusCode);
      }).on('error', (e) => {
        console.log('[KEEP-ALIVE] Ping error:', e.message);
      });
    } catch (_) {}
  }, 10 * 60 * 1000); // every 10 minutes
  console.log('[KEEP-ALIVE] Self-ping 24/7 enabled →', BACKEND_URL);
}

// Safe frontend serving (if dist exists)
const frontendDist = path.join(__dirname, '../frontend/dist');
const indexHtmlPath = path.join(frontendDist, 'index.html');

if (fs.existsSync(indexHtmlPath)) {
  console.log('✅ Serving frontend build from:', frontendDist);
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
      return res.status(404).json({ message: 'API route not found' });
    }
    res.sendFile(indexHtmlPath);
  });
} else {
  // If backend is deployed standalone without frontend build
  app.get('/', (req, res) => {
    res.json({
      status: 'success',
      message: 'PianoWealth Backend API is running perfectly!',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        plans: '/api/plans',
        wallet: '/api/wallet',
        payment: '/api/payment',
        profile: '/api/profile',
      },
    });
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PianoWealth Server running on port ${PORT} (0.0.0.0)`);
});
