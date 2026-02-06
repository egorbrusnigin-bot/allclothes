import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvsaxxnlnzpswtyjpgkr.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, eventType, productId, amount } = body;

    if (!brandId || !eventType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validEvents = ["page_view", "product_view", "favorite", "unfavorite", "order", "sale"];
    if (!validEvents.includes(eventType)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert analytics event
    const { error } = await supabase.from("brand_analytics").insert({
      brand_id: brandId,
      event_type: eventType,
      product_id: productId || null,
      amount: amount || 0,
    });

    if (error) {
      console.error("Analytics error:", error);
      // Don't fail the request - analytics shouldn't break the app
      return NextResponse.json({ success: true, warning: "Analytics may not have been recorded" });
    }

    // Also update daily stats
    const today = new Date().toISOString().split("T")[0];

    const { data: existingStat } = await supabase
      .from("brand_daily_stats")
      .select("*")
      .eq("brand_id", brandId)
      .eq("date", today)
      .single();

    if (existingStat) {
      const updates: Record<string, number> = {};
      if (eventType === "page_view") updates.page_views = existingStat.page_views + 1;
      if (eventType === "product_view") updates.product_views = existingStat.product_views + 1;
      if (eventType === "favorite") updates.favorites = existingStat.favorites + 1;
      if (eventType === "order") updates.orders = existingStat.orders + 1;
      if (eventType === "sale") updates.sales = existingStat.sales + (amount || 0);

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("brand_daily_stats")
          .update(updates)
          .eq("id", existingStat.id);
      }
    } else {
      await supabase.from("brand_daily_stats").insert({
        brand_id: brandId,
        date: today,
        page_views: eventType === "page_view" ? 1 : 0,
        product_views: eventType === "product_view" ? 1 : 0,
        favorites: eventType === "favorite" ? 1 : 0,
        orders: eventType === "order" ? 1 : 0,
        sales: eventType === "sale" ? (amount || 0) : 0,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics track error:", error);
    return NextResponse.json({ success: true }); // Don't fail
  }
}
