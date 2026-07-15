// src/lib/plain-text-to-html.ts

// Escapes the five HTML-significant characters so admin-typed text can
// never break out of the surrounding markup or accidentally inject tags.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts plain text typed by a non-technical admin into safe HTML
 * paragraphs, so the broadcast composer can just be a normal textarea
 * instead of requiring HTML knowledge.
 *
 * Every line the admin types (i.e. every time they press Enter) becomes
 * its own paragraph in the email — no special formatting convention to
 * remember, no blank lines required. All text is HTML-escaped first, so
 * typed text can never inject markup.
 *
 * Example:
 *   "Enjoy 20% off this weekend!
 *   Just show this email at checkout."
 * becomes:
 *   "<p>Enjoy 20% off this weekend!</p><p>Just show this email at checkout.</p>"
 */
export function plainTextToHtml(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}