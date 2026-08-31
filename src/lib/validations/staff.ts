import { z } from "zod";
import { emailSchema, nonEmptyString } from "@/lib/validations/common";
import { STAFF_ROLES } from "@/lib/permissions";
import { SHIFTS } from "@/lib/staff-shift";

/**
 * src/lib/validations/staff.ts
 *
 * Deliberately thin. The staff routes have RBAC-conditional logic that
 * doesn't map onto a static zod shape — e.g. "role can be changed unless
 * it's yourself", "nid/salary are only accepted from an OWNER", "isActive:
 * false is rejected only when it's your own account". That's per-request,
 * per-actor logic and stays hand-written in the route.
 *
 * What zod *can* own here: "is this string actually a string", "is this a
 * real staff role", "is the password long enough" — the type/shape checks
 * that were previously duplicated ad hoc. The route still reads fields off
 * the parsed, typed object and applies the business rules on top.
 */

export const staffRoleSchema = z.enum(STAFF_ROLES);

// shift-এর জন্য কোনো RBAC নেই (nid/salary-র মতো নয়) — যেকোনো staff creator
// এটা সেট করতে পারেন, তাই এটা এখানেই সরাসরি zod-এ, route-এর হাতে-লেখা
// গার্ডরেইলে নয়।
const staffShiftSchema = z.enum(SHIFTS);

export const createStaffSchema = z.object({
  name: nonEmptyString("Name"),
  email: emailSchema,
  /**
   * ⚠️ ঐচ্ছিক — আগে বাধ্যতামূলক ছিল।
   *
   * Figma-র "Add New Staff" modal-এ কোনো password ঘর নেই, আর সেটা
   * ভুল নয়, বরং ভালো: admin একজন কর্মীর password বেছে দিলে সেটা
   * অন্তত দু'জন জানে, আর বাস্তবে সেটা WhatsApp-এ পাঠানো হয়। তার
   * বদলে route একটা random password বসিয়ে কর্মীকে "নিজের password
   * ঠিক করুন" link পাঠায় (দেখুন POST /api/admin/staff)।
   *
   * পুরনো StaffForm এখনো password পাঠায়, তাই ক্ষেত্রটা বাদ দেওয়া
   * হয়নি — শুধু ঐচ্ছিক করা হয়েছে। পাঠালে সেটাই ব্যবহার হয়।
   */
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role: staffRoleSchema,
  department: z.string().trim().optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).default("FULL_TIME"),
  phone: z.string().trim().optional().or(z.literal("")),
  hireDate: z.iso.datetime({ offset: true }).optional().or(z.string().trim().min(1).optional()),
  // ঐচ্ছিক — schema.prisma-র `Shift?`-এর মতোই, নতুন staff-এর শিফট এখনই
  // ঠিক না হয়ে থাকলে ফাঁকা রাখা যায়।
  shift: staffShiftSchema.optional(),
  nid: z.string().trim().optional().or(z.literal("")),
  salary: z.number().nonnegative().optional(),
  // Figma modal-এর "Permanent Address" — schema.prisma-র
  // StaffProfile.address-এর মতোই ঐচ্ছিক।
  address: z.string().trim().optional().or(z.literal("")),
  /**
   * প্রোফাইল ছবি — modal-এর উপরের drop-zone থেকে।
   *
   * এখানে যা আসে সেটা ইতিমধ্যেই /api/admin/upload-image-এ upload হয়ে
   * যাওয়া ফাইলের public URL, কোনো base64 বা file নয়। তাই `.url()`
   * যাচাই: হাতে লেখা যা-খুশি string User.image-এ বসে গেলে প্রতিটা
   * staff সারিতে ভাঙা ছবির চিহ্ন আসত।
   */
  image: z.url("Image must be a valid URL").optional().or(z.literal("")),
  // modal-এর "Status" dropdown। ডিফল্ট true, কারণ নতুন কর্মী স্বাভাবিকভাবেই
  // active — কিন্তু কেউ আগে থেকে record বানিয়ে রাখলে (যেমন যিনি পরের মাসে
  // যোগ দেবেন) inactive হিসেবেও যোগ করা যায়।
  isActive: z.boolean().optional(),
});

/** All optional — PATCH only touches whatever fields are sent. Role and
 * isActive keep their extra guardrails (self-change, OWNER gating) applied
 * manually in the route after parsing. */
export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    role: staffRoleSchema.optional(),
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
    department: z.string().trim().nullable().optional(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
    phone: z.string().trim().nullable().optional(),
    hireDate: z.string().trim().min(1).optional(),
    // nullable — একবার সেট করা শিফট আবার ফাঁকা করে দেওয়ার সুযোগ রাখতে
    // হয়েছে (যেমন কেউ শিফট ব্যবস্থার বাইরে গেলে)।
    shift: staffShiftSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    nid: z.string().trim().nullable().optional(),
    salary: z.number().nonnegative().nullable().optional(),
    // createStaffSchema-র একই দুটো ক্ষেত্র, তবে nullable — একবার সেট
    // করা ঠিকানা বা ছবি আবার মুছে ফেলাটাও একটা বৈধ আপডেট (shift-এর
    // একই যুক্তি, উপরের মন্তব্য দ্রষ্টব্য)।
    address: z.string().trim().nullable().optional(),
    image: z.url("Image must be a valid URL").nullable().optional().or(z.literal("")),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });
