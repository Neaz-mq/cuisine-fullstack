import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getGroqClient } from "@/lib/groq";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validations/parse";
import { getAssistantContext } from "@/lib/ai-assistant/context";
import {
  basicReply,
  buildSystemPrompt,
  directIntent,
  dishesForPrompt,
  parseModelReply,
  type AssistantAnswer,
} from "@/lib/ai-assistant/core";

/**
 * POST /api/ai/chat — "Ask Cuisine AI", the customer food assistant.
 *
 * Body: { messages: [{ role, content }...], cart: [{ id, quantity }...] }
 * The last message is the customer's new question; up to 8 earlier ones
 * give the conversation context.
 *
 * Cost: free. It runs on Groq's free tier (GROQ_API_KEY, already used by
 * the admin business summary). Each request carries only the dishes that
 * matter for the question (lib/ai-assistant/core.ts → dishesForPrompt), so
 * it stays small. If the first model is busy or the daily free quota is
 * used up, the next model is tried; if all are, the customer still gets a
 * useful rule-based answer (menu search, offers, hours, orders, points) —
 * the chat never just breaks.
 *
 * Models: GROQ_CHAT_MODEL (optional) first, then the defaults below. Groq
 * retires models every few months; if both defaults stop working, set
 * GROQ_CHAT_MODEL to a current one from console.groq.com/docs/models.
 *
 * Safety: rate-limited per IP; message size capped; the model only sees
 * this restaurant's public data plus the signed-in customer's OWN points
 * and orders; dish ids it returns are checked against the menu.
 */

const DEFAULT_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1500),
      })
    )
    .min(1)
    .max(20),
  cart: z
    .array(z.object({ id: z.string().max(64), quantity: z.number().int().min(1).max(99) }))
    .max(50)
    .default([]),
});

export async function POST(request: Request) {
  // Two windows: a burst limit (typing fast) and an hourly one (scripts).
  for (const [scope, limit, windowMs] of [
    ["ai-chat-minute", 10, 60_000],
    ["ai-chat-hour", 80, 60 * 60_000],
  ] as const) {
    const rate = checkRateLimit(request, scope, { limit, windowMs });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "You're sending messages quickly — please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }
  }

  const parsed = await parseBody(request, bodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const history = parsed.messages.slice(-9);
  const question = history[history.length - 1];
  if (question.role !== "user") {
    return NextResponse.json({ error: "The last message must be the customer's." }, { status: 400 });
  }
  if (question.content.length > 500) {
    return NextResponse.json({ error: "Please keep your message under 500 characters." }, { status: 400 });
  }

  const session = await auth();
  const context = await getAssistantContext(session?.user?.id ?? null, parsed.cart);

  const dishById = new Map(context.dishes.map((dish) => [dish.id, dish]));
  const promptDishes = dishesForPrompt(context.dishes, question.content);
  const knownIds = new Set(promptDishes.map((dish) => dish.id));

  // Orders and points: answered from the database, never guessed.
  if (directIntent(question.content, Boolean(context.user))) {
    return NextResponse.json({
      ...basicReply(context, question.content),
      kitchenOpen: context.kitchenOpen,
      source: "direct",
    } satisfies AssistantAnswer);
  }

  const answer: AssistantAnswer | null = process.env.GROQ_API_KEY
    ? await askModel(buildSystemPrompt(context, promptDishes), history, knownIds).then((result) =>
        result
          ? {
              reply: result.reply,
              dishes: result.dishIds.map((id) => dishById.get(id)).filter((d) => d !== undefined),
              suggestions: result.suggestions,
              orders: result.showOrders && context.user ? context.user.orders : [],
              kitchenOpen: context.kitchenOpen,
              source: "ai" as const,
            }
          : null
      )
    : null;

  if (answer) return NextResponse.json(answer);

  return NextResponse.json({
    ...basicReply(context, question.content),
    kitchenOpen: context.kitchenOpen,
    source: "basic",
  } satisfies AssistantAnswer);
}

async function askModel(
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  knownIds: Set<string>
) {
  const models = [...new Set([process.env.GROQ_CHAT_MODEL, ...DEFAULT_MODELS].filter(Boolean) as string[])];
  const client = getGroqClient();

  for (const model of models) {
    // A 400 usually means this model doesn't take one of the optional
    // settings (JSON mode / reasoning effort) — try once more without them
    // before moving on. The reply parser can still find the JSON in text.
    for (const strict of [true, false]) {
      try {
        const completion = await client.chat.completions.create(
          {
            model,
            temperature: 0.5,
            max_completion_tokens: 900,
            ...(strict
              ? {
                  // gpt-oss thinks before it answers and those tokens count
                  // here — "low" keeps replies fast.
                  reasoning_effort: "low" as const,
                  response_format: { type: "json_object" as const },
                }
              : {}),
            messages: [
              { role: "system", content: systemPrompt },
              ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
            ],
          },
          { timeout: 15_000, maxRetries: 0 }
        );
        const result = parseModelReply(completion.choices[0]?.message?.content, knownIds);
        if (result) return result;
        console.warn(`AI chat: unusable reply from ${model}`);
        break;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        console.warn(`AI chat: ${model} failed${status ? ` (${status})` : ""}`, status ? "" : error);
        if (!(strict && status === 400)) break;
      }
    }
  }
  return null;
}
