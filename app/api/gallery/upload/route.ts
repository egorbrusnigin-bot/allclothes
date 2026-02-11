import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string || "";
    const caption = formData.get("caption") as string || "";
    const linkUrl = formData.get("link_url") as string || "";
    const brandId = formData.get("brand_id") as string || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify brand belongs to user
    if (brandId) {
      const { data: brand } = await admin
        .from("brands")
        .select("id, owner_id")
        .eq("id", brandId)
        .eq("owner_id", user.id)
        .single();

      if (!brand) {
        return NextResponse.json({ error: "Brand not found or not yours" }, { status: 403 });
      }
    }

    // Upload image
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("gallery-images")
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage
      .from("gallery-images")
      .getPublicUrl(path);

    const imageUrl = urlData.publicUrl;

    // If brand_id and title provided, also create the post (bypasses RLS)
    if (brandId && title) {
      const insertData: Record<string, unknown> = {
        brand_id: brandId,
        image_url: imageUrl,
        title: title.trim(),
        caption: caption.trim() || null,
        link_url: linkUrl.trim() || null,
        status: "pending",
      };

      const { error: insertError } = await admin
        .from("gallery_posts")
        .insert(insertData);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ url: imageUrl, postCreated: true });
    }

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Gallery upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
