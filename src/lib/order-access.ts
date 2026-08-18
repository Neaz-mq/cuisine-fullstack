import { auth } from "@/auth";
import { loadActiveRole } from "@/lib/require-admin";
import { hasAnyPermission } from "@/lib/permissions";

/**
 * src/lib/order-access.ts
 *
 * "এই request-টা কি এই order-টা দেখতে পারে?" — একটাই উত্তর, একটাই জায়গা।
 *
 * ── কেন এটা দরকার হলো ─────────────────────────────────────────────────
 *
 * GET /api/orders/[id] আর /track/[orderId] দুটোরই কোনো auth ছিল না।
 * PATCH-এ requireApiScopeAny বসানো ছিল, GET-এ কিছুই না। ফলে id জানলেই
 * যে কেউ পেতো: গ্রাহকের নাম, শহর, পুরো চালান, আর — সবচেয়ে খারাপ —
 * deliveryTracking.riderLat/riderLng, অর্থাৎ একজন কর্মীর live GPS।
 *
 * proxy.ts-এর matcher `api` কে বাদ দেয়, তাই edge-এও কিছু আটকাতো না।
 *
 * ── কেন পুরোপুরি login বাধ্যতামূলক করা যায় না ──────────────────────────
 *
 * Guest checkout এই app-এর একটা আসল feature — /api/orders আর
 * /api/checkout/create-session দুটোতেই `userId: session?.user?.id ?? null`
 * লেখা আছে, অর্থাৎ account ছাড়া order করা যায়। ওই গ্রাহকের log in করার
 * কোনো উপায়ই নেই। তার কাছে যা আছে তা হলো confirmation email-এর
 * link — অর্থাৎ order id নিজেই তার একমাত্র প্রমাণপত্র।
 *
 * এটাকে বলে capability URL: unguessable id-ই access token. cuid-এর
 * entropy যথেষ্ট, তাই মডেলটা নিজে থেকে ভুল নয়।
 *
 * ── তাহলে কী বদলালো ───────────────────────────────────────────────────
 *
 * আগে capability model *সব* order-এ প্রযোজ্য ছিল। এখন সেটা কেবল সেই
 * order-গুলোতেই, যেগুলোর কোনো মালিক নেই (userId === null)।
 *
 * order-এ userId থাকা মানে গ্রাহকের account আছে — তার জন্য id-কে
 * password হিসেবে ব্যবহার করার আর কোনো কারণ নেই। order id ফাঁস হওয়ার
 * পথ অনেক: Referer header, browser history, shared link, server log,
 * কাঁধের উপর দিয়ে তাকানো। যার login আছে, তাকে login করানোই সঠিক।
 *
 * ⚠️ denial-এ 404 ফেরত দিতে হবে, 403 নয়। 403 বলে দেয় "এই id-র একটা
 * order আছে, তুমি শুধু দেখতে পাচ্ছো না" — সেটাই enumeration oracle।
 */

export type OrderAccessLevel =
  /** orders / kitchen scope-ওয়ালা সক্রিয় staff। */
  | "staff"
  /** যে account-এ order-টা bound, সেই user নিজে। */
  | "owner"
  /** মালিকহীন (guest) order — unguessable id-ই যার প্রমাণপত্র। */
  | "bearer";

/**
 * Access সিদ্ধান্তের জন্য order থেকে যতটুকু লাগে, ঠিক ততটুকু।
 *
 * পুরো Order না নিয়ে এই সংকীর্ণ রূপটা নেওয়ার কারণ: caller ইতিমধ্যে
 * order-টা load করে ফেলেছে (page হোক বা route), তাই এখানে দ্বিতীয়বার
 * query করার দরকার নেই। শুধু access-এর জন্য একটা বাড়তি round trip
 * প্রতি poll-এ যোগ হতো — tracking page ৫ সেকেন্ডে একবার poll করে।
 */
export interface OrderAccessSubject {
  userId: string | null;
}

/**
 * `null` মানে "দেখতে দেওয়া যাবে না" — caller তখন 404 (route) বা
 * login redirect (page) করবে। ইচ্ছাকৃতভাবে boolean নয়: caller-কে
 * level-টাও জানতে হয়, কারণ staff আর bearer একই জিনিস দেখে না।
 */
export async function resolveOrderAccess(
  order: OrderAccessSubject
): Promise<OrderAccessLevel | null> {
  const session = await auth();
  const viewerId = session?.user?.id;

  if (viewerId) {
    // Role session/JWT থেকে নয়, database থেকে — require-admin.ts-এর
    // একই loadActiveRole. কারণটা ওখানেই বিস্তারিত: JWT-র role সপ্তাহখানেক
    // বাসি থাকতে পারে, আর demote করা কর্মী তখনো পুরোনো দরজা দিয়ে ঢোকে।
    const role = await loadActiveRole(viewerId);

    if (hasAnyPermission(role, ["orders", "kitchen"])) return "staff";

    if (order.userId && order.userId === viewerId) return "owner";
  }

  // মালিকহীন order — guest checkout. id-ই টিকিট।
  if (order.userId === null) return "bearer";

  // এখানে পৌঁছানো মানে: order-টার একজন মালিক আছে, আর requester সে নয়।
  return null;
}

/**
 * Rider-এর live GPS কখন দেখানো যাবে।
 *
 * Access-এর সাথে এটা আলাদা প্রশ্ন, তাই আলাদা function। একজন বৈধ দর্শক
 * (owner-ও) delivery শেষ হওয়ার পরে rider-এর শেষ অবস্থান দেখার কোনো
 * কারণ নেই — ওটা তখন আর order tracking নয়, কর্মী নজরদারি।
 *
 * তাই স্থানাঙ্ক কেবল ঠিক ওই জানালাটুকুতেই যায় যখন সেগুলো কাজে লাগে:
 * order পথে আছে এবং এখনো পৌঁছায়নি। বাইরে গেলে coordinate গুলো null
 * হয়ে যায়, কিন্তু deliveryTracking object টা থেকে যায় — কারণ UI-র
 * chat panel deliveredAt দেখে "চ্যাট বন্ধ" বার্তাটা দেখায়।
 */
export function canSeeRiderLocation(order: {
  status: string;
  deliveryTracking: { deliveredAt: Date | null } | null;
}): boolean {
  if (!order.deliveryTracking) return false;
  if (order.deliveryTracking.deliveredAt !== null) return false;
  return order.status === "OUT_FOR_DELIVERY";
}
