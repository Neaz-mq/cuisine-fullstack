import { redirect } from "next/navigation";

/** "Payout" is only the sidebar dropdown's name — its pages are Earnings
 *  and Cash Collected. A typed or old link lands on Earnings. */
export default function PayoutPage() {
  redirect("/admin/my-deliveries/earnings");
}
