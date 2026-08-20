import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import { formatOrderId } from "@/lib/format-order-id";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";
import { type Money, toMoney } from "@/lib/money";
import { formatAmount } from "@/lib/currency-format";

const SHIPPING_LABELS: Record<string, string> = {
  UBER_EATS: "Uber Eats",
  FOOD_PANDA: "Food Panda",
  OWN_DELIVERY: "Our Own Delivery",
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  ONLINE: "Online Payment",
};

// address/city/state/zip/shippingMethod are nullable on the Order model
// because DINE_IN (QR Table Ordering) orders never collect a delivery
// destination — see the comment on Order.email in schema.prisma. This
// email is only ever sent for online-paid DELIVERY orders (see the guard
// below), so these are only null here in practice for DINE_IN orders,
// which this function skips entirely.
interface OrderForEmail {
  id: string;
  email: string | null;
  firstName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // পূর্ণ চালান — Order row-তে যা snapshot করা আছে, হুবহু তাই। আজকের
  // settings থেকে কিছু পুনর্গণনা করা হয় না: email একবার পাঠানো হলে আর
  // সংশোধন করা যায় না, আর গ্রাহক এটাই হিসাবরক্ষককে ফরোয়ার্ড করেন।
  subtotal: Money | number;
  discountAmount: Money | number;
  tierDiscountAmount: Money | number;
  serviceCharge: Money | number;
  deliveryFee: Money | number;
  taxAmount: Money | number;
  taxName: string;
  taxMode: string;
  giftCardAmount: Money | number;
  pointsRedeemedAmount: Money | number;
  tipAmount: Money | number;
  totalAmount: Money | number;
  currency: string;
  currencyMinorUnits: number;

  shippingMethod: string | null;
  paymentMethod: string;
  items: { quantity: number; price: Money | number; menuItem: { title: string } }[];
}

// Called right after an order is created. Never throws — a failed email
// should never take down order creation, since the order itself already
// succeeded in the database by the time this runs. Errors are logged so
// they're visible in server logs without surfacing to the customer.
export async function sendOrderConfirmationEmail(order: OrderForEmail) {
  // DINE_IN orders never collect an email (see the Order.email comment in
  // schema.prisma) — there's nowhere to send a confirmation to, so this is
  // an expected no-op rather than a failure. Since email is only captured
  // for DELIVERY orders, this also guarantees address/city/state/zip/
  // shippingMethod are non-null below.
  if (!order.email) {
    return;
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // এই order-এর নিজের currency অনুযায়ী, আজকের settings অনুযায়ী নয় —
    // পুরোনো ইয়েন চালান আজ টাকার সেটিংয়ে দুই দশমিকে পাঠানো ভুল হতো।
    const units = order.currencyMinorUnits;
    const money = (value: Money) => formatAmount(value.toFixed(units), order.currency);
    const optionalMoney = (value: Money) => (value.greaterThan(0) ? money(value) : null);

    await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: order.email,
      subject: `Order ${formatOrderId(order.id)} confirmed`,
      react: OrderConfirmationEmail({
        firstName: order.firstName,
        orderCode: formatOrderId(order.id),
        items: order.items.map((i) => ({
          title: i.menuItem.title,
          quantity: i.quantity,
          lineTotal: money(toMoney(i.price).times(i.quantity)),
        })),

        subtotal: money(toMoney(order.subtotal)),

        // ছাড়/gift card/point/tip শূন্য হলে null — template তখন লাইনটাই
        // আঁকে না, ফলে সাধারণ একটা অর্ডারের রসিদ ছোটই থাকে।
        discountAmount: optionalMoney(
          toMoney(order.discountAmount).plus(toMoney(order.tierDiscountAmount))
        ),
        serviceCharge: optionalMoney(toMoney(order.serviceCharge)),
        deliveryFee: optionalMoney(toMoney(order.deliveryFee)),
        taxAmount: optionalMoney(toMoney(order.taxAmount)),
        taxName: order.taxName,
        taxIncluded: order.taxMode === "INCLUSIVE",
        giftCardAmount: optionalMoney(toMoney(order.giftCardAmount)),
        pointsRedeemedAmount: optionalMoney(toMoney(order.pointsRedeemedAmount)),
        tipAmount: optionalMoney(toMoney(order.tipAmount)),

        totalAmount: money(toMoney(order.totalAmount)),

        address: order.address ?? "",
        city: order.city ?? "",
        state: order.state ?? "",
        zip: order.zip ?? "",
        shippingMethodLabel: order.shippingMethod
          ? SHIPPING_LABELS[order.shippingMethod] ?? order.shippingMethod
          : "",
        paymentMethodLabel: PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
        trackingUrl: `${appUrl}/track/${order.id}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}