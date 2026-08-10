# Cuisine — Full-Stack Restaurant Management System

A production-oriented restaurant platform covering the full loop: customers
browse the menu, order online or scan a table QR code to order dine-in, pay
by card or cash, and track their order live — while staff run the kitchen,
tables, reservations, inventory, coupons, gift cards, loyalty, and delivery
from a role-based admin dashboard.

Built with Next.js App Router, Prisma/PostgreSQL, and Stripe. The emphasis
throughout is on getting the hard parts right rather than the visible ones:
server-verified pricing, atomic claims on anything that represents money or
stock, a single source of truth for order state transitions, idempotent
payment webhooks, and RBAC that re-reads the database instead of trusting a
session token.

## Features

### Customer-facing

- **Menu & ordering** — browse by category, cart, checkout with card
  (Stripe Checkout) or cash on delivery
- **QR table ordering** — scan a table's QR code to order dine-in with no
  app or account needed
- **Coupons & gift cards** — apply discount codes and gift card balances at
  checkout, purchase gift cards for others
- **Order tracking** — live order status, kitchen ETA, and a live map of the
  delivery rider's location
- **Live chat** — chat directly with the assigned delivery rider during an
  active delivery
- **Reservations** — book a table online, with serializable double-booking
  protection
- **Smart upsell** — "pairs well with" suggestions derived from what past
  customers actually ordered together
- **Reviews & loyalty** — leave reviews, earn and track loyalty points
- **Accounts** — email/password or Google sign-in, order history

### Staff / admin dashboard

Role-scoped access across six staff roles (Owner, Manager, Waiter, Cashier,
Delivery, Kitchen):

- **Kitchen display** — live incoming orders with status updates
- **Order management** — full order lifecycle, payment status, rider
  assignment
- **Table & reservation management**
- **Menu & category management** — with image upload
- **Coupon engine** — fixed/percent discounts, usage limits, per-customer
  limits, item/category restrictions, partial-cart discounts
- **Gift card management** — issue manually or sell via Stripe, with a full
  transaction ledger
- **Staff management** — role assignment, activate/deactivate accounts,
  owner-only access to sensitive fields
- **Marketing** — broadcast emails to customers via Resend audiences
- **Insights** — sales and order analytics, plus an AI-written weekly
  business summary
- **My Deliveries** — a rider's own view for sharing live location and
  chatting with the customer

### Inventory (API complete, admin UI pending)

- **Stock tracking** — every ingredient carries a running balance backed by
  an append-only `StockMovement` ledger
- **Recipes** — each menu item declares what it consumes, and stock is
  deducted automatically when an order moves to `PREPARING`
- **Wastage & adjustments** — manual entries, always with a reason attached
- **Suppliers & purchase orders** — draft, order, and receive stock, with
  cost-per-unit carried forward on receipt

The API routes and business logic for this are complete and tested; the
`/admin/inventory` screens are the remaining piece.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth v5 (credentials + Google OAuth) |
| Payments | Stripe Checkout + webhooks |
| Realtime | Supabase Realtime (live chat, live delivery tracking) |
| Storage | Supabase Storage (menu images) |
| Email | Resend + React Email |
| AI | Groq (business summaries) |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Maps | Leaflet / React-Leaflet, Nominatim geocoding |
| Monitoring | Sentry |
| Testing | Vitest |
| CI | GitHub Actions (lint, test, build on every push and PR) |

## Design Notes

The parts of this codebase worth reading, and why they look the way they do.

### Atomic claims, not check-then-act

Anything that represents money or stock is claimed with a conditional
`updateMany` whose affected-row count decides the winner — never a read
followed by a write. Under PostgreSQL's default `READ COMMITTED` isolation,
two concurrent transactions cannot see each other's uncommitted rows, so a
"check if it's still available, then take it" pattern lets both succeed.

This applies to coupon redemption (`consumeCoupon`), gift card debits
(`redeemGiftCard`), inventory deduction (`Order.stockDeductedAt`), loyalty
points (`Order.pointsAwarded`), and payment confirmation in the Stripe
webhook.

### One place that knows the order lifecycle

`lib/order-state-machine.ts` defines every legal status transition. Routes
ask it rather than checking statuses inline. This exists because the rules
had drifted apart: assigning a rider used to write `OUT_FOR_DELIVERY`
directly, skipping `PREPARING` — and since `PREPARING` is where ingredients
are deducted, every order dispatched that way consumed real stock and
recorded nothing.

### Cancellation reverses everything

`lib/cancel-order.ts` returns stock, releases the coupon redemption, refunds
the gift card balance, and reverses loyalty points — in one transaction. An
abandoned Stripe checkout runs the same path, so a customer who closes the
payment tab gets their gift card balance back rather than losing it to an
order nobody ever paid for.

### Ledgers are append-only

`StockMovement`, `GiftCardTransaction`, and `LoyaltyTransaction` are never
edited or deleted. A reversal is a new compensating row, so the history of
what actually happened stays intact and balances can always be reconciled
against it.

### Sorted locking

Multi-row inventory updates always acquire locks in sorted ID order, so two
orders touching the same ingredients in different sequences can't deadlock.

### Authorization reads the database

The session JWT carries a role, but it's written once at login and never
refreshed — so demoting a manager wouldn't take effect until their token
expired. `lib/require-admin.ts` therefore reads the current role and active
status from the database on every guarded request and ignores the token's
copy entirely.

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
[Groq](https://groq.com) API key. Both no-op cleanly when unset.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values — see the comments in `.env.example` for where to get
each one (database URL, `AUTH_SECRET`, Google OAuth credentials, Stripe
keys, Supabase keys, Resend key).

Note that `DATABASE_URL` and `DIRECT_URL` are separate on purpose: Prisma
runs queries through the connection pooler and migrations through a direct
connection.

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

New sign-ups default to the `CUSTOMER` role. To create staff (Owner,
Manager, Waiter, Cashier, Delivery, Kitchen), register a normal account
first, then update that user's `role` **and add a `StaffProfile` row** via
Prisma Studio (`npx prisma studio`) or directly in the database.

Both are required — the guards fail closed for a staff-role user with no
profile row, so setting the role alone will lock the account out rather than
grant access.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
  app/
    (auth)/       # login, register
    (main)/       # customer-facing pages (menu, cart, checkout, track, etc.)
    admin/        # staff dashboard, scoped by role
    api/          # route handlers (REST-style, Zod-validated)
  auth.ts         # NextAuth config (credentials + Google)
  auth.config.ts  # edge-safe subset, imported by middleware
  middleware.ts   # route-level auth/role guards
  lib/            # business logic, RBAC, Stripe, email, validations
    __tests__/    # unit tests
  components/     # shared UI components
  emails/         # React Email templates
prisma/
  schema.prisma   # data model, heavily commented with design rationale
  migrations/     # migration history
  seed.ts         # menu/category seed data
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
  account takeover vector.
- Login, registration, order creation, reservations, and code-validation
  endpoints are IP-rate-limited.
- Security headers (CSP, HSTS, `frame-ancestors 'none'`, nosniff,
  Permissions-Policy) are applied to every response.

## Known Limitations

Documented rather than hidden — these are understood trade-offs, not
oversights:

- **Money is stored as `Float`.** Fine for display, but a gift card spent
  down across several partial redemptions accumulates binary
  floating-point drift. Migrating these columns to `Decimal(10,2)` is the
  main outstanding correctness task.
- **Rate limiting is process-local.** It deters casual scripted abuse but
  is not a distributed guarantee across serverless instances; a shared
  store such as Upstash Redis would be needed for that.
- **`ChatMessage` needs RLS before production.** Supabase Realtime required
  a `SELECT` grant to the `anon` role, and Prisma doesn't enable Row Level
  Security on the tables it creates. Enable RLS with an order-scoped policy
  — or move chat to SSE/polling through the existing API — before exposing
  this to real customers.
- **Reservations have no explicit duration.** Slot length is a constant in
  application code rather than an `endsAt` column, so variable-length
  bookings aren't expressible yet.
- **Stripe doesn't support merchant accounts in every region**, including
  Bangladesh. A local gateway (SSLCommerz, ShurjoPay, bKash) would be
  required for a real deployment there.

## License

See [LICENSE](./LICENSE) for terms. Contributions: see
[CONTRIBUTING.md](./CONTRIBUTING.md).