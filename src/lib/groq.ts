/**
 * src/lib/groq.ts
 *
 * Groq client wrapper — mirrors getStripeClient() in src/lib/stripe.ts:
 * lazily constructed, one shared instance per server process, throws a
 * clear error if the API key is missing rather than letting the SDK's own
 * (less obvious) error surface.
 *
 * Groq is used here for the AI Weekly Business Summary
 * (src/lib/business-summary.ts) — chosen for its free tier and low
 * latency, which matters for a "click and wait" admin UI rather than a
 * background job.
 */
import Groq from "groq-sdk";

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}