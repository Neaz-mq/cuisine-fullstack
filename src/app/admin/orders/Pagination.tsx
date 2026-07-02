import Link from "next/link";

export default function Pagination({
  currentPage,
  totalPages,
  searchParams,
  basePath = "/admin/orders",
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  basePath?: string;
}) {
  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== "page") params.set(key, value);
    });
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Link
        href={buildHref(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        className={`px-3 py-1.5 text-sm rounded-md border ${
          currentPage === 1
            ? "border-gray-200 text-gray-300 pointer-events-none"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        Previous
      </Link>

      <span className="text-sm text-gray-500 px-2">
        Page {currentPage} of {totalPages}
      </span>

      <Link
        href={buildHref(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        className={`px-3 py-1.5 text-sm rounded-md border ${
          currentPage === totalPages
            ? "border-gray-200 text-gray-300 pointer-events-none"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        Next
      </Link>
    </div>
  );
}