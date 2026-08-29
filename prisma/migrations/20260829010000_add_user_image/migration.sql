-- Stores the Google profile picture URL for users who sign in with Google.
--
-- Nullable on purpose: accounts created with email + password have no
-- picture, and there is no upload flow. The admin Users list falls back
-- to a neutral silhouette in that case.
--
-- A URL, not a file. Google's CDN serves the image, so no storage bucket
-- or upload route is needed. The value is re-checked on every Google
-- sign-in (see auth.ts) so a changed picture follows through.
ALTER TABLE "User" ADD COLUMN "image" TEXT;