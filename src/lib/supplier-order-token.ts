import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * src/lib/supplier-order-token.ts
 *
 * The link in the "new order" email. A supplier has no account here, so the
 * link itself is the proof that the email reached them:
 *
 *   /supplier/orders/<purchaseOrderId>.<signature>
 *
 * The signature is an HMAC-SHA256 of the order id, keyed with AUTH_SECRET
 * (the same app secret login-code.ts already uses).
 *
 * ── Why a signature and not a random token column ───────────────────────
 *
 *   • Nothing extra in the database, so a leaked backup holds no usable links.
 *   • "Resend" produces the very same link, so an older copy of the email
 *     keeps working — a rotating token would silently kill it.
 *   • The id alone is NOT enough to open the page: without the secret nobody
 *     can compute the signature, so ids can't be guessed or enumerated.
 *
 * ⚠️ What the link allows is deliberately tiny — look at the order and press
 * "Accept". It can't read anything else, and once an order is cancelled or
 * delivered the page only shows its state.
 *
 * No Prisma here on purpose: it's a pure function of (id, secret), so it is
 * trivial to unit-test.
 */

const PURPOSE = "supplier-order-link:v1";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — can't sign supplier order links");
  }
  return secret;
}

function sign(purchaseOrderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${PURPOSE}:${purchaseOrderId}`).digest("base64url");
}

/** `<id>.<signature>` — throws if no app secret is configured. */
export function createSupplierOrderToken(purchaseOrderId: string): string {
  return `${purchaseOrderId}.${sign(purchaseOrderId, getSecret())}`;
}

/**
 * The purchase-order id inside a token, or `null` if the token is malformed or
 * its signature doesn't match. Never throws — a bad link is just "not found".
 */
export function readSupplierOrderToken(token: string | null | undefined): string | null {
  if (!token || token.length > 200) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const purchaseOrderId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  // cuid ids are letters + digits; anything else can't be ours.
  if (!/^[a-z0-9]{10,40}$/i.test(purchaseOrderId)) return null;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[supplier-order] AUTH_SECRET is not set — supplier links can't be verified");
    return null;
  }

  const expected = Buffer.from(sign(purchaseOrderId, secret));
  const given = Buffer.from(signature);
  // timingSafeEqual throws on different lengths, so compare those first.
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? purchaseOrderId : null;
}

export function supplierOrderUrl(purchaseOrderId: string): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${appUrl}/supplier/orders/${createSupplierOrderToken(purchaseOrderId)}`;
}

/** Short, human-readable reference for emails and the supplier page — "PO-3F9K2A". */
export function purchaseOrderRef(purchaseOrderId: string): string {
  return `PO-${purchaseOrderId.slice(-6).toUpperCase()}`;
}
