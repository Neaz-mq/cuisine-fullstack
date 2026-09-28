/**
 * src/lib/avatar.ts
 *
 * Customer profile photos (customer panel → Profile Details → Change Photo).
 *
 * Files go into the same public Supabase bucket as the menu photos
 * ("menu-images"), under an `avatars/` folder, so no new bucket has to be
 * set up. The User row keeps only the public URL, like before.
 *
 * Pure helpers — no Prisma, no Supabase — so auth.ts and the tests can use
 * them freely.
 */

export const AVATAR_BUCKET = "menu-images";
export const AVATAR_FOLDER = "avatars";

/** Figma: "PNG, JPG, WEBP up to 2MB". */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * What the file really is, from its first bytes — not from its name or the
 * type the browser claims (both can be anything). Returns the MIME type, or
 * null for anything that isn't a JPG, PNG or WebP.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/${AVATAR_FOLDER}/`;

/**
 * True when the URL is a photo the customer uploaded here (not a Google
 * picture). Google sign-in must not replace these — see auth.ts.
 */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes(MARKER);
}

/** "avatars/<file>" inside the bucket, for deleting the old photo. */
export function avatarStoragePath(url: string | null | undefined): string | null {
  if (!isUploadedAvatar(url)) return null;
  const file = (url as string).split(MARKER)[1]?.split(/[?#]/)[0];
  return file && !file.includes("/") && !file.includes("..") ? `${AVATAR_FOLDER}/${file}` : null;
}
