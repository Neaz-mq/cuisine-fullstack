import { exportInventoryHandler } from "@/lib/inventory-api";

/**
 * GET /api/admin/inventory/export?q=&status=
 *
 * /admin/inventory's "Export Report" — exactly the list on screen (same
 * search, same status filter). The logic is in lib/inventory-api.ts, shared
 * with the kitchen panel's export (which leaves the cost column out).
 */
export async function GET(request: Request) {
  return exportInventoryHandler(request, {
    scope: "inventory",
    rateKey: "inventory-export",
    includeCost: true,
  });
}
