import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { notifySellerNewOrder } from "../../../lib/notifySellerNewOrder";
import { getServerExchangeRates } from "../../../lib/exchangeRates";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" })
  : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabase, paymentIntent);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutPaid(supabase, payout);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(supabase, payout);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handlePaymentSucceeded(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  const noteMarker = `stripe:${paymentIntent.id}`;

  // Check if order already exists (idempotency)
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("notes", noteMarker)
    .single();

  if (existing) {
    console.log("Order already exists for payment:", paymentIntent.id);
    return;
  }

  // Get metadata from payment intent
  const metadata = paymentIntent.metadata;
  const userId = metadata.user_id;
  const brandId = metadata.brand_id;
  const sellerId = metadata.seller_id;
  const cartItemsJson = metadata.cart_items;
  const shippingAddress = metadata.shipping_address;

  if (!userId || !cartItemsJson) {
    console.error("Missing metadata in payment intent:", paymentIntent.id);
    return;
  }

  const cartItems = JSON.parse(cartItemsJson);

  // Calculate amounts
  const totalAmount = paymentIntent.amount / 100;
  const platformFee = paymentIntent.application_fee_amount
    ? paymentIntent.application_fee_amount / 100
    : totalAmount * 0.1;
  const sellerAmount = totalAmount - platformFee;
  const currency = paymentIntent.currency.toUpperCase();

  // Парсим адрес доставки
  let parsedShipping = null;
  if (shippingAddress) {
    try {
      const addr = JSON.parse(shippingAddress);
      parsedShipping = {
        name: addr.fullName || "",
        address: addr.address || "",
        city: addr.city || "",
        postal_code: addr.postalCode || "",
        country: addr.country || "",
      };
    } catch { /* ignore */ }
  }

  // Создаём заказ
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      brand_id: brandId || null,
      status: "pending",
      total: totalAmount,
      total_amount: Math.round(totalAmount * 100),
      currency,
      notes: noteMarker,
      customer_email: metadata.email || "",
      customer_name: parsedShipping?.name || "",
      payment_status: "paid",
      payment_method: "card",
      shipping_address: parsedShipping ? JSON.stringify(parsedShipping) : null,
      stripe_payment_intent_id: paymentIntent.id,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    console.error("Order creation error:", orderErr);
    return;
  }

  // Get product prices for validation
  const productIds = [...new Set(cartItems.map((i: { productId: string }) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("id, price, currency, brand_id")
    .in("id", productIds);

  const priceMap = new Map(products?.map((p: any) => [p.id, p]) || []);

  // Create order items (prices converted to EUR using live rates)
  const rates = await getServerExchangeRates();
  const orderItems = cartItems.map((item: {
    productId: string;
    productName: string;
    brandName: string;
    price: number;
    currency: string;
    size: string;
    quantity: number;
    imageUrl: string;
  }) => {
    const product: any = priceMap.get(item.productId);
    const rawPrice = product?.price || item.price;
    const rawCurrency = (product?.currency || item.currency || "EUR").toUpperCase();
    let priceEUR = rawPrice;
    if (rawCurrency === "USD") priceEUR = rawPrice * rates.usdToEur;
    else if (rawCurrency === "GBP") priceEUR = rawPrice * rates.gbpToEur;
    return {
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      brand_name: item.brandName,
      price: Math.round(priceEUR * 100) / 100,
      currency: "EUR",
      size: item.size,
      quantity: item.quantity,
      image_url: item.imageUrl || null,
    };
  });

  await supabase.from("order_items").insert(orderItems);

  // Decrease product quantities
  for (const item of cartItems) {
    const { data: sizeData } = await supabase
      .from("product_sizes")
      .select("id, quantity")
      .eq("product_id", item.productId)
      .eq("size", item.size)
      .single();

    if (sizeData) {
      const newQuantity = Math.max(0, sizeData.quantity - item.quantity);
      await supabase
        .from("product_sizes")
        .update({
          quantity: newQuantity,
          in_stock: newQuantity > 0,
        })
        .eq("id", sizeData.id);
    }
  }

  // Create payment record
  await supabase.from("payments").insert({
    order_id: order.id,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_transfer_id: paymentIntent.transfer_data?.destination as string || null,
    amount: totalAmount,
    platform_fee: platformFee,
    seller_amount: sellerAmount,
    currency,
    status: "succeeded",
    seller_id: sellerId || null,
    brand_id: brandId || null,
  });

  // Update brand balance and stats
  if (brandId) {
    // Get current brand data
    const { data: brand } = await supabase
      .from("brands")
      .select("balance, total_sales, total_orders")
      .eq("id", brandId)
      .single();

    if (brand) {
      await supabase
        .from("brands")
        .update({
          balance: (brand.balance || 0) + sellerAmount * 100, // Store in cents
          total_sales: (brand.total_sales || 0) + sellerAmount * 100,
          total_orders: (brand.total_orders || 0) + 1,
        })
        .eq("id", brandId);
    }

    // Track analytics event
    await supabase.from("brand_analytics").insert({
      brand_id: brandId,
      event_type: "sale",
      amount: sellerAmount,
      user_id: userId,
    });
  }

  // Notify seller about new order
  if (brandId) {
    await notifySellerNewOrder({
      orderId: order.id,
      brandId,
      customerEmail: metadata.email || "",
      customerName: parsedShipping?.name || "",
      totalAmount: Math.round(totalAmount * 100),
      currency,
      items: cartItems.map((i: any) => ({
        productName: i.productName,
        size: i.size,
        quantity: i.quantity,
      })),
    });
  }

  // Update daily stats
  await updateBrandDailyStats(supabase, brandId, sellerAmount);

  console.log("Order created successfully:", order.order_number);
}

async function handlePaymentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
) {
  // Update payment record if exists
  await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", paymentIntent.id);

  console.log("Payment failed:", paymentIntent.id);
}

async function handleAccountUpdated(
  supabase: any,
  account: Stripe.Account
) {
  // Update seller's Stripe status
  const { error } = await supabase
    .from("sellers")
    .update({
      stripe_onboarding_complete: account.details_submitted || false,
      stripe_payouts_enabled: account.payouts_enabled || false,
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    console.error("Error updating seller Stripe status:", error);
  } else {
    console.log("Seller Stripe status updated:", account.id);
  }
}

async function handlePayoutPaid(
  supabase: any,
  payout: Stripe.Payout
) {
  // Update payout record
  await supabase
    .from("payouts")
    .update({ status: "paid" })
    .eq("stripe_payout_id", payout.id);

  console.log("Payout completed:", payout.id);
}

async function handlePayoutFailed(
  supabase: any,
  payout: Stripe.Payout
) {
  // Update payout record
  await supabase
    .from("payouts")
    .update({ status: "failed" })
    .eq("stripe_payout_id", payout.id);

  console.log("Payout failed:", payout.id);
}

// Update brand_daily_stats with new sale
async function updateBrandDailyStats(
  supabase: any,
  brandId: string | null,
  sellerAmount: number
) {
  if (!brandId) return;

  const today = new Date().toISOString().split("T")[0];

  // Check if row exists for today
  const { data: existing } = await supabase
    .from("brand_daily_stats")
    .select("id, orders, sales")
    .eq("brand_id", brandId)
    .eq("date", today)
    .single();

  if (existing) {
    await supabase
      .from("brand_daily_stats")
      .update({
        orders: (existing.orders || 0) + 1,
        sales: (existing.sales || 0) + Math.round(sellerAmount * 100),
      })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("brand_daily_stats")
      .insert({
        brand_id: brandId,
        date: today,
        page_views: 0,
        product_views: 0,
        orders: 1,
        sales: Math.round(sellerAmount * 100),
      });
  }
}
