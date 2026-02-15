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

// POST — delete a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const { messageId } = await request.json();
    if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

    const supabase = getSupabase();

    // Get message
    const { data: message } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .single();

    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // Check if user is sender and within 1 hour
    const createdAt = new Date(message.created_at).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const isSender = message.sender_id === user.id;
    const withinHour = createdAt > oneHourAgo;

    if (isSender && withinHour) {
      // Delete for everyone
      await supabase
        .from("messages")
        .update({ deleted_for_all: true })
        .eq("id", messageId);

      return NextResponse.json({ deleted: "all" });
    } else {
      // Delete only for this user
      const deletedBy = message.deleted_by || [];
      if (!deletedBy.includes(user.id)) {
        deletedBy.push(user.id);
      }
      await supabase
        .from("messages")
        .update({ deleted_by: deletedBy })
        .eq("id", messageId);

      return NextResponse.json({ deleted: "self" });
    }
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
