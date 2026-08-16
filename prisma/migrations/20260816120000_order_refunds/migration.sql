-- ===========================================================================
-- Refunds
--
-- Until now the system could take money but never give it back. cancelOrder()
-- already reversed stock, coupons, gift cards and loyalty points, but a card
-- charge stayed with the restaurant — and PaymentStatus had no value to even
-- describe the situation.
--
-- ⚠️ The important part of this migration is stripePaymentIntentId.
--
-- Stripe's Refunds API needs a payment intent or charge id, and the checkout
-- webhook was only ever reading `metadata.orderId` off the session and
-- discarding the rest. So orders paid BEFORE this migration have no way back
-- to Stripe: they must be refunded from the Stripe dashboard, and the
-- charge.refunded webhook will record that here. Orders paid after it can be
-- refunded from the admin UI.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. PaymentStatus gains two states
--
-- Both are DERIVED from Order.refundedAmount rather than set by hand — see
-- recomputePaymentStatus() in lib/refund-order.ts. Keeping them in the enum
-- (instead of computing on read) is what lets the admin orders list filter
-- and badge on payment state without an aggregate per row.
-- ---------------------------------------------------------------------------

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- ---------------------------------------------------------------------------
-- 2. Order
-- ---------------------------------------------------------------------------

ALTER TABLE "Order"
  ADD COLUMN "stripePaymentIntentId" text,
  ADD COLUMN "refundedAmount"        numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAt"            timestamp(3);

-- One order, one payment intent. Also stops the charge.refunded webhook from
-- ever attaching a dashboard refund to the wrong order.
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key"
  ON "Order" ("stripePaymentIntentId");

-- ---------------------------------------------------------------------------
-- 3. Refund — an append-only ledger
--
-- Rows are written BEFORE Stripe is called, because a refund is an external
-- side effect a database transaction cannot roll back. Call Stripe first and
-- crash, and the customer has their money while we have no record — and the
-- next click sends it again.
--
-- So: insert PENDING, use the row id as Stripe's idempotency key, then mark
-- SUCCEEDED or FAILED. A crash leaves a visible PENDING row to reconcile
-- instead of a silent double-spend.
-- ---------------------------------------------------------------------------

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "Refund" (
  "id"             text PRIMARY KEY,
  "orderId"        text NOT NULL,
  "amount"         numeric(12,3) NOT NULL,
  "currency"       text NOT NULL,
  "status"         "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "stripeRefundId" text,
  "reason"         text,
  "issuedById"     text,
  "failureReason"  text,
  "createdAt"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      timestamp(3) NOT NULL,

  CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,

  -- SET NULL, not CASCADE: if a staff account is deleted the refund still
  -- happened, and erasing the row would put the ledger out of step with the
  -- money. It just stops naming who did it.
  CONSTRAINT "Refund_issuedById_fkey" FOREIGN KEY ("issuedById")
    REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- The real idempotency guard for the charge.refunded webhook. A refund
-- started from the Stripe dashboard arrives with no row of ours behind it,
-- and Stripe retries deliveries — without this, one dashboard refund could
-- be recorded several times and refundedAmount would exceed what was
-- actually sent back.
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund" ("stripeRefundId");

CREATE INDEX "Refund_orderId_idx" ON "Refund" ("orderId");
CREATE INDEX "Refund_status_idx" ON "Refund" ("status");

-- ⚠️ No backfill, deliberately. Every existing order has refundedAmount 0,
-- which is true: nothing has been refunded through this system yet. If money
-- was sent back manually from the Stripe dashboard in the past, that history
-- is not reconstructible here and shouldn't be invented — Stripe remains the
-- record for anything before today.
