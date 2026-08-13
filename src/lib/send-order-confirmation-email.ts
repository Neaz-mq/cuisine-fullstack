import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import { formatOrderId } from "@/lib/format-order-id";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";
import { type Money, toMoney } from "@/lib/money";

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
  // Money | number দুটোই নেওয়া হয়: Prisma এখন Decimal দেয়, কিন্তু test
  // আর পুরোনো call site সাধারণ number পাঠায়।
  //
  // ⚠️ অস্থায়ী। এই email-এ এখনো শুধু একটাই মোট অঙ্ক যায় — কর, service
  // charge, delivery fee আর বকশিশের আলাদা লাইন নেই, যদিও Order row-তে
  // চারটেই আছে। পূর্ণ চালান template Stage 3-এ।
  totalAmount: Money | number;
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
          // React email template এখনো number নেয় — display-only, তাই
          // এখানে রূপান্তর নিরাপদ। হিসাব কোনোটাই এই মান দিয়ে হয় না।
          price: toMoney(i.price).toNumber(),
        })),
        totalAmount: toMoney(order.totalAmount).toNumber(),
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