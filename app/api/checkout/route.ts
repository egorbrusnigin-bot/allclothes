import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import Stripe from "stripe";
import { convertToEURServer } from "../../lib/exchangeRates";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" })
  : null;

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
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment system is not configured. Please contact support." },
        { status: 503 }
      );
    }

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
    const { cartItems, email, shippingAddress }: {
      cartItems: CartItem[];
      email: string;
      shippingAddress?: {
        fullName: string;
        address: string;
        city: string;
        postalCode: string;
        country: string;
      };
    } = await request.json();

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
      .select("id, price, currency, status, brand_id")
      .in("id", productIds);

    if (prodErr || !products) {
      return NextResponse.json(
        { error: "Failed to validate products" },
        { status: 500 }
      );
    }

    const priceMap = new Map(products.map((p) => [p.id, p]));

    // Check all products and calculate total
    const brandIds = new Set<string>();
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
      // Конвертируем в EUR (платформа работает в евро)
      const priceInEUR = await convertToEURServer(product.price, product.currency || "EUR");
      serverTotal += priceInEUR * item.quantity;
      if (product.brand_id) {
        brandIds.add(product.brand_id);
      }
    }

    // For now, we only support single-seller checkout
    // TODO: Support multi-seller checkout with separate payment intents
    if (brandIds.size > 1) {
      return NextResponse.json(
        { error: "Cart contains items from multiple sellers. Please checkout separately." },
        { status: 400 }
      );
    }

    const brandId = [...brandIds][0];
    // Платформа работает в EUR — всё конвертируется в евро
    const currency = "eur";

    // ── 4. Get seller's Stripe account ──────────────────
    let stripeAccountId: string | null = null;
    let sellerId: string | null = null;

    if (brandId) {
      const { data: brand } = await supabaseAdmin
        .from("brands")
        .select("owner_id")
        .eq("id", brandId)
        .single();

      if (brand?.owner_id) {
        // Get seller ID first (basic fields)
        const { data: sellerBasic } = await supabaseAdmin
          .from("sellers")
          .select("id")
          .eq("user_id", brand.owner_id)
          .single();

        if (sellerBasic) {
          sellerId = sellerBasic.id;

          // Try to get stripe fields (may not exist if migration not applied)
          const { data: sellerStripe } = await supabaseAdmin
            .from("sellers")
            .select("stripe_account_id, stripe_payouts_enabled")
            .eq("user_id", brand.owner_id)
            .single();

          if (sellerStripe?.stripe_account_id && sellerStripe?.stripe_payouts_enabled) {
            stripeAccountId = sellerStripe.stripe_account_id;
          }
        }
      }
    }

    // ── 5. Require Stripe Connect ───────────────────────
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "This seller has not set up payments yet. Please try again later." },
        { status: 400 }
      );
    }

    // ── 6. Create Stripe Payment Intent ─────────────────
    const amountInCents = Math.round(serverTotal * 100);
    const platformFee = Math.round(amountInCents * 0.10); // 10% platform fee

    // Prepare metadata (limited to 500 chars per value)
    const cartItemsForMeta = cartItems.map(item => ({
      productId: item.productId,
      productName: item.productName.substring(0, 50),
      brandName: item.brandName.substring(0, 30),
      price: item.price,
      currency: item.currency,
      size: item.size,
      quantity: item.quantity,
      imageUrl: item.imageUrl?.substring(0, 100) || "",
    }));

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: user.id,
        email,
        brand_id: brandId || "",
        seller_id: sellerId || "",
        cart_items: JSON.stringify(cartItemsForMeta),
        shipping_address: shippingAddress
          ? JSON.stringify(shippingAddress)
          : "",
      },
      receipt_email: email,
    };

    // If seller has Stripe Connect, split the payment
    if (stripeAccountId) {
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      };
      paymentIntentParams.application_fee_amount = platformFee;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: serverTotal,
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
