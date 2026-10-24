import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatQuantity } from "@/lib/inventory-status";
import { purchaseOrderRef, readSupplierOrderToken } from "@/lib/supplier-order-token";
import AcceptOrderButton from "./AcceptOrderButton";

/**
 * src/app/supplier/orders/[token]/page.tsx
 *
 * Where the link in the supplier's email lands. PUBLIC — a supplier has no
 * login; the signed token in the URL is the credential
 * (lib/supplier-order-token.ts).
 *
 * ⚠️ Opening this page changes nothing. Email scanners and link previews open
 * every link they see; the order is only accepted when a person presses the
 * button, which POSTs to /api/supplier/orders/[token]/accept.
 *
 * ⚠️ Not cached (`force-dynamic`): the status here has to be the real one the
 * moment the supplier — or the restaurant — changes it.
 *
 * ⚠️ No `sm:` classes anywhere in this project (globals.css sets
 * `--breakpoint-sm: 320px`, so `sm:` applies on phones too).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supplier order",
  // A private link — keep it out of search results, and out of the Referer
  // header of anything the page links to.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function formatWhen(date: Date, timeZone: string) {
  return date.toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SupplierOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // A bad, edited or foreign link is simply "not found" — never a hint as to
  // whether the order id exists.
  const purchaseOrderId = readSupplierOrderToken(token);
  if (!purchaseOrderId) notFound();

  const [po, settings] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        status: true,
        note: true,
        orderedAt: true,
        createdAt: true,
        acceptedAt: true,
        receivedAt: true,
        supplier: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            quantityOrdered: true,
            inventoryItem: { select: { name: true, unit: true } },
          },
        },
      },
    }),
    getRestaurantSettings(),
  ]);

  // A DRAFT was never sent to anyone, so no email could carry this link.
  if (!po || po.status === "DRAFT") notFound();

  const tz = settings.timezone;
  const ref = purchaseOrderRef(po.id);

  return (
    <main className="min-h-screen bg-[#F9F6F3] px-4 py-10 font-sora text-black md:py-16">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <p className="font-frank-ruhl text-[28px] font-bold leading-none text-black">Cuisine</p>

        <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
          <div className="flex flex-col gap-2">
            <h1 className="font-frank-ruhl text-[24px] font-semibold leading-tight text-black md:text-[30px]">
              Order {ref}
            </h1>
            <p className="text-[13px] leading-[1.7] text-black/70">
              For <strong className="font-semibold text-black">{po.supplier.name}</strong> · placed{" "}
              {formatWhen(po.orderedAt ?? po.createdAt, tz)}
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {po.items.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-4 rounded-[12px] bg-[#F9F6F3] px-4 py-3"
              >
                <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium text-black">
                  {line.inventoryItem.name}
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-black">
                  {formatQuantity(line.quantityOrdered, line.inventoryItem.unit)}
                </span>
              </li>
            ))}
          </ul>

          {po.note && (
            <p className="text-[13px] leading-[1.7] text-black/70">
              Note from the restaurant: {po.note}
            </p>
          )}

          {po.status === "ORDERED" && <AcceptOrderButton token={token} />}

          {po.status === "ON_THE_WAY" && po.acceptedAt && (
            <StatusNote tone="purple" title="You accepted this order">
              Accepted on {formatWhen(po.acceptedAt, tz)}. Cuisine is expecting the delivery — thank
              you!
            </StatusNote>
          )}

          {po.status === "RECEIVED" && (
            <StatusNote tone="green" title="Delivered">
              {po.receivedAt
                ? `Cuisine confirmed the delivery on ${formatWhen(po.receivedAt, tz)}. `
                : ""}
              Thank you — nothing more to do.
            </StatusNote>
          )}

          {po.status === "CANCELLED" && (
            <StatusNote tone="red" title="This order was cancelled">
              Cuisine cancelled this order, so there is nothing to deliver. No action needed.
            </StatusNote>
          )}
        </div>
      </div>
    </main>
  );
}

const TONES = {
  purple: "bg-[#EBE0FF] text-[#5A00FF]",
  green: "bg-[#E8FFEC] text-[#0A8F00]",
  red: "bg-[#FAE7EC] text-[#D72A37]",
} as const;

function StatusNote({
  tone,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[12px] px-4 py-3 ${TONES[tone]}`}>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] leading-[1.6]">{children}</p>
    </div>
  );
}
