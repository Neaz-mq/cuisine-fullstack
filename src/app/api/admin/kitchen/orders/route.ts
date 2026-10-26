import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { ORDER_VIEW_SELECT, toOrderViewData } from "@/lib/order-view-data";
import { kitchenStageOf } from "@/lib/kitchen-stage";

// The board shows only orders the admin has moved to the kitchen (PREPARING)
// plus READY ones; PLACED orders are still waiting for admin approval and are
// never sent here. A READY order stays in the
// "Ready" column until a rider is assigned (it then becomes OUT_FOR_DELIVERY)
// or, for dine-in, until it is served — so no time window is needed.

export async function GET() {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const orders = await prisma.order.findMany({
    where: { status: { in: ["PREPARING", "READY"] } },
    select: {
      // ⚠️ ORDER_VIEW_SELECT-এ `orderType` আগে থেকেই আছে, তাই এখানে
      // আবার লিখলে TS2783 ("একাধিকবার দেওয়া হয়েছে") — বোর্ডের নিজের
      // দরকারি বাকি কলামগুলোই কেবল যোগ হয়।
      status: true,
      kitchenStartedAt: true,
      firstName: true,
      lastName: true,
      createdAt: true,

      /**
       * modal-এর জন্য পুরো ORDER_VIEW_SELECT-ও আনা হয় — বোর্ডের
       * "View Order" orders টেবিলের একই modal খোলে, আর সেটা ঠিকানা,
       * ফি-ধাপ, দূরত্ব আর চালান চায়।
       *
       * আগে বোর্ড থেকে `/admin/orders/<id>` পাতায় পাঠানো হতো, অর্থাৎ
       * রান্নাঘরের স্ক্রিনটা ছেড়ে বেরিয়ে যেতে হতো — ব্যস্ত সময়ে সেটা
       * কাজের পথে বাধা, আর ফিরে এলে বোর্ডের scroll/sort হারাত।
       *
       * ⚠️ এটা বাড়তি data নয়, একই row-এর বাড়তি কলাম — কোনো নতুন query
       * বা join যোগ হচ্ছে না (deliveryTracking-এর riderId ছাড়া, যেটা
       * dropdown আগে থেকে বাছা রাখতে লাগে)।
       */
      ...ORDER_VIEW_SELECT,
    },
    orderBy: { createdAt: "asc" },
  });

  /**
   * ⚠️ Decimal আর Date সরাসরি JSON-এ পাঠানো হয় না — modal-এর প্রতিটা
   * অঙ্ক server-এ order-এর নিজের currency-তে সাজানো string হিসেবে যায়
   * (toOrderViewData), ঠিক যেমনটা orders টেবিল করে। দুই পথে দুই রকম
   * সাজানো হলে একই অর্ডার দুই পর্দায় দুই অঙ্ক দেখাত।
   */
  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      stage: kitchenStageOf(order) ?? "QUEUED",
      orderType: order.orderType,
      firstName: order.firstName,
      lastName: order.lastName,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        menuItem: { title: item.menuItem.title },
      })),
      table: order.table,
      view: toOrderViewData(order),
    })),
  });
}