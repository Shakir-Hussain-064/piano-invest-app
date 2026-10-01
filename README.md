# Piano Wealth — MERN application

MongoDB, Express, React and Node application with the supplied BharatPe QR for wallet recharges, owner-reviewed UTR claims, and encrypted bank/UPI withdrawal requests for owner review. Automatic payment gateways and payout integrations are not connected. No demo balances or automatic credits from an unverified UTR are available.

## Plan schedule

All new plans run for 60 midnight IST credits. Amounts below are rupees; storage uses integer paise.

| Plan | Purchase | Daily credit | Days | Total return including principal |
|---|---:|---:|---:|---:|
| Prelude | 500 | 100 | 60 | 6,000 |
| Harmony | 1,000 | 200 | 60 | 12,000 |
| Melody | 2,500 | 500 | 60 | 30,000 |
| Symphony | 5,000 | 1,000 | 60 | 60,000 |
| Maestro | 10,000 | 2,000 | 60 | 1,20,000 |
| VIP Virtuoso | 10,000 | 3,000 | 60 | 1,80,000 |
| VIP Grand Maestro | 25,000 | 7,500 | 60 | 4,50,000 |
| VIP Concerto | 30,000 | 9,000 | 60 | 5,40,000 |
| VIP Opus | 40,000 | 12,000 | 60 | 7,20,000 |

Standard plans return 12× the purchase amount in total; VIP plans return 18×. These totals include principal: ₹500 → ₹6,000 total means ₹5,500 net gain. Scheduled credits depend on operator funding; payment processing does not generate this income. Rates live in shared/domain.js. Existing purchases keep their original immutable term snapshots.

The first credit occurs at the next midnight in Asia/Kolkata, potentially less than 24 hours after purchase. A continuously running worker checks every 15 seconds and catches up missed days after downtime. Credits stop at the purchased plan's total.

## QR recharge and review

1. Sign up and log in, open Add money, select ₹100–₹1,00,000, then Continue to payment.
2. A logo-free QR at public/payment-qr-clean.png is displayed. It was regenerated from the exact complete original QR payload; decoding both confirms identical content. No payee, provider address or payment metadata was changed. Run node scripts/regenerate-qr.js to reproduce and verify it. Removing a visual logo does not hide the actual recipient/provider from UPI apps.
3. Payment is sent through the QR's actual merchant/payment account. The website neither moves these funds nor confirms their settlement. The printed recipient is **SHAKIR HUSAIN**. App branding is **Piano Wealth**, but it cannot override the verified recipient shown by a bank or UPI app. A merchant-name change must be arranged with BharatPe/the bank.
4. The customer submits the 12-digit UPI UTR. A globally unique MongoDB index prevents reusing it across accounts, including rejected claims. Submission creates a pending claim and does not credit the wallet.
5. An enrolled owner opens `/owner` → Recharges. There is no separate bank-approval step or bank API check. Submitted amount and UTR are displayed read-only. The owner selects approve/reject and supplies their password; approval also requires authorization confirmation. No UTR re-entry, amount re-entry or reconciliation-note field is required. The backend reads the saved claim and credits its recorded recipient/amount; client-supplied overrides are ignored. Reviewer, time and an automatic decision note are recorded. Rejection never credits funds. A unique UTR is not proof of payment, so owners should check the evidence before approving.
6. Approval records reviewer, time and note before crediting. The wallet balance and idempotency ledger entry update together using optimistic concurrency. Repeated/concurrent approval cannot credit twice. After a crash, the worker resumes persisted approval intent. Rejection can only affect pending claims and never credits funds.
7. Customers see pending, credit-in-progress, credited or rejected status in Wallet. Rejection reasons are visible to the customer. Then they manually buy a plan using their credited balance.

There is no automatic BharatPe/bank receipt lookup integration. UTR uniqueness checks are not payment validation. Review is a human reconciliation step. A mistyped/rejected UTR remains reserved against reuse; investigate with the owner instead of submitting another person's reference. Do not approve a receipt for more than one customer.

## Owner enrollment

New accounts created with a valid referral code receive a ₹250 wallet welcome bonus, and the referring account receives ₹250. No referral code means no bonus. Both entries use the `referral_bonus` ledger type; plan-earnings totals remain separate. The new account and its credit are saved together before the inviter is credited. Durable pending rewards and stable ledger IDs allow recovery without paying twice. Failed or duplicate signups never reward the inviter. This applies to new referral signups, not historical accounts. Email uniqueness prevents duplicate registered-address signup, but email ownership/person-level verification is not implemented; this is not proof that every registered address represents a different person.

Public signup always creates a regular user; claiming an owner's Gmail address never grants privileges. The operator must enroll an existing account locally, after confirming its identity and control:

```powershell
node scripts/set-owner.js <existing-MongoDB-account-id> <exact-account-email>
```

Both immutable ID and email must match. No public role-setting or bootstrap route exists. Sign in again or refresh to see Profile → Owner dashboard. The requested owner's email for this local installation is user2026testing@gmail.com. Review actions always check the current database role and require the account password, not just the UI flag. Keep database and server access restricted: anyone who can directly change the database can change wallet balances and roles.

## Owner dashboard and login notice

Owner administration now has a dedicated `/owner` route and layout. Owner login automatically routes there, including from the previous `/#owner` address. Owner accounts do not render customer Home/Plans/Wallet/Profile pages or the customer bottom navigation. The `/owner` entry shows a login-only screen when signed out; normal customers are routed back to the customer app and cannot call owner APIs. Owner accounts cannot use customer purchase, withdrawal-request or recharge-claim APIs. Existing customer payment verification safeguards remain unchanged: UTR uniqueness alone never credits a wallet.

The dashboard has Overview, Withdrawals, Recharges and Users sections. Analytics include user count, aggregate available wallet balance, verified and pending recharges, reserved and completed withdrawals, active plans and scheduled daily credits. A searchable, paginated user directory shows account-level balances and plan/withdrawal totals. These are database ledger figures, not the merchant's bank balance. Owner-only endpoints check the role on every request and never expose password hashes or full payout destinations.

After each login, users see an investment-risk and privacy notice. An unchecked acknowledgement is required before financial POST actions. The server stores the latest policy version/time and acknowledges it for that session; a new login or a policy-version change requires acknowledgement again. The notice remains readable from signup and Profile. Policy copy lives in shared/policy.js. It describes voluntary investment, risk of partial/total loss, funding dependency, actual data handling and statutory-rights preservation. It is not an absolute exemption from legal liability or a claim of legal compliance; obtain legal review for the operator's actual business and jurisdiction before publication. Reference: https://www.indiacode.nic.in/bitstream/123456789/15256/5/A2019-35.pdf.

## Run

Use Node.js 22.12+ and persistent MongoDB 7+.

```powershell
npm ci
node scripts/create-env.js
npm run build
npm start
```

Configure .env on the server; never commit it or send secrets in chat:

- MONGODB_URI: persistent MongoDB connection.
- SESSION_SECRET: at least 32 random characters. The setup script generates it.
- NODE_ENV=production and APP_ORIGIN=https://your-domain.example for hosted use behind HTTPS.
- HOST defaults to 127.0.0.1, PORT to 3001. Containers use HOST=0.0.0.0.
- BANK_DATA_KEY: stable 64-hex-character encryption key, generated by setup. Back it up securely.

For local use, run `$env:NODE_ENV='development'; node server/index.js` in PowerShell so cookies work over localhost HTTP. This uses the real MongoDB-backed application, not simulated balances. The server serves dist and /api together at http://127.0.0.1:3001. Health endpoint: /healthz. `npm run dev` starts Vite and the same API during UI work. `docker compose up --build -d` runs the app and MongoDB with a persistent database volume; place an HTTPS proxy in front of the localhost-bound app port.

## Withdrawals

Bank/UPI withdrawal requests reserve the requested balance and appear in the owner portal. Minimum withdrawal is ₹1,000. Beneficiary details remain encrypted using the existing BANK_DATA_KEY. Owners can review or reject requests; rejection refunds reserved funds exactly once. Automatic payout initiation and payout webhooks have been removed. No transfer occurs when a user submits a withdrawal.

Existing financial records remain intact. Previously initiated transfers require external reconciliation; do not refund or retry them without confirming their actual status. No manual paid-status workflow has been added by this removal.

## Security and verification

- MongoDB unique UTR index; request idempotency; server-side amount validation and authorization.
- Password reauthentication for review and withdrawal; bcrypt password hashing.
- MongoDB sessions, HttpOnly/SameSite cookies, secure cookies in production, CSRF checks, rate limits and no-store API responses.
- Restricted CSP without external checkout scripts or frames; React escapes submitted text.
- Encrypted withdrawal destinations (AES-256-GCM); customer responses only contain masked destination details.
- Crash-recoverable approvals, audited reviewer/note/timestamps, concurrency-safe wallet writes.

`npm test` checks plans, IST accrual/caps, purchase replay, QR credit safeguards, owner payout gating and mocked payouts. `npm run test:integration` requires local MongoDB; both suites create/delete only randomly named isolated databases. They verify global duplicate UTR protection, CSRF, owner authorization, exact receipt checks, concurrent approvals/rejections, startup recovery, masked Bank/UPI requests, analytics totals and policy acknowledgement enforcement/reset. No real payments or payouts are made by these tests. Dependency installation audit reported zero known vulnerabilities on the installed dependency tree; that does not replace application security review.

This change has not undergone an independent security audit. Email ownership verification, password recovery, owner MFA, automated bank reconciliation and chargeback/refund operations are not implemented. Embedded wallet histories have MongoDB document-size limits; a dedicated ledger is needed at larger scale. Configure HTTPS, database authentication/backups, operational receipt review and a withdrawal settlement process before public operation. Local automated tests do not prove bank settlement or a successful live payout.
