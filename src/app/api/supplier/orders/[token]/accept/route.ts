import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSupplierOrderToken } from "@/lib/supplier-order-token";
import { acceptPurchaseOrderAsSupplier } from "@/lib/supplier-order";

/**
 * POST /api/supplier/orders/[token]/accept
 *
 * PUBLIC — no login. The signed link from the supplier's email is the only
 * credential (lib/supplier-order-token.ts). Moves the order
 * Pending → On the Way; the admin sees it in Notifications.
 *
 * ⚠️ POST, never GET. Mail scanners and link previewers open every URL in an
 * email — if opening the page accepted the order, an antivirus would "accept"
 * orders on the supplier's behalf. The page (GET) only shows the order; this
 * handler runs when a person presses the button.
 *
 * Under /api, so proxy.ts (login redirects) doesn't touch it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Casual abuse guard (see lib/rate-limit.ts for what this does and doesn't do).
  const limit = checkRateLimit(req, "supplier-order-accept", { limit: 30, windowMs: 10 * 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { token } = await params;
  const purchaseOrderId = readSupplierOrderToken(token);
  if (!purchaseOrderId) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  const result = await acceptPurchaseOrderAsSupplier(purchaseOrderId);
  if (!result.ok) {
    if (result.reason === "cancelled") {
      return NextResponse.json(
        { error: "This order was cancelled by the restaurant." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: result.status, alreadyAccepted: result.alreadyAccepted });
}
