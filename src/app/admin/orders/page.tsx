import { type ReactNode } from "react";
import { Calendar } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { formatAmount } from "@/lib/currency-format";
import {
  normalizeDeliveryZones,
  distanceBarRatio,
  type OrderDeliverySnapshot,
} from "@/lib/delivery-zones";
import {
  DEFAULT_OVERVIEW_PERIOD,
  isOverviewPeriod,
  type OverviewPeriod,
} from "@/lib/overview-period";
import {
  DEFAULT_ORDER_STATUS,
  isOrderStatus,
  type OrderStatusFilter,
} from "@/lib/order-status-filter";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import OrdersOverviewCards from "@/components/admin/OrdersOverviewCards";
import Pagination from "./Pagination";
import OrdersToolbar from "./OrdersToolbar";
import OrderStatusSelect from "./OrderStatusSelect";
import OrderRowActions from "./OrderRowActions";
import { type OrderViewData } from "./OrderViewModal";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 10;

/**
 * প্রতিটা অর্ডার **নিজের** মুদ্রায় সাজানো হয়, আজকের settings-এর
 * মুদ্রায় নয়।
 *
 * ⚠️ এই তালিকায় একাধিক মুদ্রা মিশে থাকতে পারে — রেস্তোরাঁ মুদ্রা
 * বদলালে পুরনো অর্ডারগুলো যে মুদ্রায় বসেছিল সেটাই ধরে রাখে। তাই
 * পাতার একটা সাধারণ setting দিয়ে সব সাজালে পুরনো অঙ্কগুলো ভুল
 * মুদ্রায় দেখাত।
 */
function money(
  order: { currency: string; currencyMinorUnits: number },
  value: { toFixed(dp: number): string }
) {
  return formatAmount(value.toFixed(order.currencyMinorUnits), order.currency);
}

/**
 * Figma-র "Order Status" কলামটা — যেখানে "Table - 2" বা "Online" লেখা।
 *
 * ⚠️ নামটা বিভ্রান্তিকর: ওই কলামে অর্ডারের **অবস্থা** নেই, আছে সেটা
 * কোন পথে এসেছে। পাশেই আবার আসল "Status" কলাম। তাই এখানে শিরোনাম
 * "Order Type" রাখা হয়েছে — একই পর্দায় দুটো "Status" থাকলে কোনটা কী
 * সেটা কেউ মনে রাখতে পারত না।
 *
 * ⚠️ `shippingMethod` এখন ঐচ্ছিক (dine-in অর্ডারে থাকে না), তাই
 * "Uber Eats নয় মানেই Food Panda" ধরে নেওয়া যায় না — আগে সেটা নিরাপদ
 * ছিল, এখন null মান ভুল করে "Food Panda" দেখাত।
 */
/**
 * টাকা কীভাবে দেওয়া হবে/হয়েছে।
 *
 * ⚠️ dine-in-এ "Cash on Delivery" লেখাটা অর্থহীন — কিছু delivered
 * হচ্ছে না, খদ্দের টেবিলেই দেন। তাই একই `COD` মানের দুটো আলাদা লেখা।
 */
function paymentLabel(order: {
  orderType: "DELIVERY" | "DINE_IN";
  paymentMethod: string;
}) {
  if (order.paymentMethod !== "COD") return "Online Payment";
  return order.orderType === "DINE_IN" ? "Pay at Table" : "Cash on Delivery";
}

function channelLabel(order: {
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: string | null;
  table: { label: string } | null;
}) {
  if (order.orderType === "DINE_IN") return `Table - ${order.table?.label ?? "—"}`;
  if (order.shippingMethod === "UBER_EATS") return "Uber Eats";
  if (order.shippingMethod === "FOOD_PANDA") return "Food Panda";
  if (order.shippingMethod === "OWN_DELIVERY") return "Our Own Delivery";
  return "Online";
}

/**
 * src/app/admin/orders/page.tsx
 *
 * Figma — Welcome header → search + status → Overview → Orders Lists।
 *
 * ⚠️ এই পাতাটা আগে অ্যাপের নকশা-ব্যবস্থার বাইরে ছিল: `max-w-5xl
 * mx-auto px-4 py-8`, `border-gray-200`, `rounded-md` — নিজের একটা
 * container আর Tailwind-এর ডিফল্ট ধূসর, যেখানে বাকি সব admin পাতা
 * AdminShell-এর ভেতরে cream/orange ব্যবস্থায় চলে। Kitchen, Categories
 * আর Menu-র ক্ষেত্রেও ঠিক এটাই হয়েছিল, আর সারানোটাও একই ছাঁদে।
 *
 * ── দুটো ছাঁকনি, দুটো আলাদা কাজ ─────────────────────────────────────
 *
 *   toolbar-এর "All Statuses"  → **তালিকা** ছাঁকে (URL: ?status=)
 *   Overview-র "All/This Month" → **উপরের চারটে সংখ্যা** (URL: ?period=)
 *
 * search ঘরটা (?q=) তালিকা ছাঁকে, Overview-কে ছোঁয় না — Overview
 * সবসময় পুরো হিসাব দেয়, নাহলে "Total Orders" খুঁজতে খুঁজতে বদলে যেত।
 *
 * ⚠️ pagination server-এ (URL-এ `?page=`), Menu-র মতো client-এ নয়।
 * এখানে একটাই তালিকা আর সারি হাজারও হতে পারে, তাই প্রতিবার সব সারি
 * টেনে আনা যায় না — `skip`/`take` দিয়ে DB-তেই ভাগ হয়।
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; period?: string }>;
}) {
  // layout.tsx-ও `requireStaff("orders")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("orders");
  const params = await searchParams;

  const q = params.q?.trim();
  const status: OrderStatusFilter = isOrderStatus(params.status)
    ? params.status
    : DEFAULT_ORDER_STATUS;
  const period: OverviewPeriod = isOverviewPeriod(params.period)
    ? params.period
    : DEFAULT_OVERVIEW_PERIOD;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const now = new Date();

  // খোঁজার শর্তটা /admin-এর dashboard-এর সাথে ভাগ করা — দেখুন
  // lib/order-search.ts। এখানেও অর্ডার আইডি দিয়ে খোঁজা যায়।
  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL"
      ? { status: status as Prisma.OrderWhereInput["status"] }
      : {}),
    ...(orderSearchFilter(q) ?? {}),
  };

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { menuItem: true } },
        user: true,
        table: true,
        // rider-এর id দরকার শুধু dispatch modal-এর dropdown আগে থেকে
        // বাছা রাখতে — পুরো user সারিটা নয়, তাই `select`।
        deliveryTracking: { select: { riderId: true } },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + orders.length;

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Categories/Menu/Staff/Kitchen-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          {/* forwardParams-এ `page` নেই — export মানে পুরো ছাঁকা তালিকা,
              পর্দায় দেখা দশটা সারি নয়। `period`-ও নেই: ওটা কেবল
              Overview-র সংখ্যা বদলায়, তালিকার একটা সারিও নয়। */}
          <ExportReportButton
            endpoint="/api/admin/orders/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-orders.csv"
          />
        </div>
      </div>

      <OrdersToolbar status={status} />

      <OrdersOverviewCards period={period} />

      {/* --- Orders Lists --- */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Orders Lists
          </h2>
          <span className="shrink-0 font-sora text-[12px] leading-none text-black/70 min-[480px]:text-[14px]">
            {totalCount} {totalCount === 1 ? "order" : "orders"}
          </span>
        </div>

        {orders.length === 0 ? (
          <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
            No orders match that search or filter.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              /**
               * ⚠️ ১২৮০-এর নিচে সারিটা column। ছয়টা কলাম + দুটো বোতাম
               * এক সারিতে ধরাতে অন্তত ১১০০px লাগে; ট্যাবলেটেও সেটা নেই।
               */
              <div
                key={order.id}
                className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-6"
              >
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 min-[640px]:grid-cols-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] xl:items-center xl:gap-x-6">
                  <Field label="Order ID">
                    <span className="truncate font-sora text-[13px] font-medium leading-none text-black">
                      {formatOrderId(order.id)}
                    </span>
                  </Field>

                  <Field label="Order Type">
                    <span className="truncate font-sora text-[13px] leading-none text-black/70">
                      {channelLabel(order)}
                    </span>
                  </Field>

                  <Field label="Customer Name">
                    <span className="truncate font-sora text-[13px] leading-none text-black">
                      {order.user?.name ?? `${order.firstName} ${order.lastName}`}
                      {!order.userId && (
                        <span className="text-black/40"> (Guest)</span>
                      )}
                    </span>
                  </Field>

                  <Field label="Order Placed">
                    <span className="truncate font-sora text-[13px] leading-none text-black/70">
                      {order.createdAt.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                      {", "}
                      {order.createdAt.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </Field>

                  {/**
                   * ⚠️ এই ঘরটা Figma-তে নেই, কিন্তু বাদ দেওয়া যায় না।
                   * অর্ডারের তালিকায় টাকার অঙ্কটাই সবচেয়ে বেশি দেখা
                   * সংখ্যা — পুরনো পাতায় প্রতিটা সারিতে ছিল, আর সেটা
                   * সরিয়ে দিলে প্রতিটা অর্ডারের দাম জানতে ভেতরে ঢুকতে
                   * হতো। নকশায় সম্ভবত ঘরটা ভুলে বাদ পড়েছে।
                   */}
                  <Field label="Total">
                    <span className="truncate font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                      {money(order, order.totalAmount)}
                    </span>
                  </Field>

                  <Field label="Status">
                    <OrderStatusSelect
                      orderId={order.id}
                      currentStatus={order.status}
                      orderType={order.orderType}
                    />
                  </Field>
                </div>

                {/**
                 * ⚠️ প্রস্থটা স্থির (২৮০px, ১২৮০+ এ), যদিও ভেতরে কখনো
                 * একটা বোতাম কখনো দুটো।
                 *
                 * লেখার মাপে ছেড়ে দিলে "Move to Kitchen" থাকা সারিগুলো
                 * চওড়া হয়ে যেত, আর বাঁ দিকের পাঁচটা কলাম ওই সারিতে
                 * চেপে গিয়ে বাকিদের সাথে আর মিলত না — তালিকাটা তখন
                 * টেবিল নয়, এলোমেলো কতগুলো কার্ড দেখাত। screenshot-এ
                 * প্রথম সারিটা ঠিক ওভাবেই বাকিদের থেকে সরে ছিল।
                 *
                 * ২৬২ = View Order (১০৪) + gap ৮ + কাজের বোতাম (১৫০)।
                 * ভেতরের দুটোরও প্রস্থ স্থির — OrderRowActions-এ কেন,
                 * তার ব্যাখ্যা আছে।
                 */}
                <div className="flex xl:w-[262px] xl:shrink-0 xl:justify-end">
                  <OrderRowActions
                    orderId={order.id}
                    status={order.status}
                    orderType={order.orderType}
                    order={viewData(order)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/**
         * Figma — বাঁয়ে "Showing 1-10 of 242 Orders", ডানে page বোতাম।
         *
         * ⚠️ সারির মোট সংখ্যা এক page-এর কম হলে pager লুকোয়, কিন্তু
         * "Showing …" লেখাটা থাকে — মোট কতগুলো অর্ডার আছে সেটা তখনো
         * কাজের তথ্য।
         */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
            <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]"
                aria-hidden="true"
              />
              Showing{" "}
              <span className="font-semibold text-black">
                {firstRow}–{lastRow}
              </span>{" "}
              of <span className="font-semibold text-black">{totalCount}</span> Orders
            </p>

            {totalPages > 1 && (
              <Pagination currentPage={page} totalPages={totalPages} searchParams={params} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * সারির ডেটা → modal যা বোঝে সেই আকার।
 *
 * ⚠️ `Decimal`-গুলো এখানেই লেখা রূপে বদলে যায়। OrderRowActions একটা
 * client component, আর Prisma-র `Decimal` সরল object নয় — সরাসরি
 * পাঠালে Next.js throw করে ("Only plain objects can be passed to
 * Client Components")।
 *
 * ⚠️ ঠিকানাটা এখানেই জোড়া হয়, client-এ নয় — কোন অংশগুলো আছে আর
 * কোনগুলো `null` (dine-in অর্ডারে প্রায় সবই) সেটা এক জায়গায় ঠিক করা
 * থাকলে দুই জায়গায় দুরকম ফল হয় না।
 */
/**
 * Order-এর delivery snapshot → dispatch modal যা বোঝে সেই আকার।
 *
 * ⚠️ ফি-গুলো **এখানেই** সাজানো হয়, client component-এ নয়। currency
 * চিহ্ন আর দশমিক সংখ্যা order-এর নিজের snapshot থেকে আসে (কারণটা
 * lib/currency-format.ts-এ), আর সেটা জানে server। client-কে
 * সিদ্ধান্তটা নিতে দিলে একই পাতায় দুই রকম দশমিক দেখা যেত।
 *
 * ⚠️ তালিকাটা `normalizeDeliveryZones()` দিয়ে যায়, যদিও এটা আমাদের
 * নিজেরই লেখা JSON — কারণ column-টা `Json`, অর্থাৎ database-স্তরে
 * কোনো আকৃতির নিশ্চয়তা নেই। হাতে লেখা SQL বা পুরোনো row যা-ই থাক,
 * একটা নোংরা মান যেন গোটা admin পাতা crash না করায়।
 */
function deliverySnapshot(order: {
  currency: string;
  currencyMinorUnits: number;
  deliveryFee: Prisma.Decimal;
  deliveryZones: Prisma.JsonValue | null;
  deliveryDistanceKm: number | null;
  deliveryZoneLabel: string | null;
  deliveryZoneFallback: boolean;
}): OrderDeliverySnapshot | null {
  // ধাপের তালিকা নেই = FLAT mode-এ বসা অর্ডার, বা এই feature-এর আগের।
  // দুটোতেই modal সরল "Delivery Charge Applied" সারিটাই দেখাবে।
  if (!order.deliveryZones) return null;

  const zones = normalizeDeliveryZones(order.deliveryZones);

  return {
    zones: zones.map((zone) => ({
      id: zone.id,
      label: zone.label,
      feeLabel: formatAmount(zone.fee, order.currency, order.currencyMinorUnits),
      // ⚠️ label মিলিয়ে, fee মিলিয়ে নয় — দুটো ধাপের ফি সমান হতে পারে
      // ("0–1 Km $5" আর "1–3 Km $5"), তখন fee দিয়ে মেলালে দুটোই
      // একসাথে highlight হতো।
      active: zone.label === order.deliveryZoneLabel,
    })),
    distanceKm: order.deliveryDistanceKm,
    barRatio:
      order.deliveryDistanceKm === null
        ? 0
        : distanceBarRatio(order.deliveryDistanceKm, zones),
    appliedFeeLabel: money(order, order.deliveryFee),
    fellBackToFlat: order.deliveryZoneFallback,
  };
}

function viewData(order: {
  id: string;
  email: string | null;
  phone: string;
  address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: string | null;
  paymentMethod: string;
  currency: string;
  currencyMinorUnits: number;
  totalAmount: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  deliveryZones: Prisma.JsonValue | null;
  deliveryDistanceKm: number | null;
  deliveryZoneLabel: string | null;
  deliveryZoneFallback: boolean;
  table: { label: string } | null;
  deliveryTracking: { riderId: string } | null;
  items: {
    id: string;
    quantity: number;
    price: Prisma.Decimal;
    menuItem: { title: string };
  }[];
}): OrderViewData {
  const addressParts = [
    order.address,
    order.apartment,
    order.city,
    order.state,
    order.zip,
    order.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return {
    id: order.id,
    reference: formatOrderId(order.id),
    email: order.email,
    phone: order.phone,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.menuItem.title,
      quantity: item.quantity,
      lineTotal: money(order, item.price.times(item.quantity)),
    })),
    channel: channelLabel(order),
    paymentLabel: paymentLabel(order),
    totalLabel: money(order, order.totalAmount),
    deliveryFeeLabel: money(order, order.deliveryFee),
    riderId: order.deliveryTracking?.riderId ?? null,
    delivery: deliverySnapshot(order),
  };
}

/**
 * এক ঘর — উপরে ছোট label, নিচে মান।
 *
 * ⚠️ label প্রতিটা সারিতেই থাকে, কেবল টেবিলের মাথায় একবার নয়।
 * ১২৮০-এর নিচে সারিটা ভেঙে grid হয়ে যায়, আর তখন উপরের একটা মাত্র
 * শিরোনাম-সারি কোনো কাজেই আসত না — কোন সংখ্যাটা কী, বোঝা যেত না।
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="font-sora text-[11px] font-normal leading-none text-black/50 xl:text-[12px]">
        {label}
      </span>
      {/**
       * ⚠️ মানের ঘরটার উচ্চতা স্থির (`min-h-8`), লেখার উপর ছাড়া নয়।
       *
       * Status ঘরে বসে একটা ৩২px উঁচু dropdown, বাকিগুলোয় কেবল এক
       * লাইন লেখা (~১৬px)। উচ্চতা লেখার হাতে ছাড়লে প্রতিটা সারিতে
       * ওই একটা ঘরই বাকিদের চেয়ে লম্বা হত, আর label গুলো এক
       * সরলরেখায় থাকত না — screenshot-এ "Status" শব্দটা বাকিগুলোর
       * চেয়ে উপরে বসে থাকার কারণ ঠিক এটাই।
       */}
      <span className="flex min-h-8 min-w-0 items-center">{children}</span>
    </div>
  );
}
