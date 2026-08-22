import {
  parsePhoneNumberFromString,
  getExampleNumber,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

/**
 * src/lib/phone.ts
 *
 * এক জায়গায় phone normalisation + validation, কারণ register form আর
 * registerSchema দুটোই এটা ব্যবহার করে। আলাদা করে লিখলে দুই দিক ধীরে ধীরে
 * আলাদা হয়ে যেত — আর তখন client যা মেনে নেয় server তা reject করত (বা
 * উল্টোটা, যেটা আরও খারাপ)।
 */

/**
 * জাতীয় নম্বর + dial code → E.164।
 *
 * Leading zero বাদ দেওয়াটাই এখানে আসল কাজ: বাংলাদেশে লোকে 01785286936
 * লেখে, যেখানে শুরুর 0 হলো domestic trunk prefix — country code-এর পাশে
 * ওটা থাকলে +88001785286936 হয়ে যায়, যেখানে কোনো SMS বা WhatsApp
 * gateway পৌঁছাতে পারে না। ভারত, যুক্তরাজ্য, জার্মানি সহ বহু দেশেই একই
 * trunk-prefix রীতি।
 */
export function toE164(dial: string, national: string): string {
  return `${dial}${national.replace(/\D/g, "").replace(/^0+/, "")}`;
}

/**
 * E.164 string-টি আদৌ বৈধ কি না — দৈর্ঘ্য ও prefix, দুটোই দেশভেদে যাচাই হয়।
 *
 * শুধু "৭ থেকে ১৫ digit" ধরনের regex যথেষ্ট নয়: বাংলাদেশে জাতীয় নম্বর ১০
 * digit, যুক্তরাষ্ট্রে ১০ কিন্তু area code 0/1 দিয়ে শুরু হতে পারে না,
 * সিঙ্গাপুরে ৮। libphonenumber এই প্রতিটি নিয়ম আলাদাভাবে জানে।
 *
 * Country hint লাগে না — E.164-এ dial code নিজেই থাকে, তাই parser দেশ
 * চিনে নিয়ে সেই দেশের নিয়মে যাচাই করে।
 */
export function isValidPhone(e164: string): boolean {
  return parsePhoneNumberFromString(e164)?.isValid() ?? false;
}

/**
 * ওই দেশের একটি নমুনা মোবাইল নম্বর, placeholder হিসেবে দেখানোর জন্য।
 *
 * "কত digit লাগবে" প্রশ্নের উত্তর error message-এ বলার চেয়ে input-এ আগেই
 * দেখিয়ে দেওয়া ভালো — user ভুল করার আগেই বুঝে যায়।
 */
export function examplePhone(countryCode: string): string {
  const example = getExampleNumber(countryCode as CountryCode, examples);
  return example ? example.nationalNumber : "";
}