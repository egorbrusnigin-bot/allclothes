import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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

    // ── 2. Parse + validate body ────────────────────────
    const { cartItems, email }: { cartItems: CartItem[]; email: string } =
      await request.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // ── 3. Server-side price validation ─────────────────
    let serverTotal = 0;
    const productIds = [...new Set(cartItems.map((i) => i.productId))];

    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, price, status")
      .in("id", productIds);

    if (prodErr || !products) {
      return NextResponse.json(
        { error: "Failed to validate products" },
        { status: 500 }
      );
    }

    const priceMap = new Map(products.map((p: { id: string; price: number; status: string }) => [p.id, p]));

    for (const item of cartItems) {
      const product = priceMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 }
        );
      }
      if (product.status !== "approved") {
        return NextResponse.json(
          { error: `Product ${item.productId} is not available` },
          { status: 400 }
        );
      }
      serverTotal += product.price * item.quantity;
    }

    // ── 4. Create lava.top invoice ──────────────────────
    const apiKey = process.env.LAVA_API_KEY;
    const offerId = process.env.LAVA_OFFER_ID;

    if (!apiKey || !offerId) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 500 }
      );
    }

    const currency = cartItems[0].currency;

    const invoiceRes = await fetch("https://api.lava.top/api/v3/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        email,
        offerId,
        currency,
        amount: serverTotal,
      }),
    });

    if (!invoiceRes.ok) {
      const invoiceErr = await invoiceRes.text();
      console.error("lava.top invoice error:", invoiceErr);
      return NextResponse.json(
        { error: "Payment provider error" },
        { status: 502 }
      );
    }

    const invoice = await invoiceRes.json();

    return NextResponse.json({
      invoiceId: invoice.id,
      paymentUrl: invoice.paymentUrl,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
