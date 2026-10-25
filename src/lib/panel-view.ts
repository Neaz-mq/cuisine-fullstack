import { headers } from "next/headers";
import { PANEL_VIEW_HEADER, type PanelView } from "@/lib/panel-url";

/**
 * src/lib/panel-view.ts
 *
 * Which panel an OWNER is looking at right now: "KITCHEN" when they opened
 * /kitchen/..., "MANAGER" for /manager/..., null for the normal admin
 * panel. Always null for every other role — a real Kitchen or Manager user
 * already gets their panel from their own role.
 *
 * The proxy sets the header (src/proxy.ts) and clears it on every other
 * request, so it can't be forged. It only ever NARROWS what is shown (the
 * sidebar, the dashboard); it never grants anything — pages and API routes
 * still check the owner's real role from the database.
 */
export async function getPanelView(realRole?: string | null): Promise<PanelView | null> {
  if (realRole !== "OWNER") return null;
  const value = (await headers()).get(PANEL_VIEW_HEADER);
  return value === "KITCHEN" || value === "MANAGER" ? value : null;
}