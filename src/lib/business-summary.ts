/**
 * src/lib/business-summary.ts
 *
 * Turns already-computed weekly sales numbers into a short, plain-language
 * summary for the dashboard's "AI Business Summary" card — the model only
 * narrates numbers this app already calculated, it never sees raw order
 * data and is never asked to do arithmetic itself. That keeps the numbers
 * shown to the owner trustworthy (they came from Prisma, not the LLM) and
 * keeps the prompt small, which matters for staying comfortably inside a
 * free-tier rate limit.
 */
import { getGroqClient } from "@/lib/groq";

export type WeeklySummaryStats = {
  currentWeek: { revenue: number; orders: number };
  previousWeek: { revenue: number; orders: number };
  topItem: { title: string; quantity: number } | null;
  cancelledThisWeek: number;
};

// llama-3.3-70b-versatile is Groq's general-purpose model — free tier as
// of writing, good enough quality for "narrate these numbers in plain
// English," and fast (this runs synchronously behind a button click, not
// a background job). Swap here if Groq's free-tier lineup changes.
const MODEL = "llama-3.3-70b-versatile";

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "up from $0" : "flat at $0";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export async function generateWeeklySummary(stats: WeeklySummaryStats): Promise<string> {
  const { currentWeek, previousWeek, topItem, cancelledThisWeek } = stats;

  const facts = [
    `Revenue this week: $${currentWeek.revenue.toFixed(2)} (${pctChange(currentWeek.revenue, previousWeek.revenue)} vs last week's $${previousWeek.revenue.toFixed(2)})`,
    `Orders this week: ${currentWeek.orders} (${pctChange(currentWeek.orders, previousWeek.orders)} vs last week's ${previousWeek.orders})`,
    topItem
      ? `Best-selling item this week: ${topItem.title} (${topItem.quantity} sold)`
      : `No orders yet this week.`,
    `Cancelled orders this week: ${cancelledThisWeek}`,
  ].join("\n");

  const completion = await getGroqClient().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content:
          "You write short weekly business summaries for a restaurant owner who is busy and doesn't have time to read charts. " +
          "Use ONLY the numbers given to you — never invent or estimate a figure that wasn't provided. " +
          "Write 2-4 short sentences, plain conversational English, no markdown formatting, no bullet points, no headers. " +
          "Address the owner directly. If a number signals a problem (revenue or orders down, several cancellations), " +
          "say so plainly but not alarmingly. If the week looks strong, be genuinely encouraging without being over the top.",
      },
      {
        role: "user",
        content: `Here is this week's data:\n${facts}\n\nWrite the summary.`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned an empty response");
  }
  return text;
}