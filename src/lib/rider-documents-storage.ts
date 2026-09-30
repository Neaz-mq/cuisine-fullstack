/**
 * src/lib/rider-documents-storage.ts
 *
 * Where rider documents live: a PRIVATE Supabase bucket. Nothing in it has
 * a public URL — a licence or insurance paper opens only through a signed
 * link that works for one minute, made for the rider or a staff manager.
 *
 * The bucket is created on the first upload if it isn't there yet, so no
 * manual Supabase step is needed.
 */
import { supabaseAdmin } from "@/lib/supabase-admin";

export const DOCUMENT_BUCKET = "rider-documents";
const SIGNED_URL_SECONDS = 60;

let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { data } = await supabaseAdmin.storage.getBucket(DOCUMENT_BUCKET);
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(DOCUMENT_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    });
    // "already exists" = another request made it a moment ago — fine.
    if (error && !/exist/i.test(error.message)) throw error;
  } else if (data.public) {
    // Someone made it public by hand — close it again.
    await supabaseAdmin.storage.updateBucket(DOCUMENT_BUCKET, { public: false });
  }
  bucketReady = true;
}

export async function uploadDocumentFile(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  await ensureBucket();
  const { error } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "0" });
  if (error) throw error;
}

export async function removeDocumentFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
  if (error) console.warn("[rider-documents] couldn't delete old file:", error.message);
}

/** A one-minute link to open the file. null = it couldn't be made. */
export async function signedDocumentUrl(path: string, fileName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: false });
  if (error || !data) {
    console.error("[rider-documents] signed URL failed:", error?.message, fileName);
    return null;
  }
  return data.signedUrl;
}
