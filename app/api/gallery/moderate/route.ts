import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Проверка админа
async function checkAdmin(token: string): Promise<boolean> {
  const client = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return true;

  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map(e => e.trim()) || [];
  return adminEmails.includes(user.email || "");
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || !(await checkAdmin(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId, action, reason } = await request.json();

    if (!postId || !["approve", "reject", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Используем service role для обхода RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "approve") {
      const { error } = await supabase
        .from("gallery_posts")
        .update({ status: "approved" })
        .eq("id", postId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "reject") {
      const { error } = await supabase
        .from("gallery_posts")
        .update({ status: "rejected", rejection_reason: reason || "" })
        .eq("id", postId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "delete") {
      const { error } = await supabase
        .from("gallery_posts")
        .delete()
        .eq("id", postId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gallery moderate error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
