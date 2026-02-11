import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

async function getSellerUser(token: string) {
  const client = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getSellerUser(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Check if user is approved seller
    const { data: seller } = await admin
      .from("sellers")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (!seller || seller.status !== "approved") {
      return NextResponse.json({ error: "Not a seller" }, { status: 403 });
    }

    // Get seller's brands
    const { data: brands } = await admin
      .from("brands")
      .select("id")
      .eq("owner_id", user.id);

    if (!brands || brands.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const brandIds = brands.map((b: any) => b.id);

    // Load orders using service role (bypasses RLS)
    const { data: ordersData, error } = await admin
      .from("orders")
      .select(`
        id,
        created_at,
        status,
        total_amount,
        currency,
        payment_status,
        payment_method,
        customer_email,
        customer_name,
        shipping_address,
        stripe_payment_intent_id,
        tracking_number,
        label_url,
        carrier,
        service_level,
        order_items (
          id,
          product_id,
          product_name,
          size,
          quantity,
          price,
          image_url
        )
      `)
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Seller orders query error:", error);
      // Fallback: query without join, try to get order_items separately
      const { data: simpleOrders, error: simpleError } = await admin
        .from("orders")
        .select("*")
        .in("brand_id", brandIds)
        .order("created_at", { ascending: false });

      if (simpleError) {
        return NextResponse.json({ error: simpleError.message }, { status: 500 });
      }

      // Try to load order_items separately with minimal columns
      const orderIds = (simpleOrders || []).map((o: any) => o.id);
      let itemsMap: Record<string, any[]> = {};
      if (orderIds.length > 0) {
        const { data: items } = await admin
          .from("order_items")
          .select("order_id, product_id, product_name, size, quantity, price")
          .in("order_id", orderIds);
        if (items) {
          for (const item of items) {
            if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
            itemsMap[item.order_id].push(item);
          }
        }
      }

      const orders = (simpleOrders || []).map((o: any) => ({
        ...o,
        order_items: itemsMap[o.id] || [],
      }));

      return NextResponse.json({ orders });
    }

    return NextResponse.json({ orders: ordersData || [] });
  } catch (error) {
    console.error("Seller orders error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
