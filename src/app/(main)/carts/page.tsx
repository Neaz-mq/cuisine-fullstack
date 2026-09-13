import Carts from "@/components/Carts";
import { getTransactionMethods } from "@/lib/transaction-methods";

/**
 * ⚠️ পাতাটা server component, তাই checkout-এ কোন payment মাধ্যমগুলো
 * দেখা যাবে সেটা server-এ ঠিক হয়ে HTML-এর সাথেই আসে।
 *
 * client-এ fetch করলে প্রথম render-এ হয় সব অপশন দেখা যেত (তারপর একটা
 * উধাও হতো), নয়তো একটাও না — দুটোই খারাপ, কারণ এটা পাতার মূল সিদ্ধান্ত।
 */
export default async function CartsPage() {
  const { payment } = await getTransactionMethods();

  return (
    <main>
      <Carts paymentMethods={payment.filter((method) => method.enabled)} />
    </main>
  );
}
