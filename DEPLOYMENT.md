# 🚀 InvestPro — Live Deployment Guide

## Prerequisites
- ✅ GitHub account
- ✅ Razorpay account ([razorpay.com](https://razorpay.com)) — get test keys first
- ✅ Render.com account ([render.com](https://render.com))
- ✅ Vercel account ([vercel.com](https://vercel.com))

---

## Step 1 — Get Razorpay Keys

1. Login to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys → Generate Test Key**
3. Copy `Key ID` (starts with `rzp_test_...`) and `Key Secret`
4. Paste into `backend/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
   RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
   ```
5. Paste Key ID into `frontend/.env`:
   ```
   VITE_RAZORPAY_KEY=rzp_test_YOUR_KEY_ID
   ```

---

## Step 2 — Push to GitHub

```powershell
# In the investment-app root directory:
git init
git add .
git commit -m "InvestPro - initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/investpro.git
git push -u origin main
```

> Create the GitHub repo first at github.com/new

---

## Step 3 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Configure:
   | Setting | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Region** | Singapore (closest to India) |
   | **Plan** | Free |

4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | *(your Atlas URI from .env)* |
   | `JWT_SECRET` | `supersecretjwtkey2024investmentapp` |
   | `RAZORPAY_KEY_ID` | `rzp_test_...` |
   | `RAZORPAY_KEY_SECRET` | *(your secret)* |
   | `CLIENT_URL` | *(Vercel URL — add after frontend deploy)* |

5. Click **Create Web Service** — wait ~3 min
6. Copy the URL: `https://investpro-backend.onrender.com`

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Configure:
   | Setting | Value |
   |---|---|
   | **Root Directory** | `frontend` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://investpro-backend.onrender.com/api` |
   | `VITE_RAZORPAY_KEY` | `rzp_test_...` |

5. Click **Deploy** — wait ~2 min
6. Copy your Vercel URL: `https://investpro.vercel.app`

---

## Step 5 — Final Configuration

1. Go back to **Render** → Your backend service → Environment
2. Update `CLIENT_URL` to your Vercel URL: `https://investpro.vercel.app`
3. **Redeploy** the backend

---

## Step 6 — Test Live

1. Open your Vercel URL in browser
2. Sign up with any email + password
3. Go to Wallet → Recharge → Enter ₹500
4. Use Razorpay **test card**:
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: Any 3 digits
   - OTP: `1234` (test mode)
5. Confirm wallet balance updated ✅

---

## Going Live (Production)

When ready to accept real money:
1. Complete Razorpay KYC on dashboard
2. Generate **Live Keys** (`rzp_live_...`)
3. Replace test keys with live keys in Render + Vercel env vars
4. Redeploy both services

---

## Local Development

```powershell
# Terminal 1 — Backend
cd backend
npm install
npm run dev        # runs on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

> ⚠️ Make sure MongoDB is running locally OR use the Atlas URI already in .env
