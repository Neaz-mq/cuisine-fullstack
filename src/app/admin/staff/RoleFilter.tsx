"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";
import { ALL_ROLES, ROLE_FILTER_OPTIONS, type RoleFilterValue } from "@/lib/staff-roles";

/**
 * src/app/admin/staff/RoleFilter.tsx
 *
 * পাতলা client wrapper — StaffPage server component থেকে FilterMenu
 * সরাসরি ব্যবহার করা যায় না (onSelect-এ router লাগে, আর router
 * client-only hook)। কাজটা শুধু URL-এর `role` param বদলানো, ঠিক
 * UsersToolbar/StaffToolbar-এর push()-এর মতো — page ইচ্ছাকৃতভাবে বাদ,
 * ছাঁকনি বদলে ফলাফল কমলে পুরনো page নম্বরে খালি পর্দা এড়াতে।
 */
export default function RoleFilter({ value }: { value: RoleFilterValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: RoleFilterValue) => {
    const params = new URLSearchParams();
    // ⚠️ `period` Overview কার্ডের ছাঁকনি, তালিকার নয় — কিন্তু এখানে
    // না রাখলে role বদলালেই সেটা নীরবে "All"-এ ফিরে যেত।
    ["q", "period"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    if (next !== ALL_ROLES) params.set("role", next);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={ROLE_FILTER_OPTIONS}
      onSelect={handleSelect}
      ariaLabel="Filter by role"
    />
  );
}
