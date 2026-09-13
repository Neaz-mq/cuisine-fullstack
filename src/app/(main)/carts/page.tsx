import Carts from "@/components/Carts";
import { getTransactionMethods } from "@/lib/transaction-methods";

/**
 * ⚠️ `force-dynamic` — পাতাটা build-এর সময় আগেভাগে render করা হয় না।
 *
 * এটা না থাকলে `next build` এই পাতাটাকে static ধরে নিয়ে build-এর
 * সময়েই `getTransactionMethods()` চালাত, আর CI-তে database থাকে না —
 * ফলে `ECONNREFUSED` দিয়ে পুরো build ভেঙে যেত।
 *
 * শুধু build পার করানোর কৌশল নয়, এটাই সঠিক আচরণ: admin যে মুহূর্তে
 * একটা payment method বন্ধ করেন, পরের গ্রাহক যেন সাথে সাথেই সেটা আর
 * না দেখেন। আগেভাগে তৈরি করা HTML সেই বদল ধরতে পারত না।
 */
export const dynamic = "force-dynamic";

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
