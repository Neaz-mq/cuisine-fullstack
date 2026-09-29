import { NextRequest, NextResponse } from "next/server";
import { requireApiScopeAny } from "@/lib/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Only raster formats, and the extension comes from this list — never from
 * the uploaded file name.
 *
 * ⚠️ SVG is left out on purpose: an SVG can carry <script>, and these files
 * are served publicly from Supabase Storage. file.type is whatever the
 * browser (or an attacker's script) says, so a "photo.html" sent as
 * image/png used to be stored as .html.
 */
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  // Only the screens that actually have an image field: menu items, staff
  // photos, tables and inventory. Before this, any staff login — including
  // CLEANER, which has no scopes at all — could upload.
  const authResult = await requireApiScopeAny(["menu", "staff", "tables", "inventory", "suppliers"]);
  if (authResult instanceof NextResponse) return authResult;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Image must be JPG, PNG, WebP, AVIF or GIF" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const fileName = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("menu-images")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from("menu-images").getPublicUrl(fileName);

  return NextResponse.json({ url: data.publicUrl });
}
