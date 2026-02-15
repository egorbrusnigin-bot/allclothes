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

// GET — messages in a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const supabase = getSupabase();

    // Verify user is participant
    const { data: conv } = await supabase
      .from("conversations")
      .select("buyer_id, brand_id")
      .eq("id", conversationId)
      .single();

    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const { data: brands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id);
    const brandIds = brands?.map((b: any) => b.id) || [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.role === "admin";

    const isParticipant = conv.buyer_id === user.id || brandIds.includes(conv.brand_id) || isAdmin;
    if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get cursor for pagination
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = 50;

    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    // Filter deleted messages for this user
    const filtered = (messages || []).map((msg: any) => {
      if (msg.deleted_for_all) {
        return { ...msg, text: "", isDeleted: true };
      }
      if (msg.deleted_by?.includes(user.id)) {
        return { ...msg, text: "", isDeleted: true };
      }
      return { ...msg, isDeleted: false };
    });

    // Get reactions for these messages
    const msgIds = filtered.map((m: any) => m.id);
    const { data: reactions } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", msgIds.length > 0 ? msgIds : ["00000000-0000-0000-0000-000000000000"]);

    // Group reactions by message
    const reactionMap: Record<string, any[]> = {};
    (reactions || []).forEach((r: any) => {
      if (!reactionMap[r.message_id]) reactionMap[r.message_id] = [];
      reactionMap[r.message_id].push(r);
    });

    const enriched = filtered.map((msg: any) => ({
      ...msg,
      reactions: reactionMap[msg.id] || [],
    }));

    return NextResponse.json({
      messages: enriched.reverse(), // chronological order
      hasMore: (messages || []).length === limit,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

// POST — send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const { text } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

    const supabase = getSupabase();

    // Verify user is participant
    const { data: conv } = await supabase
      .from("conversations")
      .select("buyer_id, brand_id")
      .eq("id", conversationId)
      .single();

    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const { data: brands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id);
    const brandIds = brands?.map((b: any) => b.id) || [];

    const isParticipant = conv.buyer_id === user.id || brandIds.includes(conv.brand_id);
    if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: text.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
