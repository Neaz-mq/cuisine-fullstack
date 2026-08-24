import Link from "next/link";

/**
 * src/components/admin/ComingSoon.tsx
 *
 * Figma sidebar-এ এমন কয়েকটা section আছে যেগুলোর page এখনো বানানো
 * হয়নি (Users, Suppliers, Payment, Notification)। design-টা পুরো রাখতে
 * link গুলো রাখা হয়েছে, কিন্তু link থাকলে সেটা কোথাও নিয়ে যেতেই হবে —
 * নাহলে ব্যবহারকারী 404 পান আর ভাবেন কিছু ভেঙে গেছে।
 *
 * এই placeholder-টা তাই ইচ্ছাকৃতভাবে সৎ: "এখনো বানানো হয়নি" স্পষ্ট
 * করে বলে, আর যেখানে কাজটা *এখন* করা যায় সেখানে পাঠায় (`action`) —
 * যেমন refund এখন order detail page থেকেই হয়।
 */
export default function ComingSoon({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** ইতিমধ্যে যেখানে কাজটা করা যায়, থাকলে। */
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-[24px] bg-white p-8 md:p-12">
      <div className="mx-auto max-w-md text-center">
        <span className="inline-block rounded-full bg-orange-50 px-3 py-1 font-sora text-[11px] font-semibold uppercase tracking-wide text-[#FF4C15]">
          Coming soon
        </span>

        <h1 className="mt-4 font-frank-ruhl text-[26px] font-bold text-gray-900">
          {title}
        </h1>

        <p className="mt-2 font-sora text-[14px] leading-relaxed text-gray-500">
          {description}
        </p>

        {action && (
          <Link
            href={action.href}
            className="mt-6 inline-flex items-center rounded-full bg-[#2C6252] px-5 py-2.5 font-sora text-[14px] font-medium text-white transition-colors hover:bg-[#24513f]"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}