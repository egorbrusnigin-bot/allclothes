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

export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const paymentIntentId = request.nextUrl.searchParams.get("payment_intent");

    if (!paymentIntentId) {
      return NextResponse.json({ error: "payment_intent required" }, { status: 400 });
    }

    // Получаем payment intent из Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Если платёж прошёл — проверяем/создаём заказ
    if (paymentIntent.status === "succeeded") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const noteMarker = `stripe:${paymentIntentId}`;

      // Проверяем, есть ли уже заказ
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("notes", noteMarker)
        .single();

      if (order) {
        return NextResponse.json({
          status: paymentIntent.status,
          orderNumber: order.order_number,
        });
      }

      // Заказа нет — создаём (fallback для localhost без вебхуков)
      const orderNumber = await createOrderFromPaymentIntent(supabase, paymentIntent);

      return NextResponse.json({
        status: paymentIntent.status,
        orderNumber,
      });
    }

    return NextResponse.json({
      status: paymentIntent.status,
      orderNumber: null,
    });
  } catch (error) {
    console.error("Payment status check error:", error);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    );
  }
}

// Создание заказа из данных payment intent (fallback без вебхука)
async function createOrderFromPaymentIntent(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<string | null> {
  const noteMarker = `stripe:${paymentIntent.id}`;
  const metadata = paymentIntent.metadata;
  const userId = metadata.user_id;
  const brandId = metadata.brand_id;
  const sellerId = metadata.seller_id;
  const cartItemsJson = metadata.cart_items;
  const shippingAddress = metadata.shipping_address;

  if (!userId || !cartItemsJson) {
    console.error("Missing metadata in payment intent:", paymentIntent.id);
    return null;
  }

  const cartItems = JSON.parse(cartItemsJson);
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
    return null;
  }

  // Получаем цены продуктов
  const productIds = [...new Set(cartItems.map((i: { productId: string }) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("id, price, currency, brand_id")
    .in("id", productIds);

  const priceMap = new Map(products?.map((p: any) => [p.id, p]) || []);

  // Создаём позиции заказа (цены в EUR, курсы с API)
  const rates = await getServerExchangeRates();
  const orderItems = cartItems.map((item: any) => {
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

  // Уменьшаем количество на складе
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
        .update({ quantity: newQuantity, in_stock: newQuantity > 0 })
        .eq("id", sizeData.id);
    }
  }

  // Обновляем баланс и статистику бренда
  if (brandId) {
    const { data: brand } = await supabase
      .from("brands")
      .select("balance, total_sales, total_orders")
      .eq("id", brandId)
      .single();

    if (brand) {
      await supabase
        .from("brands")
        .update({
          balance: (brand.balance || 0) + sellerAmount * 100,
          total_sales: (brand.total_sales || 0) + sellerAmount * 100,
          total_orders: (brand.total_orders || 0) + 1,
        })
        .eq("id", brandId);
    }
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

  console.log("Order created (fallback):", order.order_number);
  return order.order_number;
}
