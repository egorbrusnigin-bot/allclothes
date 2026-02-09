import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // If payment succeeded, check for order in database
    if (paymentIntent.status === "succeeded") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Check if order exists
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("notes", `stripe:${paymentIntentId}`)
        .single();

      return NextResponse.json({
        status: paymentIntent.status,
        orderNumber: order?.order_number || null,
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
