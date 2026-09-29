import { prisma } from "@/lib/prisma";
import { getResendClient, EMAIL_FROM, describeEmailError } from "@/lib/resend";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmountWithCode } from "@/lib/currency-format";
import OrderStatusEmail from "@/emails/OrderStatusEmail";

/**
 * src/lib/send-order-status-email.ts
 *
 * The "Order Updates" switch on Profile Details (Figma "Preferences").
 * Emails the customer when a delivery order:
 *
 *   OUT_FOR_DELIVERY — "Your order is on its way"
 *   DELIVERED        — "Enjoy your meal" (+ ask for a review)
 *   CANCELLED        — "Your order was cancelled" (staff cancelled it)
 *
 * Who gets it:
 *   • logged-in customers — only while `notifyOrderUpdates` is on;
 *   • guests — always (they typed their email for this order, and have
 *     no account where they could switch it off);
 *   • dine-in orders — never (no email, and they're at the table).
 *
 * The order receipt (send-order-confirmation-email.ts) is NOT affected —
 * a receipt is always sent.
 *
 * Never throws: called from route handlers inside `after()`, once the
 * status change is already saved. A failed email must never undo or
 * block it.
 */

export type OrderUpdateStatus = "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

type Copy = { subject: (code: string) => string; heading: string; message: string; button: string; review?: boolean };

const COPY: Record<OrderUpdateStatus, Copy> = {
  OUT_FOR_DELIVERY: {
    subject: (code) => `Your order ${code} is on its way`,
    heading: "Your order is on its way",
    message: "our rider has picked up your food and is heading to you now. You can follow them live on the map.",
    button: "Track my order",
  },
  DELIVERED: {
    subject: (code) => `Order ${code} delivered — enjoy!`,
    heading: "Enjoy your meal",
    message: "your order has been delivered. We hope you love it — a quick review helps us and other food lovers.",
    button: "Rate your order",
    review: true,
  },
  CANCELLED: {
    subject: (code) => `Order ${code} was cancelled`,
    heading: "Your order was cancelled",
    message:
      "we're sorry — your order was cancelled. If you already paid online, the refund is on its way to your card. Reply to this email if you have any questions.",
    button: "View order",
  },
};

/** Pure: should this order get an update email? (Exported for tests.) */
export function shouldSendOrderUpdate(order: {
  email: string | null;
  orderType: string;
  user: { notifyOrderUpdates: boolean } | null;
}): boolean {
  if (!order.email) return false;
  if (order.orderType === "DINE_IN") return false;
  if (order.user && !order.user.notifyOrderUpdates) return false;
  return true;
}

export async function sendOrderStatusEmail(orderId: string, status: OrderUpdateStatus): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        email: true,
        firstName: true,
        orderType: true,
        totalAmount: true,
        currency: true,
        currencyMinorUnits: true,
        user: { select: { notifyOrderUpdates: true } },
        items: { select: { quantity: true, menuItem: { select: { title: true } } } },
      },
    });
    if (!order || !shouldSendOrderUpdate(order)) return;

    const copy = COPY[status];
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const code = formatOrderId(order.id);
    const trackUrl = `${appUrl}/track/${order.id}${copy.review ? "?review=1" : ""}`;

    const { error: refused } = await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: order.email as string,
      subject: copy.subject(code),
      react: OrderStatusEmail({
        firstName: order.firstName || "there",
        orderCode: code,
        heading: copy.heading,
        message: copy.message,
        itemsLabel: order.items.map((line) => `${line.quantity}× ${line.menuItem.title}`).join(", "),
        totalLabel: formatAmountWithCode(order.totalAmount.toFixed(order.currencyMinorUnits), order.currency),
        buttonLabel: copy.button,
        buttonUrl: trackUrl,
        previewText: `${copy.heading} — ${code}`,
        settingsUrl: order.user ? `${appUrl}/account/profile#preferences` : null,
      }),
    });
    // Resend returns a refusal instead of throwing — log it, or it vanishes.
    if (refused) {
      console.error(`[order-status-email] couldn't send ${status} email for ${orderId}: ${describeEmailError(refused)}`);
    }
  } catch (error) {
    console.error(`[order-status-email] couldn't send ${status} email for ${orderId}:`, error);
  }
}
