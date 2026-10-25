import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { updatePrepTaskSchema } from "@/lib/validations/prep-task";
import { parseBody } from "@/lib/validations/parse";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { done } — tick / untick a hand-added prep task. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const parsed = await parseBody(req, updatePrepTaskSchema);
  if (parsed instanceof NextResponse) return parsed;

  // updateMany so a missing id is a clean 404 instead of a thrown P2025.
  const result = await prisma.prepTask.updateMany({
    where: { id },
    data: { done: parsed.done, doneAt: parsed.done ? new Date() : null },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ id, done: parsed.done });
}

/** DELETE — remove a hand-added task (added by mistake). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const result = await prisma.prepTask.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
