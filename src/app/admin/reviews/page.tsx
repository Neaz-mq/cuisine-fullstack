import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import ReviewActions from "./ReviewActions";
import Pagination from "../orders/Pagination"; // ⚠️ adjust this path if your Pagination component lives elsewhere

const STATUS_TABS = [
  { label: "All", value: undefined },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
] as const;

const PAGE_SIZE = 10;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim();
  const status =
    params.status && ["PENDING", "APPROVED", "REJECTED"].includes(params.status)
      ? (params.status as "PENDING" | "APPROVED" | "REJECTED")
      : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { menuItem: { title: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [reviews, total, pendingCount] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        menuItem: { select: { title: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { status: "PENDING" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Reviews</h1>
        {pendingCount > 0 && (
          <span className="text-xs font-medium bg-orange-50 text-[#FF4C15] px-2.5 py-1 rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 mb-4">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.value;
          const href = tab.value ? `/admin/reviews?status=${tab.value}` : "/admin/reviews";
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                isActive
                  ? "bg-[#FF4C15] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form className="mb-6" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by customer name, email, or menu item..."
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF4C15]/30 focus:border-[#FF4C15]"
        />
      </form>

      {reviews.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No reviews found.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {reviews.map((review) => (
            <div key={review.id} className="flex items-start justify-between gap-4 px-4 py-4">
              <div className="flex items-start gap-3 min-w-0">
                {review.menuItem.imageUrl && (
                  <Image
                    src={review.menuItem.imageUrl}
                    alt={review.menuItem.title}
                    width={48}
                    height={48}
                    unoptimized
                    className="w-12 h-12 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{review.menuItem.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {review.user.name ?? review.user.email} &middot;{" "}
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-amber-500 mt-1" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}
                    <span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                  </p>
                  {review.comment && (
                    <p className="text-sm text-gray-600 mt-1 break-words">{review.comment}</p>
                  )}
                </div>
              </div>

              <ReviewActions reviewId={review.id} initialStatus={review.status} />
            </div>
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        searchParams={{ q, status }}
        basePath="/admin/reviews"
      />
    </div>
  );
}