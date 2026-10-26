import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";
import OrderStatusSelect from "../OrderStatusSelect";
import PaymentStatusBadge from "../PaymentStatusBadge";
import AssignRiderPanel from "./AssignRiderPanel";
import RefundPanel from "./RefundPanel";
import OrderPhoneField from "./OrderPhoneField";
import { requireAdmin } from "@/lib/require-admin";
import { hasPermission } from "@/lib/permissions";
import { formatAmount } from "@/lib/currency-format";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Refunds are their own scope — issuing money back is a different
  // responsibility from moving an order through its statuses, so a role
  // can be allowed one without the other (see lib/permissions.ts).
  const session = await requireAdmin();
  const canRefund = hasPermission((session.user as { role?: string }).role, "refunds");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { menuItem: true } },
      user: true,
      table: true,
      deliveryTracking: { select: { riderId: true } },
      // Newest first — the usual question is "what was the last thing we
      // sent back", not the first.
      refunds: {
        orderBy: { createdAt: "desc" },
        include: { issuedBy: { select: { name: true, email: true } } },
      },
    },
  });

  if (!order) notFound();

  const isDineIn = order.orderType === "DINE_IN";

  // This order's own currency, not today's settings.
  const units = order.currencyMinorUnits;
  const money = (value: { toFixed(dp: number): string }) =>
    formatAmount(value.toFixed(units), order.currency);
  const positive = (value: { greaterThan(n: number): boolean }) => value.greaterThan(0);

  // ── Refund state ─────────────────────────────────────────────────────
  //
  // Refundable amount is measured against totalAmount — what was actually
  // charged to the card — not grandTotal. Anything paid with a gift card
  // or loyalty points never reached Stripe, so it cannot come back from
  // there; cancelOrder() returns that to the ledger instead.
  const refundable = order.totalAmount.minus(order.refundedAmount);
  const isOnline = order.paymentMethod === "ONLINE";
  const isPaid =
    order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";

  // REFUNDED is checked before the generic !isPaid branch on purpose:
  // "not paid" and "fully refunded" are opposite situations (no money ever
  // moved vs. all of it already came back) and staff reading this message
  // need to be able to tell them apart at a glance.
  const refundBlockedReason = !isOnline
    ? "This order was paid in person, so there is nothing to send back through Stripe."
    : order.paymentStatus === "REFUNDED"
      ? "This order has already been fully refunded."
      : !isPaid
        ? "This order has not been paid, so there is nothing to refund."
        : !order.stripePaymentIntentId
          ? "This order was paid before refunds were supported, so no Stripe payment reference was stored. Refund it from the Stripe dashboard — it will appear here automatically."
          : refundable.lessThanOrEqualTo(0)
            ? "Fully refunded."
            : null;

  // ── Figma "Order details" (Frame 2147236277) ─────────────────────────
  //
  //   white card  padding 30, gap 24, radius 20, shadow 0 4 30 rgba(0,0,0,.06)
  //     header    "Order ID: #…" (Frank Ruhl 30) + "Placed on …" │ status badge
  //     Information  cream box: Email │ Phone (flag + dial) , Address
  //     Items        cream box: ✓ lines │ divider │ subtotal / delivery / VAT
  //     footer    ● channel - payment                       Total: $…
  //
  // Staff-only extras (rider assign, refund, refund history) are kept —
  // the card is the Figma frame, the panels sit right under it.
  const placedDate = order.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const placedTime = order.createdAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const fullAddress = [
    order.address,
    order.apartment,
    [order.city, [order.state, order.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    order.country,
  ]
    .filter(Boolean)
    .join(", ");

  const channelLabel = isDineIn
    ? `Table ${order.table?.label ?? "—"}`
    : order.shippingMethod === "UBER_EATS"
      ? "Uber Eats"
      : order.shippingMethod === "FOOD_PANDA"
        ? "Food Panda"
        : order.shippingMethod === "OWN_DELIVERY"
          ? "Our Own Delivery"
          : "—";
  const paymentLabel =
    order.paymentMethod === "COD" ? (isDineIn ? "Pay at Table" : "Cash on Delivery") : "Online Payment";

  return (
    <div className="mx-auto w-full max-w-[1070px] px-4 py-8">
      <Link
        href="/admin/orders"
        className="mb-4 inline-block font-sora text-[14px] text-black/70 hover:text-black"
      >
        ← Back to all orders
      </Link>

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 shadow-[0_4px_30px_rgba(0,0,0,0.06)] sm:p-[30px]">
        {/* Frame 2147236158 — title block │ status badge */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col justify-center gap-3">
            <h1 className="font-frank-ruhl text-[24px] font-medium leading-[1.3] text-black/70 sm:text-[30px]">
              Order ID: <span className="text-black">{formatOrderId(order.id)}</span>
            </h1>
            <p className="font-sora text-[14px] leading-[1.3] text-black/70 sm:text-[16px]">
              Placed on {placedDate} at {placedTime}
            </p>
          </div>
          <OrderStatusSelect
            orderId={order.id}
            currentStatus={order.status}
            orderType={order.orderType}
            size="lg"
          />
        </div>

        <div className="flex flex-col gap-5">
          {/* Information */}
          <section className="flex flex-col gap-4">
            <h2 className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black">
              Information
            </h2>
            <div className="grid grid-cols-1 gap-4 rounded-[16px] bg-[#F9F6F3] p-4 md:grid-cols-2">
              <InfoField label="Customer Name" className="md:col-span-2">
                {order.firstName} {order.lastName}
                <span className="text-black/50">
                  {" · "}
                  {order.user ? "Registered account" : "Guest checkout"}
                </span>
              </InfoField>

              <InfoField label="Email Address">{order.email ?? "Not provided"}</InfoField>

              <InfoField label="Phone Number">
                <OrderPhoneField phone={order.phone} country={order.country} />
              </InfoField>

              <InfoField label={isDineIn ? "Table" : "Address"} className="md:col-span-2">
                {isDineIn ? `Table ${order.table?.label ?? "—"}` : fullAddress || "—"}
              </InfoField>
            </div>
          </section>

          {/* rider assign: only while the order is "Ready" (or already out).
              Kept from the old page — the assign-rider route is the gate. */}
          {!isDineIn && (order.status === "READY" || order.status === "OUT_FOR_DELIVERY") && (
            <AssignRiderPanel
              orderId={order.id}
              currentRiderId={order.deliveryTracking?.riderId ?? null}
            />
          )}

          {/* Only shown to roles holding the "refunds" scope. Hiding it is not
              the security boundary — the API route checks the same scope —
              but there is no reason to show a control someone can't use. */}
          {canRefund && isOnline && (
            <RefundPanel
              orderId={order.id}
              currency={order.currency}
              remaining={refundable.toNumber()}
              chargedLabel={money(order.totalAmount)}
              refundedLabel={positive(order.refundedAmount) ? money(order.refundedAmount) : null}
              remainingLabel={money(refundable)}
              canRefund={refundBlockedReason === null}
              blockedReason={refundBlockedReason}
            />
          )}

          {/* Items */}
          <section className="flex flex-col gap-4">
            <h2 className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black">
              Items
            </h2>
            <div className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              {/* Frame 2147236141 — ordered lines with the orange tick */}
              <div className="flex flex-col gap-4">
                {order.items.map((item) => (
                  <BillRow
                    key={item.id}
                    ticked
                    label={`${item.quantity}p. ${item.menuItem.title}`}
                    amount={money(item.price.times(item.quantity))}
                  />
                ))}
              </div>

              {/* Rectangle 34628983 — 1px white divider */}
              <div className="h-px w-full bg-white" aria-hidden="true" />

              {/* Frame 2147236142 — The bill. Staff need this as much as the
                  customer does: a refund, a dispute or a cash reconciliation
                  all turn on how much of the total was tax (the
                  government's) and how much was tip (the staff's) — neither
                  is the restaurant's revenue. */}
              <div className="flex flex-col gap-4">
                <BillRow label="Subtotal" amount={money(order.subtotal)} />

                {positive(order.discountAmount) && (
                  <BillRow
                    label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                    amount={`-${money(order.discountAmount)}`}
                    amountClassName="text-[#2C6252]"
                  />
                )}

                {positive(order.tierDiscountAmount) && (
                  <BillRow
                    label="Tier discount"
                    amount={`-${money(order.tierDiscountAmount)}`}
                    amountClassName="text-[#2C6252]"
                  />
                )}

                {positive(order.serviceCharge) && (
                  <BillRow label="Service charge" amount={money(order.serviceCharge)} />
                )}

                {!isDineIn && (
                  <BillRow
                    label="Delivery"
                    amount={positive(order.deliveryFee) ? money(order.deliveryFee) : "Free"}
                  />
                )}

                {positive(order.taxAmount) && (
                  <BillRow
                    label={
                      <>
                        {order.taxName}
                        {/* The rate is shown because it is snapshotted per order —
                            an old invoice charged at 5% must still read 5% after
                            the restaurant moves to 10%. */}
                        <span className="text-black/50">
                          {" @ "}
                          {Number(order.taxRate) * 100}%
                          {order.taxMode === "INCLUSIVE" ? ", included" : ""}
                        </span>
                      </>
                    }
                    amount={money(order.taxAmount)}
                  />
                )}

                {positive(order.giftCardAmount) && (
                  <BillRow
                    label={`Gift card${order.giftCardCode ? ` (${order.giftCardCode})` : ""}`}
                    amount={`-${money(order.giftCardAmount)}`}
                    amountClassName="text-[#2C6252]"
                  />
                )}

                {positive(order.pointsRedeemedAmount) && (
                  <BillRow
                    label={`Points redeemed (${order.pointsRedeemed} pts)`}
                    amount={`-${money(order.pointsRedeemedAmount)}`}
                    amountClassName="text-[#2C6252]"
                  />
                )}

                {positive(order.refundedAmount) && (
                  <BillRow
                    label="Refunded"
                    amount={`-${money(order.refundedAmount)}`}
                    amountClassName="text-sky-700"
                  />
                )}

                {positive(order.tipAmount) && (
                  <BillRow
                    label={
                      <>
                        Tip <span className="text-black/50">(staff, not revenue)</span>
                      </>
                    }
                    amount={money(order.tipAmount)}
                  />
                )}
              </div>
            </div>
          </section>

          {order.refunds.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-frank-ruhl text-[20px] font-medium leading-[1.3] text-black">
                Refund history
              </h2>
              <div className="flex flex-col gap-3 rounded-[16px] bg-[#F9F6F3] p-4">
                {order.refunds.map((refund) => (
                  <div
                    key={refund.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 font-sora text-[14px] text-black/70"
                  >
                    <span>
                      {money(refund.amount)}
                      <span className="text-black/50">
                        {" · "}
                        {refund.createdAt.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {/* No issuer means it came from the Stripe dashboard
                            rather than this app — worth being able to tell
                            apart when reconciling. */}
                        {refund.issuedBy?.name ?? refund.issuedBy?.email ?? "Stripe dashboard"}
                      </span>
                      {refund.reason && <span className="text-black/50"> — {refund.reason}</span>}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        refund.status === "SUCCEEDED"
                          ? "bg-sky-100 text-sky-700"
                          : refund.status === "PENDING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                      title={refund.failureReason ?? undefined}
                    >
                      {refund.status === "SUCCEEDED"
                        ? "Sent"
                        : refund.status === "PENDING"
                          ? "Pending — check Stripe"
                          : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Frame 2147236278 — ● channel - payment │ Total */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 flex-wrap items-center gap-3 font-sora text-[14px] leading-none text-black/70 sm:text-[16px]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            <span>
              {channelLabel} - <span className="text-black">{paymentLabel}</span>
            </span>
            {order.paymentMethod === "ONLINE" && <PaymentStatusBadge status={order.paymentStatus} />}
          </span>
          <span className="font-frank-ruhl text-[16px] font-medium leading-none text-black/70">
            Total:{" "}
            <span className="text-[22px] font-semibold text-black sm:text-[24px]">
              {money(order.totalAmount)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Figma field: label (Frank Ruhl 14) over a white 43px pill (Sora 12, black/70). */
function InfoField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="font-frank-ruhl text-[14px] font-medium leading-[1.6] text-black">
        {label}
      </span>
      <div className="flex min-h-[43px] items-center rounded-[12px] bg-white p-3 font-sora text-[12px] leading-[1.6] text-black/70">
        <div className="min-w-0 break-words">{children}</div>
      </div>
    </div>
  );
}

/** Figma line: [✓] Sora 16 label ………… Frank Ruhl 20 amount (both black/70). */
function BillRow({
  label,
  amount,
  ticked = false,
  amountClassName = "",
}: {
  label: React.ReactNode;
  amount: string;
  ticked?: boolean;
  amountClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex min-w-0 items-center gap-[11px] font-sora text-[14px] leading-[1.6] text-black/70 sm:text-[16px]">
        {ticked && (
          // vuesax/bold/tick-circle — Primary/100 (#FF9540)
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" fill="#FF9540" />
            <path
              d="M7.75 12.2l2.9 2.9 5.6-5.7"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="min-w-0 break-words">{label}</span>
      </span>
      <span
        className={`shrink-0 whitespace-nowrap text-right font-frank-ruhl text-[18px] font-medium leading-none text-black/70 sm:text-[20px] ${amountClassName}`}
      >
        {amount}
      </span>
    </div>
  );
}