import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getPrepList } from "@/lib/kitchen-dashboard-data";
import { filterPrepRows, isPrepStatusFilter } from "@/lib/kitchen-dashboard";

/**
 * GET /api/admin/kitchen/prep-tasks/export?q=&status=
 *
 * The Prep List's "Export Report": the rows on screen (same search, same
 * status filter) — all of them, not just the page shown.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "prep-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const status = isPrepStatusFilter(rawStatus) ? rawStatus : "all";

  const rows = filterPrepRows(await getPrepList(new Date()), {
    q: searchParams.get("q") ?? undefined,
    status,
  });

  const csv = toCsv(
    ["Task", "Quantity", "Status", "Source"],
    rows.map((row) => [
      row.label,
      row.quantityLabel,
      row.done ? "Completed" : "Pending",
      row.taskId ? "Added by staff" : "From orders",
    ])
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-prep-list-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
