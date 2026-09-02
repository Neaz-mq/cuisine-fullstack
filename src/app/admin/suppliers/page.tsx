import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";
import Pagination from "@/app/admin/orders/Pagination";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import SuppliersOverviewCards from "@/components/admin/SuppliersOverviewCards";
import OverviewPeriodFilter from "@/components/admin/OverviewPeriodFilter";
import InfoField from "@/components/admin/InfoField";
import {
  DEFAULT_OVERVIEW_PERIOD,
  isOverviewPeriod,
  overviewPeriodRange,
} from "@/lib/overview-period";
import {
  DEFAULT_SUPPLIER_STATUS,
  DELIVERY_STATUS_STYLE,
  isSupplierStatusFilter,
} from "@/lib/supplier-status";
import { formatQuantity } from "@/lib/inventory-status";
import SuppliersToolbar from "./SuppliersToolbar";
import SupplierRowActions from "./SupplierRowActions";
import { SupplierProductsPill } from "./SupplierProductsPill";

export const metadata = { title: "Suppliers" };

const SUPPLIERS_PER_PAGE = 10;
/**
 * Recent Deliveries-এ প্রতি page-এ কত সারি।
 *
 * ⚠️ Figma-র frame-টা তিনটে সারি ধরে আঁকা (উচ্চতা 454 = 60 padding +
 * 40 header + 24 + 3×80 + 2×16 + 24 + 34), কিন্তু নিচের লেখাটা
 * "Showing 1-5 of 20"। পাঁচটাই নেওয়া হলো — ওটা designer-এর নিজের
 * সংখ্যা, আর তিনটে করে page করলে বিশটা চালান দেখতে সাতবার click
 * করতে হতো। একই "Showing 1-5 of 20" লেখাটা Suppliers কার্ডেও আছে
 * যেখানে নয়টা সারি আঁকা, অর্থাৎ ওটা boilerplate — কিন্তু ৩-এর চেয়ে
 * ৫ ব্যবহারে ভালো।
 */
const DELIVERIES_PER_PAGE = 5;

/**
 * src/app/admin/suppliers/page.tsx
 *
 * ⚠️ এটা আগে একটা `<ComingSoon />` ছিল — "supplier record আর purchase
 * order database ও API-তে আছে, শুধু পর্দাটা বানানো হয়নি"। এখন
 * পর্দাটা বানানো হলো, ওই একই API-র উপরেই।
 *
 * ⚠️ প্রথম দফায় সারিতে "Category" ঘরটা ছিল না, কারণ তখন schema-য়
 * কোনো category ক্ষেত্রই ছিল না — একটা ঘর বসিয়ে চিরকাল "—" দেখানোর
 * চেয়ে না রাখাই সৎ ছিল। Figma-র "Add New Suppliers" modal-এ ঘরটা
 * আসায় `Supplier.category` আর `Supplier.products` দুটোই যোগ হয়েছে,
 * তাই সারিটা এখন নকশার মতোই পূর্ণ: Address · Phone Number ·
 * Category · Products · Status · Edit।
 *
 * ⚠️ "Products" এখন `Supplier.products` থেকে, purchase order থেকে নয়।
 * দুটোর তফাত আছে — একটা "কী দিতে পারেন" (হাতে লেখা), অন্যটা "কী
 * এসেছে" (অর্ডারের ইতিহাস)। সারিতে প্রথমটাই কাজে লাগে, কারণ নতুন
 * সরবরাহকারীর কোনো অর্ডার থাকে না অথচ তিনি কী দেন সেটা জানা থাকে।
 */
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    period?: string;
    /** Recent Deliveries-এর নিজস্ব ছাঁকনি ও page — Overview-এর
     *  `period`/`page`-এর সাথে গুলিয়ে না ফেলার জন্য আলাদা নাম। */
    dperiod?: string;
    dpage?: string;
  }>;
}) {
  // layout-এও "inventory" scope-এর গেট আছে; এখানে session লাগে শুধু
  // শিরোনামের নামটার জন্য।
  const session = await requireStaff("inventory");

  const params = await searchParams;
  const q = params.q?.trim();
  const status = isSupplierStatusFilter(params.status) ? params.status : DEFAULT_SUPPLIER_STATUS;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  // অচেনা মান চুপচাপ ডিফল্টে নামে — URL হাতে বদলে দিলে error নয়।
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;
  const deliveryPeriod = isOverviewPeriod(params.dperiod)
    ? params.dperiod
    : DEFAULT_OVERVIEW_PERIOD;
  const deliveryPage = Math.max(1, parseInt(params.dpage ?? "1", 10) || 1);
  const deliveryRange = overviewPeriodRange(deliveryPeriod);

  /**
   * ⚠️ ছাঁকনিটা PO-র **createdAt** ধরে, `receivedAt` নয় — যদিও সারিতে
   * দেখানো তারিখটা receivedAt হতে পারে। কারণ একটা এখনো-না-আসা চালানের
   * কোনো receivedAt নেই, আর ওগুলো বাদ পড়লে "This Month" বাছলে
   * Pending/On the Way সারিগুলোই উধাও হয়ে যেত — অথচ ওগুলোই সবচেয়ে
   * বেশি দেখার দরকার হয়।
   */
  const deliveryWhere = deliveryRange
    ? { purchaseOrder: { createdAt: { gte: deliveryRange.gte, lt: deliveryRange.lt } } }
    : {};

  const now = new Date();

  /**
   * ⚠️ এই শর্তটা /api/admin/suppliers/export-এর শর্তের হুবহু প্রতিরূপ
   * হতে হবে — নাহলে পর্দায় এক তালিকা আর ফাইলে আরেক, আর সেটা ধরা পড়ে
   * অনেক পরে। একটায় বদলালে অন্যটাতেও বদলাতে হবে।
   */
  const where: Prisma.SupplierWhereInput = {
    ...(status === "all" ? {} : { isActive: status === "active" }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, suppliers, deliveryTotal, deliveries] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * SUPPLIERS_PER_PAGE,
      take: SUPPLIERS_PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        category: true,
        products: true,
        isActive: true,
      },
    }),
    /**
     * Figma-র "Resent Deliveries" — সারিগুলো **পণ্য-ভিত্তিক**, PO-ভিত্তিক
     * নয় ("Chicken Breast · 12 Kg · Jul 12, 2026, 2:30 PM")। তাই query-টা
     * PurchaseOrderItem-এর উপরে, PurchaseOrder-এর নয়।
     *
     * ক্রম PO-র createdAt ধরে, item-এর নয় — একই চালানের পণ্যগুলো
     * পাশাপাশি থাকা উচিত, আর item-এর নিজের কোনো তারিখ নেই।
     */
    prisma.purchaseOrderItem.count({ where: deliveryWhere }),
    prisma.purchaseOrderItem.findMany({
      where: deliveryWhere,
      orderBy: { purchaseOrder: { createdAt: "desc" } },
      skip: (deliveryPage - 1) * DELIVERIES_PER_PAGE,
      take: DELIVERIES_PER_PAGE,
      select: {
        id: true,
        quantityOrdered: true,
        inventoryItem: {
          select: {
            name: true,
            unit: true,
            // Figma-র "Used in 8 menu items" — recipe-এ কতগুলো menu
            // item এই উপকরণটা ব্যবহার করে।
            _count: { select: { usedInRecipes: true } },
          },
        },
        purchaseOrder: {
          select: { status: true, createdAt: true, orderedAt: true, receivedAt: true },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / SUPPLIERS_PER_PAGE));
  const firstOnPage = total === 0 ? 0 : (page - 1) * SUPPLIERS_PER_PAGE + 1;
  const lastOnPage = Math.min(page * SUPPLIERS_PER_PAGE, total);

  const deliveryPages = Math.max(1, Math.ceil(deliveryTotal / DELIVERIES_PER_PAGE));
  const firstDelivery = deliveryTotal === 0 ? 0 : (deliveryPage - 1) * DELIVERIES_PER_PAGE + 1;
  const lastDelivery = Math.min(deliveryPage * DELIVERIES_PER_PAGE, deliveryTotal);

  return (
    <div className="flex flex-col gap-6">
      {/* --- শিরোনাম সারি --- Users/Staff-এর হুবহু একই গড়ন। */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
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
            {/* ⚠️ ৩২০px-এও পুরো তারিখ, বছর সহ — আগে সেখানে "Sep 2"
                দেখানো হতো, জায়গা বাঁচানোর জন্য।
                
                কিন্তু জায়গার টানটা ছিল **মাপের**, লেখার নয়। Figma-র
                ৩২০px frame (Frame 2147232352) বলছে: সারিটা ২৮৮ চওড়া,
                দুটো pill ১৩৯ করে, gap ১০ — আর pill-এর ভেতরে
                padding 12 + icon 20 + gap 8 + লেখা ৭৯ = ১৩১, অর্থাৎ
                ১৩৯-এ আঁটে। শর্ত একটাই: লেখাটা ১২px হতে হবে, ১৪ নয়।

                বছর বাদ দিলে "Sep 2" কোন বছরের তা বোঝার উপায় থাকে না —
                একটা report-এর পাতায় সেটা ঠিক ওই তথ্যটাই যেটা লাগে। */}
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          {/* forwardParams-এ `page` নেই, ইচ্ছাকৃতভাবে — export মানে পুরো
              ছাঁকা তালিকা, পর্দায় দেখা দশটা সারি নয়। */}
          <ExportReportButton
            endpoint="/api/admin/suppliers/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-suppliers.csv"
          />
        </div>
      </div>

      <SuppliersToolbar status={status} />

      <SuppliersOverviewCards period={period} />

      {/* --- Recent Deliveries --- Figma Frame 2147236295। */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        {/* Frame 2147236374: row, space-between, উচ্চতা 40। */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Recent Deliveries
          </h2>
          {/* Figma-তে লেখা "Today", কিন্তু বিকল্পগুলো Overview কার্ডের
              মতোই All / This Month / Previous Month — একই পাতায় দুটো
              ছাঁকনির দুই রকম সময়-বিভাজন থাকলে সেটা শেখা কঠিন। */}
          <OverviewPeriodFilter value={deliveryPeriod} param="dperiod" />
        </div>

        {deliveries.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {deliveryPeriod === "all"
              ? "No purchase orders yet. Deliveries show up here once you raise one from an inventory item."
              : "No deliveries in this period."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {deliveries.map((line) => {
              const po = line.purchaseOrder;
              // ⚠️ তারিখটা "কতদূর এগিয়েছে" ধরে বাছা, সবসময় createdAt নয়।
              // মাল এসে গেলে receivedAt-ই ব্যবহারকারীর কাছে অর্থবহ
              // তারিখ, PO বানানোর দিনটা নয়।
              const at = po.receivedAt ?? po.orderedAt ?? po.createdAt;
              const badge = DELIVERY_STATUS_STYLE[po.status] ?? {
                label: po.status,
                className: "bg-[#F9F6F3] text-black",
              };
              const recipes = line.inventoryItem._count.usedInRecipes;

              return (
                /* Figma Frame 2147236324: row, space-between, padding 16,
                   উচ্চতা 80, radius 16, BG #F9F6F3। */
                <div
                  key={line.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-10"
                >
                  <div className="flex min-w-0 flex-col gap-1 xl:w-[200px] xl:shrink-0">
                    <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                      {line.inventoryItem.name}
                    </p>
                    <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                      Used in {recipes} menu {recipes === 1 ? "item" : "items"}
                    </p>
                  </div>

                  {/* Frame 2147236446: row, gap 40 — Staff সারির একই
                      InfoField, তাই দুই কার্ডের ঘরগুলো এক দেখায়। */}
                  <div className="grid grid-cols-2 gap-4 xl:flex xl:min-w-0 xl:flex-1 xl:items-center xl:gap-10">
                    <InfoField
                      className="xl:flex-[80_1_auto]"
                      label="Amount"
                      value={formatQuantity(line.quantityOrdered, line.inventoryItem.unit)}
                    />
                    <InfoField
                      className="xl:flex-[180_1_auto]"
                      label="Date & Time"
                      value={at.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    />
                  </div>

                  {/* Figma: 109×36, padding 11×12, radius 100, লেখা
                      Sora 400 14px। */}
                  <span
                    className={`flex h-9 w-fit shrink-0 items-center justify-center rounded-full px-3 font-sora text-[14px] font-normal leading-none ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Figma Frame 2147232469 — Suppliers কার্ডের হুবহু একই সারি।
            ⚠️ `pageParam="dpage"`, কারণ এই পর্দায় দুটো আলাদা তালিকা
            আলাদাভাবে page হয়; দুটোই `page` ব্যবহার করলে একটার পাতা
            বদলালে অন্যটাও লাফাত। */}
        {deliveryTotal > 0 && (
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <span className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-black/70">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
              Showing{" "}
              <strong className="font-semibold text-black">
                {firstDelivery}–{lastDelivery}
              </strong>{" "}
              of <strong className="font-semibold text-black">{deliveryTotal}</strong> Deliveries
            </span>

            <Pagination
              currentPage={deliveryPage}
              totalPages={deliveryPages}
              searchParams={params}
              basePath="/admin/suppliers"
              pageParam="dpage"
            />
          </div>
        )}
      </div>

      {/* --- Suppliers Information --- Figma Frame 2147236296। */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Suppliers Information
          </h2>
          {/* ⚠️ Figma-তে এখানে আরেকটা "All ⌄" dropdown — উপরের "All
              Statuses"-এর ঠিক পাশেই, একই জিনিস ছাঁকে। দুটো control একই
              অক্ষ ছাঁকলে ব্যবহারকারীকে ভাবতে হয় "তফাত কী", আর একটা
              বদলে অন্যটা না বদলালে সেটা ভাঙা মনে হয়। তাই ছাঁকনিটা উপরে
              (search-এর পাশে), আর এখানে pill-এর গড়ন রেখে ভেতরে সংখ্যা —
              "কতজন দেখছি" প্রশ্নটার উত্তর এখানেই খোঁজা হয়। Users
              page-এও হুবহু একই সিদ্ধান্ত। */}
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {total} {total === 1 ? "supplier" : "suppliers"}
          </span>
        </div>

        {suppliers.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {q || status !== "all"
              ? "No suppliers match this search."
              : "No suppliers yet. Use “Add New” to create the first one."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {suppliers.map((supplier) => {
              return (
                /**
                 * Figma Frame 2147236338 (ট্যাবলেট): column, padding 16,
                 * gap 16, radius 16, BG #F9F6F3।
                 *
                 * ⚠️ ৫৬০-এর নিচে একটামাত্র কলাম; ৫৬০ থেকে দুই কলামের
                 * grid, যাতে বোতামজোড়া উপরের সারির ডানে নাম/ইমেইলের
                 * পাশে বসতে পারে (Frame 2147236690)। xl-এ আবার এক
                 * সারির flex।
                 *
                 * ⚠️ base-এ `items-start` নেই, ইচ্ছাকৃত: flex-col-এ ওটা
                 * মানে প্রতিটা সন্তান নিজের লেখার মাপে সংকুচিত, তাহলে
                 * মাঠের সারিটা পুরো প্রস্থ পেত না।
                 */
                <div
                  key={supplier.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[55px]"
                >
                  {/* Frame 2147236287: নাম + ইমেইল। */}
                  <div className="flex min-w-0 flex-col gap-1 min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[160px] xl:shrink-0">
                    <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                      {supplier.name}
                    </p>
                    <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                      {supplier.email ?? "—"}
                    </p>
                  </div>

                  {/**
                   * Frame 2147236677 — ঘরগুলো।
                   *
                   * ⚠️ ট্যাবলেটে এটা সমান তিন ভাগের grid নয়, বরং
                   * `justify-content: space-between` দিয়ে ছড়ানো তিনটে
                   * খাড়া কলাম — প্রতিটার ভেতরে উপর-নিচে দুটো ঘর:
                   *
                   *   Address   | Phone Number | Category
                   *   Products  | Status       |
                   *
                   * সমান তিন ভাগ করলে কলামগুলো বসত 0 / 33% / 67%-এ
                   * (আগে ঠিক তাই হতো, আর "Category" মাঝামাঝি ঝুলে
                   * থাকত)। Figma-র নিজের মাপে কলাম 94 · 134 · 67
                   * (মোট 295) আর জায়গা 616, তাই space-between-এর ফাঁক
                   * (616 − 295)/2 = 160.5 — শুরুর বিন্দু 0 / 254.5 / 549,
                   * অর্থাৎ "Category" প্রায় ডান কিনারায়।
                   *
                   * ⚠️ মোড়ক তিনটে base-এ আর xl-এ `contents`, মাঝের
                   * তিরে `flex flex-col`। অর্থাৎ ওরা কেবল ট্যাবলেটেই
                   * সত্যিকারের বাক্স; দুই প্রান্তে মিলিয়ে গিয়ে পাঁচটা
                   * ঘন সরাসরি বাইরের grid-এর ঘর হয়ে যায়।
                   *
                   * ⚠️ xl-এর কলাম-প্রস্থ অবস্থান-ভিত্তিক, অথচ DOM-ক্রম
                   * এখন ট্যাবলেটের ক্রম (Address, Products, Phone,
                   * Status, Category)। তাই প্রতিটা ঘরে স্পষ্ট
                   * `xl:col-start` — auto-placement-এর ভরসায় থাকলে
                   * desktop-এ ক্রম উল্টে যেত। template-টা আগের মতোই
                   * desktop-এর **দেখানোর** ক্রমে: 160=Address,
                   * 140=Phone, 90=Category, 120=Products, 80=Status।
                   */}
                  <div className="grid grid-cols-2 gap-4 min-[560px]:col-span-2 min-[560px]:row-start-2 min-[560px]:flex min-[560px]:justify-between min-[560px]:gap-x-8 xl:col-auto xl:row-auto xl:grid xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,160fr)_minmax(0,140fr)_minmax(0,90fr)_minmax(0,120fr)_minmax(0,80fr)] xl:items-center xl:gap-5">
                    {/* কলাম ১ — Frame 2147236675 */}
                    <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                      <InfoField
                        className="xl:col-start-1 xl:row-start-1"
                        label="Address"
                        value={supplier.address ?? "—"}
                      />

                      {/* Products — InfoField নয়, কারণ মানটা একটা লেখা নয়,
                          একটা pill যেটা খোলা যায়। label-টা তবু হুবহু
                          InfoField-এর মাপে, যাতে সারিটা মেলে। */}
                      <div className="flex min-w-0 flex-col gap-3 xl:col-start-4 xl:row-start-1">
                        <span className="whitespace-nowrap font-sora text-[13px] font-normal leading-none text-black/70 xl:text-[14px]">
                          Products
                        </span>
                        <SupplierProductsPill products={supplier.products} />
                      </div>
                    </div>

                    {/* কলাম ২ — Frame 2147236676 */}
                    <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                      <InfoField
                        className="xl:col-start-2 xl:row-start-1"
                        label="Phone Number"
                        value={supplier.phone ?? "—"}
                      />
                      <InfoField
                        className="xl:col-start-5 xl:row-start-1"
                        label="Status"
                        value={supplier.isActive ? "Active" : "Inactive"}
                        tone={supplier.isActive ? "positive" : "negative"}
                      />
                    </div>

                    {/* কলাম ৩ — Frame 2147236294, একাই */}
                    <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                      <InfoField
                        className="xl:col-start-3 xl:row-start-1"
                        label="Category"
                        value={supplier.category ?? "—"}
                      />
                    </div>
                  </div>

                  <SupplierRowActions
                    supplier={{
                      id: supplier.id,
                      name: supplier.name,
                      email: supplier.email,
                      phone: supplier.phone,
                      address: supplier.address,
                      category: supplier.category,
                      products: supplier.products,
                      isActive: supplier.isActive,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Figma Frame 2147232469: "Showing 1-10 of 242" + pagination। */}
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <span className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-black/70">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing{" "}
            <strong className="font-semibold text-black">
              {firstOnPage}–{lastOnPage}
            </strong>{" "}
            of <strong className="font-semibold text-black">{total}</strong> Suppliers
          </span>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath="/admin/suppliers"
          />
        </div>
      </div>
    </div>
  );
}
