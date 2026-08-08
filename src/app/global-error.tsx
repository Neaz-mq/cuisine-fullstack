"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * src/app/global-error.tsx
 *
 * error.tsx is a SIBLING of the root layout, so it can only catch errors
 * thrown by pages/components — not an error thrown by layout.tsx itself
 * (root layout crashing means there's no <html>/<body> left to render
 * error.tsx's UI into). global-error.tsx is the one boundary that sits
 * above the root layout and must render its own <html>/<body>.
 *
 * This should be rare in practice (root layout here is mostly static
 * providers/fonts), but without this file that rare case is a fully blank
 * white screen with nothing in Sentry either.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { digest: error.digest, boundary: "global-error" },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-2xl font-bold text-gray-800">
            Something went wrong
          </h1>
          <p className="mt-2 text-gray-500 max-w-md">
            This has been logged on our end. Please try refreshing the page.
          </p>
          {error.digest && (
            <p className="mt-6 text-sm text-gray-400">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}