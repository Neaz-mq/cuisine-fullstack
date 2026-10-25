/**
 * src/lib/kitchen-dashboard-data.ts
 *
 * Loads everything the KITCHEN role's Dashboard, Prep List and Inventory
 * pages show. All rules live in lib/kitchen-dashboard.ts; this file only
 * fetches rows and hands them over.
 *
 * ⚠️ Read-only and role-agnostic on purpose: the KITCHEN role has no
 * "inventory" or "staff" scope, so it can't open those admin pages — but it
 * may SEE the counts ("5 items need attention", "3 chefs on shift") and the
 * read-only ingredient list, which is exactly the narrow glance
 * permissions.ts says a kitchen could be given. Nothing here exposes costs,
 * prices, salaries or contact details.
 */
import { prisma } from "@/lib/prisma";
import { minutesAgo } from "@/lib/time";
import { isShiftOnDuty, isStaffShift } from "@/lib/staff-shift";
import { stockStateOf, type StockState } from "@/lib/inventory-status";
import {
  PREP_TIME_WINDOW_DAYS,
  WAITING_ATTENTION_MINUTES,
  averagePrepMinutes,
  buildPrepSnapshot,
  mergePrepRows,
  percentChange,
  prepTaskToRow,
  summarizeInventory,
  type InventoryGlance,
  type PrepRow,
} from "@/lib/kitchen-dashboard";

export type KitchenDashboardData = {
  totalOrdersWeek: number;
  /** null when last week had no orders to compare with. */
  totalOrdersChange: number | null;
  avgPrepMinutes: number | null;
  waiting: number;
  liveOrders: number;
  inventory: InventoryGlance;
  /** PLACED orders whose dishes use an urgent ingredient. */
  ordersNeedingUrgentStock: number;
  prep: PrepRow[];
  prepRemaining: number;
  chefsOnShift: number;
  chefsTotal: number;
  /** The newest PLACED order — shown in the banner when nothing is urgent. */
  newestOrder: { id: string; customer: string } | null;
};

/** Local midnight — "today" follows the restaurant's time zone (server-timezone.ts). */
function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Orders the Prep List is built from: everything still being cooked
 * (PLACED / PREPARING) plus today's finished ones (READY and beyond), so a
 * row can show as "done" instead of vanishing the moment the last order is
 * started.
 */
function loadPrepOrders(now: Date) {
  const today = startOfDay(now);
  return prisma.order.findMany({
    where: {
      OR: [
        { status: { in: ["PLACED", "PREPARING"] } },
        {
          status: { in: ["READY", "OUT_FOR_DELIVERY", "DELIVERED"] },
          createdAt: { gte: today },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      items: {
        select: {
          quantity: true,
          menuItem: {
            select: {
              ingredients: {
                select: {
                  quantityRequired: true,
                  inventoryItem: { select: { id: true, name: true, unit: true } },
                },
              },
            },
          },
        },
      },
    },
    take: 300,
  });
}

/**
 * Tasks a cook added by hand today (the Prep List's "Add Task"). Today
 * only — yesterday's list is yesterday's shift. Newest first.
 */
function loadPrepTasks(now: Date) {
  return prisma.prepTask.findMany({
    where: { createdAt: { gte: startOfDay(now) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, quantity: true, unit: true, done: true },
  });
}

/** The full Prep List: hand-added tasks + rows derived from live orders. */
export async function getPrepList(now: Date): Promise<PrepRow[]> {
  const [orders, tasks] = await Promise.all([loadPrepOrders(now), loadPrepTasks(now)]);
  return mergePrepRows(buildPrepSnapshot(orders), tasks.map(prepTaskToRow));
}

export async function getKitchenDashboardData(now: Date): Promise<KitchenDashboardData> {
  const startOfToday = startOfDay(now);

  // Rolling 7 days (today included) vs the 7 days before — same window the
  // admin dashboard's "vs last week" uses.
  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - (PREP_TIME_WINDOW_DAYS - 1));
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - PREP_TIME_WINDOW_DAYS);

  const notCancelled = { status: { not: "CANCELLED" as const } };

  const [
    thisWeek,
    lastWeek,
    prepRows,
    waiting,
    liveOrders,
    inventoryRows,
    kitchenStaff,
    prepOrders,
    prepTasks,
    newest,
  ] = await Promise.all([
    prisma.order.count({ where: { ...notCancelled, createdAt: { gte: weekStart } } }),
    prisma.order.count({
      where: { ...notCancelled, createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.order.findMany({
      where: { dispatchedAt: { gte: weekStart }, preparingAt: { not: null } },
      select: { preparingAt: true, dispatchedAt: true },
      take: 500,
    }),
    prisma.order.count({
      where: { status: "PLACED", createdAt: { lte: minutesAgo(WAITING_ATTENTION_MINUTES) } },
    }),
    // Same set the Live Orders board shows (admin/kitchen/page.tsx).
    prisma.order.count({
      where: { status: { in: ["PLACED", "PREPARING", "READY"] } },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        currentStock: true,
        reorderThreshold: true,
        emergencyThreshold: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "KITCHEN", staffProfile: { is: { isActive: true } } },
      select: { staffProfile: { select: { shift: true } } },
    }),
    loadPrepOrders(now),
    loadPrepTasks(now),
    prisma.order.findFirst({
      where: { status: "PLACED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const inventory = summarizeInventory(inventoryRows);

  // Follow-up: how many waiting orders need one of the urgent ingredients.
  const urgentIds = inventory.urgentItems.map((item) => item.id);
  const ordersNeedingUrgentStock =
    urgentIds.length === 0
      ? 0
      : await prisma.order.count({
          where: {
            status: "PLACED",
            items: {
              some: {
                menuItem: { ingredients: { some: { inventoryItemId: { in: urgentIds } } } },
              },
            },
          },
        });

  const prep = mergePrepRows(buildPrepSnapshot(prepOrders), prepTasks.map(prepTaskToRow));

  return {
    totalOrdersWeek: thisWeek,
    totalOrdersChange: percentChange(thisWeek, lastWeek),
    avgPrepMinutes: averagePrepMinutes(prepRows),
    waiting,
    liveOrders,
    inventory,
    ordersNeedingUrgentStock,
    prep,
    prepRemaining: prep.filter((row) => !row.done).length,
    chefsOnShift: kitchenStaff.filter(({ staffProfile }) => {
      const shift = staffProfile?.shift;
      return isStaffShift(shift) && isShiftOnDuty(shift, now);
    }).length,
    chefsTotal: kitchenStaff.length,
    newestOrder: newest
      ? { id: newest.id, customer: `${newest.firstName} ${newest.lastName}`.trim() }
      : null,
  };
}

/* ── Read-only ingredient list (kitchen "Inventory") ─────────────── */

export type KitchenInventoryRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: number;
  maxCapacity: number;
  state: StockState;
};

const SEVERITY: Record<StockState, number> = { out: 0, emergency: 1, low: 2, "in-stock": 3 };

/**
 * Every active ingredient that is not comfortably in stock, worst first. No costs, no supplier — a kitchen only needs to know what is
 * running out, not what it costs.
 */
export async function getKitchenInventoryAttention(): Promise<{
  rows: KitchenInventoryRow[];
  total: number;
}> {
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      currentStock: true,
      maxCapacity: true,
      reorderThreshold: true,
      emergencyThreshold: true,
    },
  });

  const rows = items
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit as string,
      currentStock: item.currentStock,
      maxCapacity: item.maxCapacity,
      state: stockStateOf(item),
    }))
    .filter((row) => row.state !== "in-stock")
    // Worst first (out → emergency → low). Not by raw quantity: 2 Kg of
    // flour and 2 pcs of eggs are not comparable, the state is.
    .sort((a, b) => SEVERITY[a.state] - SEVERITY[b.state] || a.name.localeCompare(b.name));

  return { rows, total: items.length };
}
