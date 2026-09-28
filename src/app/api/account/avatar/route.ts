import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  AVATAR_BUCKET,
  AVATAR_FOLDER,
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  avatarStoragePath,
  sniffImageType,
} from "@/lib/avatar";

/**
 * /api/account/avatar — the signed-in customer's own profile photo
 * (customer panel → Profile Details → Change Photo).
 *
 *   POST   multipart "file" — JPG, PNG or WebP, up to 2MB. Saves it and
 *          returns { image }.
 *   DELETE removes the photo (back to the letter avatar).
 *
 * Only ever touches the caller's own row. The file type is checked from
 * the file's first bytes, not from its name or the browser's claim, so
 * nothing but a real image ends up in the public bucket. The previous
 * uploaded photo is deleted, so old photos don't pile up.
 */

async function removeOldFile(url: string | null) {
  const path = avatarStoragePath(url);
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.warn("[account/avatar] couldn't delete old photo:", error.message);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const rate = checkRateLimit(request, "account-avatar", { limit: 10, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Please choose a photo." }, { status: 400 });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: "The photo must be 2MB or smaller." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    return NextResponse.json({ error: "Please use a PNG, JPG or WEBP image." }, { status: 400 });
  }

  const userId = session.user.id;
  const fileName = `${AVATAR_FOLDER}/${userId}-${crypto.randomUUID()}.${AVATAR_TYPES[type]}`;

  try {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
    if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(fileName, bytes, { contentType: type, upsert: false, cacheControl: "31536000" });
    if (uploadError) {
      console.error("[account/avatar] upload failed:", uploadError);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
    await prisma.user.update({ where: { id: userId }, data: { image: data.publicUrl } });
    await removeOldFile(current.image);

    return NextResponse.json({ image: data.publicUrl });
  } catch (error) {
    console.error("[account/avatar] save failed:", error);
    return NextResponse.json({ error: "Couldn't save your photo. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const rate = checkRateLimit(request, "account-avatar", { limit: 10, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many changes — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } });
    if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    await prisma.user.update({ where: { id: session.user.id }, data: { image: null } });
    await removeOldFile(current.image);
    return NextResponse.json({ image: null });
  } catch (error) {
    console.error("[account/avatar] remove failed:", error);
    return NextResponse.json({ error: "Couldn't remove your photo. Please try again." }, { status: 500 });
  }
}
