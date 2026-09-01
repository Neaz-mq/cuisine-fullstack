import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import {
  STOCK_STATE_STYLE,
  isInventoryStatusFilter,
  stockStateOf,
} from "@/lib/inventory-status";

/**
 * GET /api/admin/inventory/export?q=&status=
 *
 * /admin/inventory-এর "Export Report" — পর্দায় যে তালিকাটা দেখা যাচ্ছে
 * ঠিক সেটাই নামে (একই search, একই status-ছাঁকনি)।
 *
 * ⚠️ ছাঁকাটা DB-তে নয়, memory-তে — আর এটা এই route-এর খেয়াল নয়, বাধ্যতা:
 * "currentStock <= reorderThreshold" একটা column-বনাম-column তুলনা,
 * যেটা Postgres indexed WHERE-এ করতে পারে না (schema-র
 * @@index([isActive])-এর মন্তব্যে এই tradeoff আগে থেকেই লেখা)।
 * admin/inventory/page.tsx-ও ঠিক একই কারণে একই কাজ করে — দুটোর
 * যুক্তি এক রাখা জরুরি, নাহলে পর্দায় এক তালিকা আর ফাইলে আরেক।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা: page limit ছাড়া পুরো তালিকা।
  const rate = checkRateLimit(request, "inventory-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const rawStatus = searchParams.get("status");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  const status = isInventoryStatusFilter(rawStatus) ? rawStatus : "all";

  const rows = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      name: true,
      category: true,
      unit: true,
      currentStock: true,
      maxCapacity: true,
      reorderThreshold: true,
      emergencyThreshold: true,
      costPerUnit: true,
      supplier: { select: { name: true } },
      _count: { select: { usedInRecipes: true } },
    },
  });

  const visible = rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (status !== "all" && stockStateOf(row) !== status) return false;
    return true;
  });

  const header = [
    "Name",
    "Category",
    "Unit",
    "Current Stock",
    "Max Capacity",
    "Low Stock Threshold",
    "Emergency Threshold",
    "Status",
    "Cost Per Unit",
    "Supplier",
    "Used In Recipes",
  ];

  const rowsOut = visible.map((row) => [
    row.name,
    // ⚠️ ফাঁকা, "—" নয় — ওটা পর্দার জন্য। spreadsheet-এ একটা dash মানে
    // "এই ঘরে dash লেখা আছে", আর তখন কলাম ধরে ছাঁকা যায় না।
    row.category ?? "",
    row.unit,
    // ⚠️ কাঁচা সংখ্যা, "12 Kg" নয় — একক আলাদা কলামে আছে, আর একটা
    // ঘরে সংখ্যা-আর-লেখা মিশলে spreadsheet সেটা যোগ করতে পারে না।
    String(row.currentStock),
    String(row.maxCapacity),
    String(row.reorderThreshold),
    String(row.emergencyThreshold),
    STOCK_STATE_STYLE[stockStateOf(row)].label,
    row.costPerUnit.toString(),
    row.supplier?.name ?? "",
    String(row._count.usedInRecipes),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-inventory-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
