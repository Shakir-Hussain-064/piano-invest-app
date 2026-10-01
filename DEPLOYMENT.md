# Render + Vercel + MongoDB Atlas

This setup keeps the long-running Express API and accrual worker on Render, and the Vite frontend on Vercel. It does not deploy either service automatically.

Before deploying, rotate any MongoDB password, session secret, or bank encryption key that has ever been stored in a local `.env` or shared. Keep the new values only in the hosting dashboard or a local ignored `.env` file.

## 1. Render backend

1. Create a MongoDB Atlas database and allow the Render service to connect. Use a database name in the connection string, for example `...mongodb.net/piano`.
2. Create a Render **Web Service** from this repository. Set the root directory to the folder containing this `package.json` (`outputs/piano` if the whole workspace is uploaded).
3. Use these settings:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/healthz`
- Node version: 22.12 or newer supported LTS (select 22.x or 24.x)

4. Add these Render environment variables in the dashboard. Do not upload the local `.env` file or commit it.

```text
NODE_ENV=production
HOST=0.0.0.0
MONGODB_URI=<Atlas connection string including /piano>
SESSION_SECRET=<random value of at least 32 characters>
BANK_DATA_KEY=<stable 64-character hexadecimal key>
APP_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
```

URI-encode special characters in the database password. `PORT` is supplied by Render. Keep `BANK_DATA_KEY` stable when moving existing encrypted withdrawal records. Configure Atlas database-user permissions and network access for the Render service's outbound addresses.

Render supplies PORT. HOST must be `0.0.0.0`. Never regenerate BANK_DATA_KEY when moving existing encrypted withdrawal records. Keep secrets in the hosting dashboard, not Git. An empty new Atlas database does not contain local accounts or the owner role; migrate intentionally or enroll an existing Atlas user with scripts/set-owner.js.

Use an always-on service for the existing scheduled worker. A sleeping service cannot run midnight jobs on time. Automatic bank/UPI payouts are not integrated.

## 2. Vercel frontend

After the Render deploy is healthy and provides its real backend URL, run locally from this project folder:

```powershell
node scripts/configure-vercel.js https://YOUR-BACKEND.onrender.com
```

Commit the generated `vercel.json` so Vercel forwards `/api/*` to Render and serves `/owner` through the SPA. Import the same project root on Vercel, use the Vite preset, build `npm run build`, and output `dist`. No frontend environment variables are required. Do not upload `.env`, `.env.render`, or add MongoDB, session, encryption secrets to Vercel or any `VITE_*` variable.

The browser continues using same-origin `/api`; do not replace it with a direct cross-site Render URL. Cookies remain HttpOnly/Secure in production. After Vercel gives the final frontend URL, update Render `APP_ORIGIN` to that exact HTTPS origin and redeploy Render.

## 3. Hosted verification

Check Render `/healthz`, then Vercel `/api/config` returns JSON (not index.html) and sets a Secure HttpOnly session cookie. Test captcha, signup/login, refreshing a session, logout, and direct `/owner` navigation. Confirm customer accounts cannot access owner APIs. Check client IP/rate limiting through the deployed proxy before public traffic. Local build/tests cannot verify provider routing, cookies or live payment settlement.

Take backups and monitor Atlas storage/operations. Hosting configuration is not payment-provider approval; the actual business and payment flow must be disclosed accurately.
