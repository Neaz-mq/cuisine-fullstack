import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#2C6252]/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-orange-400/10 rounded-full blur-3xl" />

      {/* Plate/food illustration */}
      <div className="relative mb-6">
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          <circle cx="70" cy="70" r="65" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="2" />
          <circle cx="70" cy="70" r="48" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
          {/* Fork */}
          <g transform="translate(38, 40) rotate(-20)">
            <rect x="0" y="0" width="6" height="45" rx="3" fill="#2C6252" />
            <path
              d="M0 0 L0 -12 M3 0 L3 -14 M6 0 L6 -12"
              stroke="#2C6252"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          {/* Knife */}
          <g transform="translate(96, 40) rotate(20)">
            <rect x="0" y="0" width="5" height="45" rx="2.5" fill="#2C6252" />
            <path d="M-1 -18 Q3 -22 5 0 L0 0 Z" fill="#2C6252" />
          </g>
          {/* Sad face on plate */}
          <circle cx="58" cy="68" r="3" fill="#D1D5DB" />
          <circle cx="82" cy="68" r="3" fill="#D1D5DB" />
          <path
            d="M56 88 Q70 78 84 88"
            stroke="#D1D5DB"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      <h1 className="text-7xl sm:text-8xl font-bold text-[#2C6252] tracking-tight">
        404
      </h1>
      <p className="mt-3 text-xl sm:text-2xl font-semibold text-gray-800">
        This dish isn&apos;t on the menu.
      </p>
      <p className="mt-2 text-gray-500 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist, was moved, or maybe
        got eaten before you got here.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="bg-[#2C6252] text-white px-6 py-3 font-semibold rounded-md hover:bg-[#234f42] transition-colors w-full sm:w-auto"
        >
          Back to Home
        </Link>
        <Link
          href="/menu"
          className="border border-gray-300 text-gray-700 px-6 py-3 font-semibold rounded-md hover:bg-gray-100 transition-colors w-full sm:w-auto"
        >
          Browse Menu
        </Link>
      </div>

      <p className="mt-8 text-sm text-gray-400">
        Error code: 404 · Page not found
      </p>
    </div>
  );
}