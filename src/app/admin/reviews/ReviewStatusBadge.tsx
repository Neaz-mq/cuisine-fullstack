const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  APPROVED: "bg-emerald-50 text-emerald-600",
  REJECTED: "bg-red-50 text-red-500",
};

export default function ReviewStatusBadge({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}