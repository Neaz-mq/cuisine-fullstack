"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = ["OWNER", "MANAGER", "WAITER", "CASHIER", "DELIVERY", "KITCHEN"] as const;
const EMPLOYMENT_OPTIONS = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  staffProfile: {
    department: string | null;
    employmentType: string;
    phone: string | null;
    hireDate: string;
    isActive: boolean;
    nid?: string | null;
    salary?: number | null;
  } | null;
};

export default function StaffForm({
  viewerRole,
  isSelf,
  existing,
  canSeeSensitive,
}: {
  viewerRole?: string;
  isSelf: boolean;
  existing?: StaffMember;
  canSeeSensitive: boolean;
}) {
  const router = useRouter();
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(existing?.role ?? "WAITER");
  const [department, setDepartment] = useState(existing?.staffProfile?.department ?? "");
  const [employmentType, setEmploymentType] = useState(
    existing?.staffProfile?.employmentType ?? "FULL_TIME"
  );
  const [phone, setPhone] = useState(existing?.staffProfile?.phone ?? "");
  const [hireDate, setHireDate] = useState(
    existing?.staffProfile?.hireDate ? existing.staffProfile.hireDate.slice(0, 10) : ""
  );
  const [nid, setNid] = useState(existing?.staffProfile?.nid ?? "");
  const [salary, setSalary] = useState(
    existing?.staffProfile?.salary != null ? String(existing.staffProfile.salary) : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A MANAGER can't create/promote anyone to OWNER, and can't touch an
  // existing OWNER's role at all — the role dropdown reflects that so the
  // form doesn't even offer an option the API would reject.
  const roleOptions = ROLE_OPTIONS.filter((r) => {
    if (viewerRole === "OWNER") return true;
    if (r === "OWNER") return false;
    return true;
  });
  const roleLocked = isEdit && (isSelf || (existing?.role === "OWNER" && viewerRole !== "OWNER"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isEdit && (!password || password.length < 8)) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      role,
      department: department.trim() || null,
      employmentType,
      phone: phone.trim() || null,
      hireDate: hireDate || undefined,
    };
    if (password) payload.password = password;
    if (canSeeSensitive) {
      payload.nid = nid.trim() || null;
      payload.salary = salary ? Number(salary) : null;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/staff/${existing!.id}` : "/api/admin/staff", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }
      router.push("/admin/staff");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isEdit}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isEdit ? "Reset password (optional)" : "Password"}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep current password" : ""}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={roleLocked}
          title={roleLocked ? "You can't change this role" : undefined}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {roleLocked && (
          <p className="text-xs text-gray-400 mt-1">
            {isSelf ? "You can't change your own role." : "Only an owner can edit another owner's role."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employment type</label>
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {EMPLOYMENT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hire date</label>
          <input
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {canSeeSensitive && (
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              National ID <span className="text-xs text-gray-400">(owner only)</span>
            </label>
            <input
              type="text"
              value={nid}
              onChange={(e) => setNid(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary <span className="text-xs text-gray-400">(owner only)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-[#FF4C15] text-white text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add staff member"}
      </button>
    </form>
  );
}
