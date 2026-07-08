import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import { formatOrderId } from "@/lib/format-order-id";
import OrderConfirmationEmail from "@/emails/OrderConfirmationEmail";

const SHIPPING_LABELS: Record<string, string> = {
  UBER_EATS: "Uber Eats",
  FOOD_PANDA: "Food Panda",
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  ONLINE: "Online Payment",
};

interface OrderForEmail {
  id: string;
  email: string;
  firstName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  totalAmount: number;
  shippingMethod: string;
  paymentMethod: string;
  items: { quantity: number; price: number; menuItem: { title: string } }[];
}

// Called right after an order is created. Never throws — a failed email
// should never take down order creation, since the order itself already
// succeeded in the database by the time this runs. Errors are logged so
// they're visible in server logs without surfacing to the customer.
export async function sendOrderConfirmationEmail(order: OrderForEmail) {
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
          price: i.price,
        })),
        totalAmount: order.totalAmount,
        address: order.address,
        city: order.city,
        state: order.state,
        zip: order.zip,
        shippingMethodLabel: SHIPPING_LABELS[order.shippingMethod] ?? order.shippingMethod,
        paymentMethodLabel: PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
        trackingUrl: `${appUrl}/track/${order.id}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}