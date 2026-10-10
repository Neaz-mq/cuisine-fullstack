# Cuisine — Full-Stack Restaurant Management System

**Live demo:** [cuisine-fullstack.vercel.app](https://cuisine-fullstack.vercel.app/)

A production-oriented restaurant platform covering the full loop: customers
browse the menu, order online or scan a table QR code to order dine-in, pay
by card or cash, and track their order live — while staff run the kitchen,
tables, reservations, inventory, coupons, offers, loyalty, and delivery
from a role-based admin dashboard.

Built with Next.js App Router, Prisma/PostgreSQL, and Stripe. The emphasis
throughout is on getting the hard parts right rather than the visible ones:
server-verified pricing, exact decimal money, atomic claims on anything that
represents money or stock, a single source of truth for order state
transitions, idempotent payment webhooks, and RBAC that re-reads the
database instead of trusting a session token.

## Features

### Customer-facing

- **Menu & ordering** — browse by category, cart, guest or signed-in
  checkout with card (Stripe Checkout) or cash on delivery, optional tip
- **QR table ordering** — scan a table's QR code to order dine-in with no
  app or account needed
- **Combos, offers & coupons** — combo deals, per-item offer prices shown on
  the menu and charged at checkout, and discount codes
- **Loyalty tiers** — Bronze to Platinum tiers derived from the points
  balance, an automatic tier discount at checkout, points earned on
  delivered orders, and points redeemable for money off
- **Order tracking** — live order status, kitchen ETA, and a live map of the
  delivery rider's location
- **Live chat** — chat directly with the assigned delivery rider during an
  active delivery
- **Reservations** — book a table online (with an optional Stripe-paid
  deposit), manage your bookings, and cancel; serializable double-booking
  protection
- **Ask Cuisine AI** — a food assistant for menu, offers, hours, orders and
  points questions. Runs on Groq and falls back to a rule-based answer when
  the model is unavailable, so the chat never just breaks
- **Smart upsell** — "pairs well with" suggestions derived from what past
  customers actually ordered together
- **Downloadable menu** — the menu as a PDF
- **Reviews** — rate completed orders; staff moderate them and can reply by
  email
- **Accounts** — email/password or Google sign-in, optional two-step
  sign-in with an emailed code, saved addresses, profile photo, order
  history, and one-tap "order again"
- **Emails** — order confirmation and status updates

### Staff / admin dashboard

Role-scoped access across seven staff roles (Owner, Manager, Waiter,
Cashier, Delivery, Kitchen, Cleaner). Cleaner is a record-only role with no
admin access.

- **Kitchen display** — live incoming orders with status updates
- **Order management** — full order lifecycle, payment status, rider
  assignment, and full or partial Stripe refunds
- **Tables & reservations** — table management with downloadable QR codes
- **Menu, categories & combos** — with image upload and per-item recipes
- **Offers & coupon engine** — per-item offers, plus fixed/percent coupons
  with usage limits, per-customer limits, item/category restrictions, and
  partial-cart discounts
- **Loyalty** — points ranking, manual adjustments, and configurable tiers
  and earn rules
- **Reviews** — approve, reject, and reply
- **Payments** — payment overview and configurable payout/transaction
  methods
- **Staff management** — role assignment, activate/deactivate accounts,
  rider document review, owner-only access to sensitive fields
- **Marketing** — broadcast emails to opted-in customers via Resend
  audiences
- **Insights** — sales and order analytics, menu profitability, and an
  AI-written business summary generated on demand
- **Settings** — currency and decimal places, timezone, kitchen hours, tax
  (inclusive/exclusive, separate dine-in and delivery rates), service
  charge, delivery fees and zones, tipping, reservation deposit, and
  low-stock alerts
- **Notifications & exports** — in-app notification feed, and CSV export
  on most list pages

### Rider panel (Delivery role)

- **Deliveries** — claim available orders, mark pickup and delivery, share
  live location, and chat with the customer
- **Cash handling** — track cash-on-delivery collected versus handed in;
  the restaurant confirms each hand-in
- **Earnings & payouts** — earnings charts, cash-out requests with a saved
  payout method, and a daily earnings summary email (Vercel Cron)
- **Profile** — vehicle details, identity documents (stored in a private
  Supabase bucket), notifications, and preferences

On the admin side, managers confirm cash hand-ins and approve payouts.

### Inventory

- **Stock tracking** — every ingredient carries a running balance backed by
  an append-only `StockMovement` ledger, with low-stock and emergency
  thresholds
- **Recipes** — each menu item declares what it consumes, and stock is
  deducted automatically when an order moves to `PREPARING`
- **Restocking** — recorded from the admin screen, with cost per unit
  carried forward
- **Wastage & adjustments** — manual entries, always with a reason
  attached. The API and business logic are in place; there is no admin
  screen for them yet
- **Suppliers** — supplier directory in the admin
- **Purchase orders** — draft, order, and receive stock, with
  cost-per-unit carried forward on receipt. The API and business logic are
  in place; there is no admin screen for purchase orders yet

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Database | PostgreSQL via Prisma 6 (Rust-free client + `@prisma/adapter-pg`) |
| Auth | NextAuth v5 (credentials + Google OAuth, optional email two-step) |
| Payments | Stripe Checkout + webhooks |
| Realtime | Supabase Realtime (live chat); order tracking and the rider map poll every 15 seconds |
| Storage | Supabase Storage (menu images, private rider documents) |
| Email | Resend + React Email |
| AI | Groq (customer assistant, business summaries) |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Maps | Leaflet / React-Leaflet, Nominatim geocoding |
| PDF & QR | pdf-lib (menu PDF), qrcode (table QR codes) |
| Monitoring | Sentry |
| Hosting | Vercel (with Vercel Cron) |
| Testing | Vitest |
| CI | GitHub Actions (lint, test, build on every push and PR) |

## Design Notes

The parts of this codebase worth reading, and why they look the way they do.

### Money is `Decimal`, not `Float`

Every money column is `Decimal(12,3)`, handled through `lib/money.ts`. An
earlier `Float` model drifted under repeated arithmetic — a gift card spent
down in several steps ended at roughly `1.8e-15` instead of `0`, so it read
as "still has balance" forever. `Float` remains only where exactness doesn't
matter: nutrition values, map coordinates, and ingredient quantities.

### Orders snapshot the rules they were priced under

Each order stores its own currency, decimal places, tax mode and rate, and
tax name. If the restaurant changes currency or tax next month, last
month's receipt still says exactly what happened. The currency and its
decimal places are saved together because Stripe takes amounts in minor
units (a multiplier of `10^currencyMinorUnits`) — a mismatched pair would
charge ¥1,200 as 120000.

### Atomic claims, not check-then-act

Anything that represents money or stock is claimed with a conditional
`updateMany` whose affected-row count decides the winner — never a read
followed by a write. Under PostgreSQL's default `READ COMMITTED` isolation,
two concurrent transactions cannot see each other's uncommitted rows, so a
"check if it's still available, then take it" pattern lets both succeed.

This applies to coupon redemption (`consumeCoupon`), loyalty point
redemption, inventory deduction (`Order.stockDeductedAt`), loyalty points
awarded (`Order.pointsAwarded`), and payment confirmation in the Stripe
webhook. Reservation booking uses a `Serializable` transaction for the same
reason.

### One place that knows the order lifecycle

`lib/order-state-machine.ts` defines every legal status transition. Routes
ask it rather than checking statuses inline. This exists because the rules
had drifted apart: assigning a rider used to write `OUT_FOR_DELIVERY`
directly, skipping `PREPARING` — and since `PREPARING` is where ingredients
are deducted, every order dispatched that way consumed real stock and
recorded nothing.

### Cancellation reverses everything

`lib/cancel-order.ts` returns stock, releases the coupon redemption,
refunds redeemed loyalty points, and reverses awarded points — in one
transaction. An abandoned Stripe checkout runs the same path, so a customer
who closes the payment tab doesn't lose points or a coupon to an order
nobody ever paid for.

### Ledgers are append-only

`StockMovement` and `LoyaltyTransaction` (and the retained
`GiftCardTransaction`) are never edited or deleted. A reversal is a new
compensating row, so the history of what actually happened stays intact and
balances can always be reconciled against it.

### Sorted locking

Multi-row inventory updates always acquire locks in sorted ID order, so two
orders touching the same ingredients in different sequences can't deadlock.

### Authorization reads the database

The session JWT carries a role, but it's written once at login and never
refreshed — so demoting a manager wouldn't take effect until their token
expired. `lib/require-admin.ts` therefore reads the current role and active
status from the database on every guarded request and ignores the token's
copy entirely.

### Rust-free Prisma for serverless

The generated client uses `engineType = "client"` with the
`@prisma/adapter-pg` driver adapter. There is no native query-engine binary
to bundle, which removes a class of Vercel deployment failures where the
`.so.node` file never reached the serverless bundle.

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (e.g. [Supabase](https://supabase.com) or
  [Neon](https://neon.tech))
- A [Stripe](https://stripe.com) account (test mode is fine)
- A [Resend](https://resend.com) account for transactional email
- The [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook
  testing

Optional: a [Sentry](https://sentry.io) project and a
[Groq](https://groq.com) API key. Both no-op cleanly when unset (without a
Groq key, the AI assistant falls back to rule-based answers).

### 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` (via `postinstall`), which writes the
client to `src/generated/prisma`.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values — see the comments in `.env.example` for where to get
each one (database URL, `AUTH_SECRET`, Google OAuth credentials, Stripe
keys, Supabase keys, Resend key).

Note that `DATABASE_URL` and `DIRECT_URL` are separate on purpose: the app
runs queries through the connection pooler (`DATABASE_URL`), while Prisma
migrations use a direct connection (`DIRECT_URL`, read by
`prisma.config.ts`).

Also set `CRON_SECRET` if you want the daily rider earnings email — the
cron endpoint refuses to run without it.

### 3. Set up the database

```bash
npx prisma migrate dev
npx prisma db seed
```

This applies all migrations and seeds the menu/category data.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Forward Stripe webhooks (for local payment testing)

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET` in
`.env`, then restart the dev server (env changes need a full restart).

### Creating a staff account

New sign-ups default to the `CUSTOMER` role. To create the **first Owner**,
register a normal account, then update that user's `role` **and add a
`StaffProfile` row** via Prisma Studio (`npx prisma studio`) or directly in
the database.

Both are required — the guards fail closed for a staff-role user with no
profile row, so setting the role alone will lock the account out rather than
grant access.

Once an Owner exists, add everyone else from **Admin → Staff**, which
creates the user and profile together.

### Deploying to Vercel

- Set the same environment variables in the Vercel project.
- Point a Stripe webhook endpoint at `/api/webhooks/stripe` and use its
  signing secret as `STRIPE_WEBHOOK_SECRET`.
- `vercel.json` registers the daily rider earnings cron
  (`/api/cron/rider-earnings-summary`, 18:10 UTC).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

### Demo-data helper

`scripts/relabel-order-currency.ts` changes the currency label on existing
orders. It is meant **only for demo or seeded databases** — it relabels
(৳500 becomes $500) and does **not** convert amounts, which would falsify
real order history.

```bash
npx tsx scripts/relabel-order-currency.ts --from BDT --to USD        # dry run
npx tsx scripts/relabel-order-currency.ts --from BDT --to USD --yes  # apply
```

## Project Structure

```
src/
  app/
    (auth)/       # login, register, forgot/reset password
    (main)/       # customer-facing pages (menu, cart, checkout, track, etc.)
    admin/        # staff dashboard and rider panel, scoped by role
    api/          # route handlers (REST-style, Zod-validated)
  auth.ts         # NextAuth config (credentials + Google)
  auth.config.ts  # edge-safe subset, imported by proxy.ts
  proxy.ts        # route-level auth/role guards (Next.js 16's middleware)
  lib/            # business logic, RBAC, Stripe, email, validations
    __tests__/    # unit tests
  components/     # shared UI components
  emails/         # React Email templates
  generated/      # Prisma client output (generated, not committed)
prisma/
  schema.prisma   # data model, heavily commented with design rationale
  migrations/     # migration history
  seed.ts         # menu/category seed data
prisma.config.ts  # Prisma CLI config (schema, migrations, seed)
vercel.json       # Vercel Cron schedule
vitest.config.mts # test config
```

## Security Notes

- All prices are recomputed server-side at checkout — the client never
  supplies a trusted price.
- Payment status is only ever confirmed via a signature-verified Stripe
  webhook event, never a client-side redirect.
- Staff role **and** active status are re-read from the database on every
  guarded request, so demoting or deactivating a staff member takes effect
  immediately rather than when their session expires.
- Google sign-in requires a verified email, closing the pre-registered
  account takeover vector. Email/password accounts can add an emailed
  two-step code.
- Login, registration, order creation, reservations, code-validation, and
  AI-assistant endpoints are IP-rate-limited.
- The cron endpoint requires a `CRON_SECRET` bearer token.
- Rider identity documents are kept in a private storage bucket.
- Security headers (CSP, HSTS, `frame-ancestors 'none'`, nosniff,
  Referrer-Policy, Permissions-Policy) are applied to every response.

## Known Limitations

Documented rather than hidden — these are understood trade-offs, not
oversights:

- **Gift cards are switched off.** Selling and redeeming them is disabled,
  and the Stripe webhook ignores any late gift-card session. The
  `GiftCard` tables and the gift-card fields on `Order` remain so existing
  records and receipts stay intact.
- **Parts of inventory are API-only.** Purchase orders and
  wastage/adjustment entries have no admin screens yet; the API and
  business logic exist, the UI does not.
- **Rate limiting is process-local.** It deters casual scripted abuse but
  is not a distributed guarantee across serverless instances; a shared
  store such as Upstash Redis would be needed for that.
- **`ChatMessage` needs RLS before production.** Supabase Realtime required
  a `SELECT` grant to the `anon` role, and Prisma doesn't enable Row Level
  Security on the tables it creates. Enable RLS with an order-scoped policy
  — or move chat to SSE/polling through the existing API — before exposing
  this to real customers.
- **Reservations have no explicit duration.** Slot length is a constant
  (90 minutes) in application code rather than an `endsAt` column, so variable-length
  bookings aren't expressible yet.
- **Test coverage is uneven.** Pricing, coupons, loyalty, permissions,
  refunds, and checkout validation are covered. The order state machine,
  cancellation, stock deduction, and the Stripe webhook have no dedicated
  unit tests yet.
- **Stripe doesn't support merchant accounts in every region**, including
  Bangladesh. A local gateway (SSLCommerz, ShurjoPay, bKash) would be
  required for a real deployment there.

## License

See [LICENSE](./LICENSE) for terms. Contributions: see
[CONTRIBUTING.md](./CONTRIBUTING.md).