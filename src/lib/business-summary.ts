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
import { type Money, toMoney } from "@/lib/money";

export type WeeklySummaryStats = {
  // revenue = net sales: কর বাদ, বকশিশ বাদ। কেন, তার ব্যাখ্যা
  // /api/admin/insights/summary/route.ts-এ।
  currentWeek: { revenue: Money; orders: number };
  previousWeek: { revenue: Money; orders: number };
  topItem: { title: string; quantity: number } | null;
  cancelledThisWeek: number;

  // চালান আর সারাংশে যে মুদ্রায় অঙ্ক দেখানো হবে। hardcoded "$" সরানোর
  // জন্য — মডেলকে ডলারের কথা বললে সে ডলারেই উত্তর লিখতো, রেস্তোরাঁ
  // ঢাকায় হোক বা টোকিওতে।
  currency: string;
};

// llama-3.3-70b-versatile is Groq's general-purpose model — free tier as
// of writing, good enough quality for "narrate these numbers in plain
// English," and fast (this runs synchronously behind a button click, not
// a background job). Swap here if Groq's free-tier lineup changes.
const MODEL = "llama-3.3-70b-versatile";

function pctChange(current: Money | number, previous: Money | number): string {
  const now = toMoney(current);
  const before = toMoney(previous);

  if (before.isZero()) return now.greaterThan(0) ? "up from zero" : "flat at zero";

  const pct = now.minus(before).dividedBy(before).times(100).toNumber();
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export async function generateWeeklySummary(stats: WeeklySummaryStats): Promise<string> {
  const { currentWeek, previousWeek, topItem, cancelledThisWeek, currency } = stats;

  const facts = [
    `Revenue this week (net of tax and tips): ${currency} ${currentWeek.revenue.toFixed(2)} (${pctChange(currentWeek.revenue, previousWeek.revenue)} vs last week's ${currency} ${previousWeek.revenue.toFixed(2)})`,
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
          // মুদ্রা প্রতিটা অঙ্কের সাথেই দেওয়া আছে (ISO code হিসেবে)। এটা
          // না বললে মডেল অভ্যাসবশত "$" বসিয়ে দিত — টোকিও বা ঢাকার
          // রেস্তোরাঁর মালিক তখন নিজের সপ্তাহের আয় ডলারে পড়তেন।
          "Amounts are given with an ISO currency code. Keep that same currency in your summary; " +
          "never convert to another currency and never assume dollars. " +
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