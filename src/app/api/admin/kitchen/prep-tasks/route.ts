import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPrepTaskSchema } from "@/lib/validations/prep-task";
import { parseBody } from "@/lib/validations/parse";

/**
 * POST /api/admin/kitchen/prep-tasks — the Prep List's "Add Task" modal.
 *
 * Scope "kitchen" (the page's own scope), so a cook can add a task without
 * being given any wider permission.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  // Not a security limit, a runaway-client limit (a stuck double-click or a
  // script) — far above what a person types in a shift.
  const rate = checkRateLimit(req, "prep-task-create", { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tasks added. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(req, createPrepTaskSchema);
  if (parsed instanceof NextResponse) return parsed;

  const task = await prisma.prepTask.create({
    data: {
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      createdById: authResult.user.id,
    },
    select: { id: true, name: true, quantity: true, unit: true, done: true },
  });

  return NextResponse.json(task, { status: 201 });
}
