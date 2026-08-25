import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * vitest.config.mts
 *
 * `.mts`, `.ts` নয়। Vite এই ফাইলটা CommonJS হিসেবে load করত অথচ
 * ভেতরে ESM syntax (import/export) — এখন সেটা কেবল একটা warning, কিন্তু
 * Vite-এর পরের major version-এ native loader ডিফল্ট হলে test চলাই বন্ধ
 * হয়ে যেত। `.mts` extension Node-কে সরাসরি বলে দেয় এটা ESM, তাই
 * অনুমানের জায়গাই থাকে না।
 *
 * package.json-এ `"type": "module"` বসিয়েও সমাধান হতো, কিন্তু সেটা
 * পুরো প্রজেক্টের প্রতিটা .js/.ts ফাইলের module ধরন বদলে দিত —
 * একটা test config ঠিক করতে গিয়ে নেওয়ার মতো ঝুঁকি নয়।
 *
 * ⚠️ `__dirname` সরানো হয়েছে, ইচ্ছাকৃতভাবে। ওটা CommonJS-এর নিজস্ব
 * variable, ESM-এ তার অস্তিত্ব নেই — শুধু নাম বদলে `.mts` করলে
 * "__dirname is not defined" দিয়ে config-টাই ভাঙত। `import.meta.url`
 * তার ESM প্রতিরূপ, আর fileURLToPath সেটাকে Windows-এও সঠিক path-এ
 * পরিণত করে (URL-টা file:///C:/... আকারে আসে; সরাসরি ব্যবহার করলে
 * বাড়তি একটা slash থেকে যেত)।
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*" -> "./src/*" path alias so test files
      // can import "@/lib/order-checkout-shared" exactly like application
      // code does.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
