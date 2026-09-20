# Piano — MERN investment app

React + Vite frontend, Express/Node backend, and MongoDB persistence. The full server includes Razorpay recharge and RazorpayX bank payout integration. Provider credentials and account activation are required to use real money. The published preview runs a browser-only demo. Plan income is an application-defined liability funded by the operator; the payment provider does not generate investment returns.

## Run locally

Use Node.js 22.12+ and MongoDB 7+.

1. `npm install`
2. Copy `.env.example` to `.env`. Set a random session secret (at least 32 characters).
3. Start MongoDB with `docker compose up -d`, or set `MONGODB_URI` to your MongoDB connection string.
4. `npm run dev` — open http://127.0.0.1:5173.

For a disposable development database, set `USE_MEMORY_DB=true`. It downloads a MongoDB binary; data is lost on server shutdown. Never use it for real balances. Normal MongoDB uses the named Docker volume and survives restarts.

Production frontend: `npm run build`, then `npm start` serves the compiled React app and API together on port 3001. Put it behind an HTTPS reverse proxy, set `NODE_ENV=production`, `SESSION_SECRET`, and a persistent `MONGODB_URI`. The server binds to 127.0.0.1 by default; set HOST=0.0.0.0 for a container host. An always-running Node service is required for scheduled credits. A frontend-only host cannot run the MERN backend.

## Features

- Gmail-address signup with password, optional referral code, and a short-lived single-use arithmetic captcha; signup then login.
- bcrypt password hashing, MongoDB-backed HTTP-only sessions, CSRF tokens, rate limiting, input validation, and security headers.
- Home, Plans, Wallet, and Profile navigation on desktop and mobile.
- ₹500 / ₹1,000 / ₹2,500 / ₹5,000 / ₹10,000 plans: 10% of the plan amount daily, for 20 credits, capped at 2× total return. For ₹500 this is ₹50 × 20 = ₹1,000 total, including ₹500 principal and ₹500 profit.
- Sample VIP plans: ₹5,000 and ₹10,000, 15% daily, 20 credits, 3× total return. Rates are editable in `shared/domain.js`; purchased plans keep a snapshot of their original terms.
- Daily credit at the next midnight in Asia/Kolkata after purchase. Worker runs every 15 seconds; missed days catch up after downtime, with no duplicate credit. It also reconciles when the user accesses their wallet. The first credit may occur less than 24 hours after purchase.
- Recharge adds to wallet only. Users separately confirm plan purchase.
- Minimum ₹500 bank withdrawal: holder name, account number (entered twice), IFSC, and password confirmation. Funds are reserved, and a persisted payout request is sent to RazorpayX by the worker. The UI shows pending/queued/processing/processed/failed/reversed status and UTR when available. Without credentials, only explicitly enabled demo requests are possible.
- Server wallet changes use optimistic concurrency on a single MongoDB document. Balances are stored as integer paise. Duplicate client request IDs and payment order IDs prevent duplicate debits/credits.

## Razorpay

The Express backend implements order creation, Checkout integration, HMAC signature verification, server-to-server captured-payment verification, and a signed `payment.captured` webhook. Wallet credits are idempotent across the callback and webhook.

1. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to `.env`. Keep secrets on the server; never use a `VITE_` prefix for secrets.
2. Begin with `rzp_test_…` keys. Set `DEMO_PAYMENTS=false` so unauthenticated money cannot be generated through the demo recharge route. **Never enable demo recharges alongside real payments.**
3. Configure a publicly reachable HTTPS webhook: `https://your-domain/api/payments/webhook`. Subscribe to `payment.captured`, with the matching webhook secret.
4. Enable automatic capture in Razorpay. Authorized-but-not-captured payments are not credited.
5. Test successful, failed, cancelled, delayed, and repeated payment events with your own account before using live keys.

No Razorpay credentials were supplied during development, so real provider checkout has not been exercised. The included tests verify wallet behavior and payment matching/duplicate prevention. Payment Gateway collection and RazorpayX withdrawals use separate server credentials and balances.

References: [Razorpay integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

## Preview build

`npm run build:demo` compiles a browser-only demo for static hosting. It stores sample accounts on that browser, with PBKDF2-hashed sample passwords. This is for UI exploration only: local storage is editable and is not a security boundary. No Razorpay requests or real money are involved. Never enter a real account password in the demo.

The normal `npm run build` talks to `/api` and uses MongoDB via the Express server. Demo behavior is selected explicitly at build time; backend failures never silently become demo transactions.

## Verification

`npm test` exercises the IST midnight boundary, catch-up/cap behavior, insufficient funds, repeated purchases, withdrawal limits, payment amount/currency/capture checks, duplicate payment events, and VIP caps.

## Remaining production work

Email ownership verification, production bot protection, password recovery, audited accounting/ledger export, reconciliation of unresolved recharge orders, refunds/disputes, operational alerts/backups, and a funding/business model for returns need completion before broad production use. Bank account format validation does not verify account ownership. Referral codes track invitations only; no referral commission is configured. The single-document wallet design is suitable for a bounded prototype, not an unbounded production transaction history.

Photo: [Luwadlin Bosman on Unsplash](https://unsplash.com/photos/a-black-and-white-photo-of-a-piano-lU6-LbPvZSg), used under the [Unsplash License](https://unsplash.com/license).

## Configure real bank withdrawals

1. Activate RazorpayX payouts for your business and fund its source account. Gateway settlements and a wallet balance in this app do not automatically fund RazorpayX.
2. Set RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER (your business source account), RAZORPAYX_WEBHOOK_SECRET, and BANK_DATA_KEY. Generate BANK_DATA_KEY as 32 random bytes encoded in hex and keep it stable, backed up, and secret. Losing it prevents queued beneficiary details from being decrypted.
3. Allowlist your backend's outbound IP address in RazorpayX. Deploy the Node service with persistent MongoDB on an HTTPS domain. The supplied Dockerfile builds the API-backed frontend, never the static demo.
4. Configure https://your-domain/api/payouts/webhook and subscribe to payout.pending, payout.queued, payout.initiated, payout.processed, payout.updated, payout.failed, payout.reversed, payout.rejected and payout.cancelled when available. Use the payout webhook secret.
5. Run provider test-mode end-to-end validation first. Switch both Gateway and RazorpayX to live credentials together, set NODE_ENV=production, DEMO_PAYMENTS=false, USE_MEMORY_DB=false, and use a separate live database. Existing test-mode accounts are blocked from spending in live mode.
6. The worker sends and reconciles persisted withdrawals. Requests use a stable X-Payout-Idempotency UUID and a persisted request body. A timeout never releases reserved funds or creates a new payout identity. Failed/reversed/rejected/cancelled payouts restore the wallet once after a matching provider result. Webhooks fetch the current payout status to handle delayed/out-of-order delivery; processed withdrawals are also polled for 7 days for late reversals.

Full bank numbers are AES-256-GCM encrypted and omitted from account API responses. History shows only the last four digits. Secrets, source account numbers, and provider request bodies are never sent to the frontend. There is no automatic beneficiary penny-drop/ownership verification in this version. Enable the RazorpayX approval workflow in your provider dashboard if operator approval is required.

The included tests mock provider responses and perform local MongoDB/API checks. No live provider payment or bank transfer was executed during development.

Provider references: [Bank payout API](https://razorpay.com/docs/api/x/payouts/create/bank-account/), [mandatory idempotency](https://razorpay.com/docs/api/x/payout-idempotency/), [payout life cycle and reversals](https://razorpay.com/docs/x/payouts/states-life-cycle/).
