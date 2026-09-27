import { redirect } from "next/navigation";

/**
 * /account/orders → /account
 *
 * In Figma "My Orders" IS the customer panel's main page, so the order
 * list lives at /account now. This address keeps old links (emails,
 * bookmarks, the footer's "Track Your Order") working.
 */
export default function MyOrdersRedirect() {
  redirect("/account#order-history");
}
