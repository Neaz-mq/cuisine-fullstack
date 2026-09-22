/**
 * Figma: pill, height 36, padding 12, radius 100, Sora 12.
 * Approved is the Figma's green (#E8FFEC / #0ECF00); pending and rejected
 * use the same amber and red pills as the Orders page statuses.
 */
const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[#FFF2DA] text-[#FF9E00]",
  APPROVED: "bg-[#E8FFEC] text-[#0ECF00]",
  REJECTED: "bg-[#FFE9EC] text-[#FF3F5C]",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function ReviewStatusBadge({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  return (
    <span
      className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] font-normal leading-none min-[480px]:h-9 ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
