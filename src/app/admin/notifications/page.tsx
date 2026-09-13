import { type ReactNode } from "react";
import { BellRing, Calendar, CheckCheck, Mail, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getAdminNotifications, notificationCounts } from "@/lib/admin-notifications";
import NotificationFeed from "./NotificationFeed";

export const metadata = { title: "Notification" };

/**
 * /admin/notifications — Figma "Notification" পাতা।
 *
 *   Welcome header + তারিখ
 *   Overview: Total · Read · Unread · System Alerts
 *   Notification: দিন ধরে ভাগ করা feed + "Mark all as Read"
 *
 * ⚠️ feed-টা কোনো Notification টেবিল থেকে আসে না — অর্ডার, বুকিং,
 * রিভিউ আর স্টকের সারি থেকে চলতে চলতে তৈরি হয়। কারণটা বিস্তারিত
 * src/lib/admin-notifications.ts-এর মাথায় লেখা।
 *
 * ⚠️ কোনো ছাঁকনি বা pagination নেই, Figma-তে থাকা সত্ত্বেও। তালিকাটা
 * সর্বোচ্চ কয়েকশো সাম্প্রতিক ঘটনার, আর সেটা এক পর্দাতেই scroll করে
 * দেখা যায়। ছাঁকনি বসালে সেটা কেবল এই সীমিত তালিকাটাকেই ছাঁকত, পুরো
 * ইতিহাসকে নয় — staff ভাবতেন কিছু হারিয়ে গেছে। পুরো ইতিহাস দেখার
 * জায়গা Orders আর Reservations পাতা, যেখানে সত্যিকারের ছাঁকনি আছে।
 */
export default async function AdminNotificationsPage() {
  // layout.tsx-ও guard করে; এখানে session-টা নাম আর read-চিহ্নের জন্য।
  const session = await requireStaff("orders");
  const now = new Date();

  /**
   * ⚠️ read-চিহ্নটা প্রতিটা staff-এর নিজের।
   *
   * StaffProfile সারি না থাকলে (যেমন OWNER অ্যাকাউন্ট) `readAt` null —
   * তখন সবই অপঠিত দেখায়, আর "Mark all as Read" কিছুই বদলায় না। সেটাই
   * সৎ আচরণ: চিহ্ন রাখার জায়গা নেই বলে "পড়া হয়েছে" ভান করা উচিত নয়।
   */
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id },
    select: { notificationsReadAt: true },
  });

  const notifications = await getAdminNotifications(profile?.notificationsReadAt ?? null);
  const counts = notificationCounts(notifications);

  return (
    <div className="space-y-4">
      {/* --- Welcome header --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <span className="flex h-10 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px] md:self-auto">
          <Calendar
            className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* --- Overview --- */}
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>

        <div className="grid gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Notification"
            value={String(counts.total)}
            hint="Recent activity"
            icon={<BellRing className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="Read"
            value={String(counts.read)}
            hint="Already viewed"
            icon={<CheckCheck className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="Unread"
            value={String(counts.unread)}
            hint="Awaiting attention"
            icon={<Mail className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="System Alerts"
            value={String(counts.alerts)}
            hint="Low stock warnings"
            icon={
              <TriangleAlert className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            }
          />
        </div>
      </section>

      {/* --- Feed --- */}
      <section className="rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <NotificationFeed notifications={notifications} hasUnread={counts.unread > 0} />
      </section>
    </div>
  );
}

/** Payment/Reservations পাতার StatCard-এর হুবহু একই গড়ন। */
function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-h-[142px] flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">
          {value}
        </span>
        <span className="font-sora text-[12px] leading-none text-black/70">{hint}</span>
      </div>
    </div>
  );
}
