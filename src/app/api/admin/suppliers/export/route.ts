import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { Prisma } from "@/generated/prisma/client";
import { isSupplierStatusFilter } from "@/lib/supplier-status";

/**
 * GET /api/admin/suppliers/export?q=&status=
 *
 * /admin/suppliers-এর "Export Report" বোতামের পেছনের route — Users আর
 * Staff export-এর হুবহু প্রতিরূপ। পর্দায় যে তালিকাটা দেখা যাচ্ছে ঠিক
 * সেটাই নামে (একই search, একই status-ছাঁকনি), শুধু page-এর ১০টা সারি
 * নয়, পুরোটা।
 *
 * ⚠️ scope "inventory", "staff" নয় — /api/admin/suppliers-এর সাথে
 * মেলানো। পাতা আর তার API কখনো "কে ঢুকতে পারবে" নিয়ে দ্বিমত করা
 * উচিত নয়।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("inventory");
  if (authResult instanceof NextResponse) return authResult;

  // Users/Staff export-এর একই সীমা, একই কারণ: page limit ছাড়া পুরো
  // তালিকা, আর এতে যোগাযোগের তথ্য এক ফাইলে জমা হয়।
  const rate = checkRateLimit(request, "suppliers-export", {
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
  const q = searchParams.get("q")?.trim();
  const rawStatus = searchParams.get("status");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়, শুধু
  // ছাঁকনিটা খুলে যায়। বাকি export route-গুলোতেও একই আচরণ।
  const status = isSupplierStatusFilter(rawStatus) ? rawStatus : "all";

  /**
   * ⚠️ এই শর্তটা admin/suppliers/page.tsx-এর শর্তের হুবহু প্রতিরূপ হতে
   * হবে — নাহলে পর্দায় এক তালিকা আর ফাইলে আরেক। page.tsx-এ বদলালে
   * এখানেও বদলাতে হবে।
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

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      category: true,
      products: true,
      isActive: true,
      createdAt: true,
      // "কতগুলো purchase order" — পর্দার Products pill-এর বদলে, কারণ
      // একটা CSV ঘরে দশটা পণ্যের নাম comma দিয়ে ঢোকালে সেটা আর
      // spreadsheet-এ ছাঁকা যেত না।
      _count: { select: { purchaseOrders: true } },
    },
  });

  const header = [
    "Name",
    "Email",
    "Phone",
    "Address",
    "Category",
    "Products Supplied",
    "Status",
    "Purchase Orders",
    "Added On",
  ];

  const rows = suppliers.map((supplier) => [
    supplier.name,
    // ⚠️ ফাঁকা, "—" নয় — ওটা পর্দার জন্য। spreadsheet-এ একটা dash মানে
    // "এই ঘরে dash লেখা আছে", আর তখন কলাম ধরে ছাঁকা যায় না।
    supplier.email ?? "",
    supplier.phone ?? "",
    supplier.address ?? "",
    supplier.category ?? "",
    // ⚠️ একটা ঘরে semicolon দিয়ে জোড়া, comma দিয়ে নয় — CSV-তে comma
    // ঘরের বিভাজক, আর toCsv সেটা quote করে বাঁচায় বটে, কিন্তু তখন
    // spreadsheet-এ ঘরটা পড়া কঠিন হয়। semicolon-এ সেই দ্বৈততা নেই।
    supplier.products.join("; "),
    supplier.isActive ? "Active" : "Inactive",
    String(supplier._count.purchaseOrders),
    // ISO তারিখ, "Jul 3, 2026" নয় — spreadsheet এটাকে তারিখ হিসেবে
    // চেনে আর সাজাতে পারে, আর locale বদলালেও অর্থ বদলায় না।
    supplier.createdAt.toISOString().slice(0, 10),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-suppliers-${status}-${stamp}.csv"`,
      // যোগাযোগের তথ্য — কোনো proxy বা CDN যেন ধরে না রাখে।
      "Cache-Control": "no-store",
    },
  });
}
