import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

interface CartItem {
  productId: string;
  productName: string;
  brandName: string;
  price: number;
  currency: string;
  size: string;
  quantity: number;
  imageUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ─────────────────────────────────────────
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Parse body ───────────────────────────────────
    const { invoiceId, cartItems }: { invoiceId: string; cartItems: CartItem[] } =
      await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    }
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // ── 3. Check invoice status with lava.top ───────────
    const apiKey = process.env.LAVA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 500 }
      );
    }

    const statusRes = await fetch(
      `https://api.lava.top/api/v2/invoices/${invoiceId}`,
      {
        headers: { "X-Api-Key": apiKey },
      }
    );

    if (!statusRes.ok) {
      console.error("lava.top status check failed:", await statusRes.text());
      return NextResponse.json(
        { error: "Failed to check payment status" },
        { status: 502 }
      );
    }

    const invoiceData = await statusRes.json();

    if (invoiceData.status !== "COMPLETED") {
      return NextResponse.json({ status: invoiceData.status });
    }

    // ── 4. Idempotency: check if order already created ─
    const noteMarker = `lava:${invoiceId}`;
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("notes", noteMarker)
      .single();

    if (existing) {
      return NextResponse.json({ orderNumber: existing.order_number });
    }

    // ── 5. Server-side price validation ─────────────────
    const productIds = [...new Set(cartItems.map((i) => i.productId))];
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, price, status, brand_id")
      .in("id", productIds);

    if (!products) {
      return NextResponse.json(
        { error: "Product validation failed" },
        { status: 500 }
      );
    }

    const priceMap = new Map(products.map((p: { id: string; price: number }) => [p.id, p]));
    let serverTotal = 0;

    for (const item of cartItems) {
      const product = priceMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 }
        );
      }
      serverTotal += product.price * item.quantity;
    }

    // ── 6. Create order in Supabase ─────────────────────
    const currency = cartItems[0].currency;

    // Get brand_id from products
    const brandIds = new Set<string>();
    for (const item of cartItems) {
      const product = priceMap.get(item.productId) as any;
      if (product?.brand_id) {
        brandIds.add(product.brand_id);
      }
    }
    const brandId = [...brandIds][0] || null;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        brand_id: brandId,
        status: "pending",
        total: serverTotal,
        total_amount: Math.round(serverTotal * 100),
        currency,
        payment_status: "paid",
        payment_method: "card",
        notes: noteMarker,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      console.error("Order creation error:", orderErr);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // ── 7. Create order items ───────────────────────────
    const orderItems = cartItems.map((item) => {
      const product = priceMap.get(item.productId);
      return {
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        brand_name: item.brandName,
        price: product!.price,
        currency: item.currency,
        size: item.size,
        quantity: item.quantity,
        image_url: item.imageUrl || null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsErr) {
      console.error("Order items creation error:", itemsErr);
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500 }
      );
    }

    // ── 8. Decrease product quantities ────────────────────
    for (const item of cartItems) {
      // Get current quantity for this size
      const { data: sizeData } = await supabaseAdmin
        .from("product_sizes")
        .select("id, quantity")
        .eq("product_id", item.productId)
        .eq("size", item.size)
        .single();

      if (sizeData) {
        const newQuantity = Math.max(0, sizeData.quantity - item.quantity);
        await supabaseAdmin
          .from("product_sizes")
          .update({
            quantity: newQuantity,
            in_stock: newQuantity > 0,
          })
          .eq("id", sizeData.id);
      }
    }

    // ── 9. Update brand balance and stats ────────────────
    if (brandId) {
      const platformFee = serverTotal * 0.1;
      const sellerAmount = serverTotal - platformFee;

      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("balance, total_sales, total_orders")
        .eq("id", brandId)
        .single();

      if (brand) {
        await supabaseAdmin
          .from("brands")
          .update({
            balance: (brand.balance || 0) + sellerAmount * 100,
            total_sales: (brand.total_sales || 0) + sellerAmount * 100,
            total_orders: (brand.total_orders || 0) + 1,
          })
          .eq("id", brandId);
      }
    }

    return NextResponse.json({ orderNumber: order.order_number });
  } catch (err) {
    console.error("Confirm checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
