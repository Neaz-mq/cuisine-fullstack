# Cuisine — Full-Stack Restaurant Management System

A production-oriented restaurant platform covering the full loop: customers
browse the menu, order online or scan a table QR code to order dine-in, pay
by card or cash, and track their order live — while staff run the kitchen,
tables, reservations, coupons, gift cards, loyalty, and delivery from a
role-based admin dashboard.

Built with Next.js App Router, Prisma/PostgreSQL, and Stripe, with a focus
on getting the details right: server-verified pricing, idempotent payment
webhooks, scoped RBAC for six staff roles, and live order/delivery tracking
over Supabase Realtime.

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
- **Reservations** — book a table online
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
- **Gift card management**
- **Staff management** — role assignment, activate/deactivate accounts
- **Marketing** — broadcast emails to customers via Resend audiences
- **Insights** — sales and order analytics
- **My Deliveries** — a rider's own view for sharing live location and
  chatting with the customer

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth v5 (credentials + Google OAuth) |
| Payments | Stripe Checkout + webhooks |
| Realtime | Supabase Realtime (live chat, live delivery tracking) |
| Storage | Supabase Storage (menu images) |
| Email | Resend + React Email |
| Validation | Zod |
| Styling | Tailwind CSS |
| Maps | Leaflet / React-Leaflet |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (e.g. [Supabase](https://supabase.com) or
  [Neon](https://neon.tech))
- A [Stripe](https://stripe.com) account (test mode is fine)
- A [Resend](https://resend.com) account for transactional email
- The [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook
  testing

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
first, then update that user's `role` (and add a `StaffProfile` row) via
Prisma Studio (`npx prisma studio`) or directly in the database.

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
  middleware.ts   # route-level auth/role guards
  lib/            # business logic, RBAC, Stripe, email, validations
  components/     # shared UI components
  emails/         # React Email templates
prisma/
  schema.prisma   # data model
  migrations/     # migration history
  seed.ts         # menu/category seed data
```

## Security Notes

- All prices are recomputed server-side at checkout — the client never
  supplies a trusted price.
- Payment status is only ever confirmed via a signature-verified Stripe
  webhook event, never a client-side redirect.
- Staff access is scoped per-role and re-checked against active-status
  on every request (a deactivated staff member's existing session stops
  working immediately).
- Login and other abuse-prone endpoints are IP-rate-limited.

## License

Not currently licensed for reuse — all rights reserved.