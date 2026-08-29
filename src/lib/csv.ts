/**
 * src/lib/csv.ts
 *
 * CSV তৈরির দুটো ছোট সহায়ক, দুটো export route-ই ব্যবহার করে
 * (/api/admin/insights/export আর /api/admin/users/export)।
 *
 * ⚠️ csvCell আগে insights route-এর ভেতরে লেখা ছিল। Users-এর export
 * বানানোর সময় ওটা copy করে নেওয়া যেত, কিন্তু এটা নিরাপত্তার কোড —
 * আর নিরাপত্তার কোডের দুটো কপি মানে একদিন একটা সারানো হবে, অন্যটা নয়।
 * তাই সরিয়ে এখানে আনা।
 */

/**
 * CSV-তে একটা ঘর নিরাপদে বসানো।
 *
 * দুটো আলাদা সমস্যা একসাথে সামলায়:
 *
 * ১। সাধারণ CSV escaping — কমা, উদ্ধৃতি বা newline থাকলে পুরোটা
 *    উদ্ধৃতিতে মুড়ে ভেতরের " কে "" করা।
 *
 * ২। CSV injection। Excel/Sheets `=`, `+`, `-`, `@` (এবং tab/CR) দিয়ে
 *    শুরু হওয়া ঘরকে সূত্র ধরে চালায়। কোনো গ্রাহক নিজের নাম
 *    `=HYPERLINK(...)` দিয়ে রাখলে সেটা মালিকের Excel-এ গিয়ে চলত।
 *    সামনে একটা `'` বসালে Excel ওটাকে লেখা হিসেবেই দেখে।
 */
export function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * সারিগুলো থেকে সম্পূর্ণ CSV।
 *
 * \uFEFF (BOM) — এটা ছাড়া Excel UTF-8 ধরে না, আর বাংলা নাম বা ৳
 * চিহ্ন খোলার পর দুর্বোধ্য অক্ষরে ভরে যায়। \r\n কারণ CSV-র
 * নির্দিষ্টকরণে (RFC 4180) সেটাই line break।
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return (
    "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  );
}