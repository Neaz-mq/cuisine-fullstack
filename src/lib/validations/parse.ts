import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * src/lib/validations/parse.ts
 *
 * Every existing API route hand-rolls its own `if (!field) return
 * NextResponse.json({ error: "..." }, { status: 400 })` checks. That works
 * but doesn't scale: no type inference on `body`, easy to forget a field,
 * and every route reinvents its own error-message wording.
 *
 * `parseBody` is the single place that turns "raw request -> validated,
 * typed data" for a route. It keeps the same response shape the rest of
 * the app already uses ( {error: string}, status 400 ) so existing
 * frontend error-handling code (which reads `data.error`) keeps working
 * unchanged when a route is migrated to this.
 *
 * Usage inside a route handler:
 *
 *   const parsed = await parseBody(req, createMenuItemSchema);
 *   if (parsed instanceof NextResponse) return parsed;
 *   const { title, description, price, categoryId } = parsed; // fully typed
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<z.infer<S> | NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: firstIssueMessage(result.error), fieldErrors: fieldErrors(result.error) },
      { status: 400 }
    );
  }

  return result.data;
}

/**
 * Same idea as parseBody, but for validating query params (e.g.
 * `?page=2&limit=20`) parsed from a URLSearchParams into an object first.
 */
export function parseQuery<S extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: S
): z.infer<S> | NextResponse {
  const obj = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(obj);
  if (!result.success) {
    return NextResponse.json(
      { error: firstIssueMessage(result.error), fieldErrors: fieldErrors(result.error) },
      { status: 400 }
    );
  }
  return result.data;
}

/** One human-readable line for the top-level `error` field — e.g.
 * "price: Expected number, received string". Keeps existing callers that
 * only read `data.error` (not `data.fieldErrors`) working the same as
 * before, without a list dump. */
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request body";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Full path -> message map, for callers (mainly admin forms) that want to
 * highlight every invalid field at once instead of just the first one. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!(path in out)) out[path] = issue.message;
  }
  return out;
}