"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function RoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(newRole: string) {
    if (isSelf && newRole !== "ADMIN") {
      setError("You can't remove your own admin access.");
      return;
    }

    setError(null);
    const previous = role;
    setRole(newRole);

    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        setRole(previous);
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to update role");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <select
        value={role}
        disabled={isPending || isSelf}
        onChange={(e) => handleChange(e.target.value)}
        title={isSelf ? "You can't change your own role" : undefined}
        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
          role === "ADMIN"
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-gray-100 text-gray-700 border-gray-200"
        } disabled:opacity-60`}
      >
        <option value="CUSTOMER">CUSTOMER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      {isSelf && (
        <span className="text-[10px] text-gray-400 mt-1">You</span>
      )}
      {error && (
        <span className="text-xs text-red-500 mt-1 max-w-[160px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}