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
import SuppliersToolbar from "@/app/admin/suppliers/SuppliersToolbar";
import { SupplierProductsPill } from "@/app/admin/suppliers/SupplierProductsPill";

export const metadata = { title: "Suppliers" };

const SUPPLIERS_PER_PAGE = 10;
const DELIVERIES_PER_PAGE = 5;
const BASE_PATH = "/admin/kitchen/suppliers";

/**
 * src/app/admin/kitchen/suppliers/page.tsx
 *
 * "Suppliers" in the Figma kitchen sidebar — the same layout as
 * /admin/suppliers (header · search + status · Overview · Recent
 * Deliveries · Suppliers Information), READ-ONLY:
 *
 *  • no "Add New" button (SuppliersToolbar readOnly),
 *  • no Edit / View / Delete on a supplier row,
 *  • no Resend / Confirm delivery / Cancel on a delivery row (those change
 *    stock and sit behind the "inventory" scope, which KITCHEN lacks).
 *
 * Behind the "kitchen" scope (layout.tsx one level up + requireStaff here),
 * not "suppliers" — so a cook sees who delivers what without being able to
 * edit anything, and the admin Suppliers page stays closed to them.
 *
 * ⚠️ The query for the supplier list is a mirror of /admin/suppliers and of
 * /api/admin/suppliers/export — change one, change all three.
 */
export default async function KitchenSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    period?: string;
    dperiod?: string;
    dpage?: string;
  }>;
}) {
  const session = await requireStaff("kitchen");

  const params = await searchParams;
  const q = params.q?.trim();
  const status = isSupplierStatusFilter(params.status) ? params.status : DEFAULT_SUPPLIER_STATUS;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const period = isOverviewPeriod(params.period) ? params.period : DEFAULT_OVERVIEW_PERIOD;
  const deliveryPeriod = isOverviewPeriod(params.dperiod)
    ? params.dperiod
    : DEFAULT_OVERVIEW_PERIOD;
  const deliveryPage = Math.max(1, parseInt(params.dpage ?? "1", 10) || 1);
  const deliveryRange = overviewPeriodRange(deliveryPeriod);

  // By the purchase order's createdAt, not receivedAt — otherwise "This
  // Month" would drop the Pending / On the Way rows, the ones most worth
  // seeing (same reasoning as /admin/suppliers).
  const deliveryWhere = deliveryRange
    ? { purchaseOrder: { createdAt: { gte: deliveryRange.gte, lt: deliveryRange.lt } } }
    : {};

  const now = new Date();

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
        _count: { select: { purchaseOrders: true } },
      },
    }),
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
            _count: { select: { usedInRecipes: true } },
          },
        },
        purchaseOrder: {
          select: {
            status: true,
            createdAt: true,
            orderedAt: true,
            acceptedAt: true,
            receivedAt: true,
            supplier: { select: { name: true } },
          },
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
      {/* Header row — "Welcome Back, <name>!" + date pill + Export Report. */}
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
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          {/* No `page` in forwardParams on purpose: the export is the whole
              filtered list, not the ten rows on screen. */}
          <ExportReportButton
            endpoint="/api/admin/suppliers/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-suppliers.csv"
          />
        </div>
      </div>

      <SuppliersToolbar status={status} readOnly />

      <SuppliersOverviewCards period={period} />

      {/* --- Recent Deliveries --- */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Recent Deliveries
          </h2>
          <OverviewPeriodFilter value={deliveryPeriod} param="dperiod" />
        </div>

        {deliveries.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {deliveryPeriod === "all"
              ? "No deliveries yet."
              : "No deliveries in this period."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {deliveries.map((line) => {
              const po = line.purchaseOrder;
              const at = po.receivedAt ?? po.acceptedAt ?? po.orderedAt ?? po.createdAt;
              const badge = DELIVERY_STATUS_STYLE[po.status] ?? {
                label: po.status,
                className: "bg-[#F9F6F3] text-black",
              };
              const recipes = line.inventoryItem._count.usedInRecipes;

              return (
                <div
                  key={line.id}
                  className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-16"
                >
                  <div className="flex min-w-0 flex-col gap-1 xl:w-[200px] xl:shrink-0">
                    <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                      {line.inventoryItem.name}
                    </p>
                    <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                      Used in {recipes} menu {recipes === 1 ? "item" : "items"} · {po.supplier.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 xl:flex xl:flex-none xl:items-center xl:gap-16">
                    <InfoField
                      className="xl:w-[100px] xl:flex-none"
                      label="Amount"
                      value={formatQuantity(line.quantityOrdered, line.inventoryItem.unit)}
                    />
                    <InfoField
                      className="xl:w-[205px] xl:flex-none"
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

                  {/* Status badge only — no Resend / Confirm / Cancel here. */}
                  <div className="flex flex-wrap items-center gap-3 xl:min-w-0 xl:flex-1 xl:justify-end">
                    <span
                      className={`flex h-9 w-fit shrink-0 items-center justify-center rounded-full px-3 font-sora text-[14px] font-normal leading-none ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
              basePath={BASE_PATH}
              pageParam="dpage"
            />
          </div>
        )}
      </div>

      {/* --- Suppliers Information --- */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Suppliers Information
          </h2>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {total} {total === 1 ? "supplier" : "suppliers"}
          </span>
        </div>

        {suppliers.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {q || status !== "all" ? "No suppliers match this search." : "No suppliers yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-start xl:flex xl:flex-row xl:items-center xl:gap-6 2xl:gap-[55px]"
              >
                {/* Name + email. */}
                <div className="flex min-w-0 flex-col gap-1 min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[160px] xl:shrink-0">
                  <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
                    {supplier.name}
                  </p>
                  <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                    {supplier.email ?? "—"}
                  </p>
                </div>

                {/* Fields — same three responsive layouts as /admin/suppliers
                    (320 two columns · tablet three columns · desktop one
                    row of five). Wrappers are `contents` on phone/desktop and
                    real flex columns on tablet. */}
                <div className="grid grid-cols-[minmax(0,124fr)_minmax(0,76fr)] gap-x-4 gap-y-5 min-[560px]:col-span-2 min-[560px]:row-start-2 min-[560px]:flex min-[560px]:justify-between min-[560px]:gap-x-8 xl:col-auto xl:row-auto xl:grid xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,160fr)_minmax(0,140fr)_minmax(0,90fr)_minmax(0,120fr)_minmax(0,80fr)] xl:items-center xl:gap-5">
                  <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                    <InfoField
                      className="col-start-1 row-start-1 xl:col-start-1 xl:row-start-1"
                      label="Address"
                      value={supplier.address ?? "—"}
                    />

                    <div className="col-start-1 row-start-3 flex min-w-0 flex-col gap-3 xl:col-start-4 xl:row-start-1">
                      <span className="whitespace-nowrap font-sora text-[12px] font-normal leading-none text-black/70 min-[560px]:text-[13px] xl:text-[14px]">
                        Products
                      </span>
                      <SupplierProductsPill products={supplier.products} />
                    </div>
                  </div>

                  <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                    <InfoField
                      className="col-start-1 row-start-2 xl:col-start-2 xl:row-start-1"
                      label="Phone Number"
                      value={supplier.phone ?? "—"}
                    />

                    <InfoField
                      className="col-start-2 row-start-3 xl:col-start-5 xl:row-start-1"
                      label="Status"
                      value={supplier.isActive ? "Active" : "Inactive"}
                      tone={supplier.isActive ? "positive" : "negative"}
                    />
                  </div>

                  <div className="contents min-[560px]:flex min-[560px]:min-w-0 min-[560px]:flex-col min-[560px]:gap-5 xl:contents">
                    <InfoField
                      className="col-start-2 row-start-1 xl:col-start-3 xl:row-start-1"
                      label="Category"
                      value={supplier.category ?? "—"}
                    />

                    <InfoField
                      className="col-start-2 row-start-2 min-[560px]:hidden"
                      label="Total Orders"
                      value={`${supplier._count.purchaseOrders} ${
                        supplier._count.purchaseOrders === 1 ? "Order" : "Orders"
                      }`}
                    />
                  </div>
                </div>

                {/* No row actions: the kitchen view is read-only. */}
              </div>
            ))}
          </div>
        )}

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
            basePath={BASE_PATH}
          />
        </div>
      </div>
    </div>
  );
}
