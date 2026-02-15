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

// GET — list conversations for current user (buyer or seller)
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();

    // Get user's brand IDs (if seller)
    const { data: brands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id);
    const brandIds = brands?.map((b: any) => b.id) || [];

    // Get conversations where user is buyer OR brand owner
    let query = supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (brandIds.length > 0) {
      query = query.or(`buyer_id.eq.${user.id},brand_id.in.(${brandIds.join(",")})`);
    } else {
      query = query.eq("buyer_id", user.id);
    }

    const { data: conversations, error } = await query;
    if (error) throw error;

    // Enrich with brand info, last message, and other participant info
    const enriched = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        // Brand info
        const { data: brand } = await supabase
          .from("brands")
          .select("id, name, slug, logo_url")
          .eq("id", conv.brand_id)
          .single();

        // Last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("text, sender_id, created_at, deleted_for_all")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Order info if linked
        let orderNumber = null;
        if (conv.order_id) {
          const { data: order } = await supabase
            .from("orders")
            .select("order_number")
            .eq("id", conv.order_id)
            .single();
          orderNumber = order?.order_number;
        }

        // Buyer email for seller view
        const { data: buyerProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", conv.buyer_id)
          .single();

        // If no profile email, get from auth
        let buyerEmail = buyerProfile?.email || "";
        if (!buyerEmail) {
          const { data: { user: buyerUser } } = await supabase.auth.admin.getUserById(conv.buyer_id);
          buyerEmail = buyerUser?.email || "";
        }

        return {
          ...conv,
          brand,
          orderNumber,
          buyerEmail,
          lastMessage: lastMsg?.deleted_for_all
            ? { text: "Сообщение удалено", sender_id: lastMsg.sender_id, created_at: lastMsg.created_at }
            : lastMsg,
        };
      })
    );

    return NextResponse.json({ conversations: enriched });
  } catch (error) {
    console.error("Conversations list error:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

// POST — create or get existing conversation
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { brandId, orderId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

    const supabase = getSupabase();

    // Check if conversation already exists
    let query = supabase
      .from("conversations")
      .select("*")
      .eq("buyer_id", user.id)
      .eq("brand_id", brandId);

    if (orderId) {
      query = query.eq("order_id", orderId);
    } else {
      query = query.is("order_id", null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      return NextResponse.json({ conversation: existing });
    }

    // Get order number for subject
    let subject = "";
    if (orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .single();
      subject = order ? `Заказ #${order.order_number}` : "";
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        buyer_id: user.id,
        brand_id: brandId,
        order_id: orderId || null,
        subject,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
