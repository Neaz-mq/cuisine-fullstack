import { exportInventoryHandler } from "@/lib/inventory-api";

/**
 * GET /api/admin/kitchen/inventory/export?q=&status= — the Kitchen panel's
 * "Export Report". Same list as /api/admin/inventory/export but without the
 * Cost Per Unit column: the kitchen sees what is running low, not what it costs.
 */
export async function GET(request: Request) {
  return exportInventoryHandler(request, {
    scope: "kitchen",
    rateKey: "kitchen-inventory-export",
    includeCost: false,
  });
}
