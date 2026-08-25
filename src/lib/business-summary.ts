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

/**
 * আগে এখানে `llama-3.3-70b-versatile` ছিল। Groq ১৭ জুন ২০২৬-এ ওটার
 * deprecation ঘোষণা করে এবং **১৬ আগস্ট ২০২৬**-এ বন্ধ করে দেয়; তারপর
 * থেকে প্রতিটা call 400 `model_decommissioned` দিয়ে ফিরছিল, যেটা
 * route-এর catch-এ গিয়ে "Couldn't generate a summary right now" হয়ে
 * দেখা দিত। Groq-এর প্রস্তাবিত বিকল্পই এখানে বসানো হলো।
 * তালিকা: https://console.groq.com/docs/deprecations
 *
 * env var দিয়ে বদলানো যায়, কারণ এটা তৃতীয়বার ঘটল — Groq প্রতি কয়েক
 * মাসেই lineup বদলায়। পরেরবার model বন্ধ হলে `GROQ_MODEL` সেট করেই
 * চালু রাখা যাবে, deploy-এর অপেক্ষা না করে। সেট না থাকলে নিচের
 * ডিফল্টটাই চলে, তাই .env-এ কিছু না দিলেও কাজ করে।
 */
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

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
    /**
     * ⚠️ gpt-oss একটা reasoning model, আর তার ভাবনার token গুলোও এই
     * বাজেটের ভেতরেই গোনা হয়। আগের `max_tokens: 220` রেখে দিলে পুরোটা
     * ভাবনাতেই খরচ হয়ে যেত আর content ফাঁকা আসত — অর্থাৎ নিচের
     * "empty response" error, যেটা দেখতে ঠিক decommission-এর মতোই।
     * তাই বাজেট বাড়ানো, আর ভাবনা কম রাখতে reasoning_effort কমানো।
     *
     * `max_tokens` নয়, `max_completion_tokens` — Groq প্রথমটাকে
     * deprecated ধরে (OpenAI-র API-র সাথে মেলাতে)।
     */
    max_completion_tokens: 1200,
    // কাজটা সহজ: দেওয়া সংখ্যা গুলো দুই-চার বাক্যে বলা। এর জন্য গভীর
    // ভাবনার দরকার নেই, আর button-এর পেছনে বসে থাকা মানুষটার কাছে
    // দ্রুত উত্তরটাই বেশি জরুরি।
    reasoning_effort: "low",
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
    // model-এর নামটা বার্তায় রাখা হলো, কারণ এই ব্যর্থতাটা প্রায়
    // সবসময়ই model বদলের পর ঘটে — server log-এ নামটা থাকলে কারণ
    // খুঁজতে এক ধাপ কম লাগে।
    throw new Error(`Groq returned an empty response (model: ${MODEL})`);
  }
  return text;
}