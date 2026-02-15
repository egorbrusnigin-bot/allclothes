import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getUser(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

// GET — all conversations for admin
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      // Fallback: check env
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",");
      const { data: { user: fullUser } } = await supabase.auth.admin.getUserById(user.id);
      if (!fullUser?.email || !adminEmails.includes(fullUser.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get all conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    // Enrich
    const enriched = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const { data: brand } = await supabase
          .from("brands")
          .select("id, name, slug, logo_url")
          .eq("id", conv.brand_id)
          .single();

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("text, sender_id, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Message count
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id);

        // Buyer email
        const { data: { user: buyer } } = await supabase.auth.admin.getUserById(conv.buyer_id);

        return {
          ...conv,
          brand,
          buyerEmail: buyer?.email || "",
          lastMessage: lastMsg,
          messageCount: count || 0,
        };
      })
    );

    return NextResponse.json({ conversations: enriched });
  } catch (error) {
    console.error("Admin chats error:", error);
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
  }
}
