import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" })
  : null;

// Country code mapping for Stripe
const countryCodeMap: Record<string, string> = {
  "Russia": "RU",
  "United States": "US",
  "USA": "US",
  "Germany": "DE",
  "France": "FR",
  "Italy": "IT",
  "Spain": "ES",
  "United Kingdom": "GB",
  "UK": "GB",
  "Netherlands": "NL",
  "Belgium": "BE",
  "Austria": "AT",
  "Switzerland": "CH",
  "Portugal": "PT",
  "Poland": "PL",
  "Sweden": "SE",
  "Denmark": "DK",
  "Norway": "NO",
  "Finland": "FI",
  "Ireland": "IE",
  "Greece": "GR",
  "Czech Republic": "CZ",
  "Romania": "RO",
  "Hungary": "HU",
  "Bulgaria": "BG",
  "Croatia": "HR",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Lithuania": "LT",
  "Latvia": "LV",
  "Estonia": "EE",
  "Luxembourg": "LU",
  "Malta": "MT",
  "Cyprus": "CY",
  "Japan": "JP",
  "Australia": "AU",
  "Canada": "CA",
  "China": "CN",
  "South Korea": "KR",
  "Brazil": "BR",
  "Mexico": "MX",
  "India": "IN",
  "Singapore": "SG",
  "Hong Kong": "HK",
  "New Zealand": "NZ",
  "UAE": "AE",
  "United Arab Emirates": "AE",
};

function getCountryCode(country: string | null): string {
  if (!country) return "US";
  return countryCodeMap[country] || country.substring(0, 2).toUpperCase();
}

// POST: Create or get Connect account and return onboarding link
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables." },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get seller record
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("id, brand_name, email, country, city, status, stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (sellerError || !seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (seller.status !== "approved") {
      return NextResponse.json({ error: "Seller not approved" }, { status: 403 });
    }

    let stripeAccountId = seller.stripe_account_id;

    // Create Stripe Connect account if doesn't exist
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: getCountryCode(seller.country),
        email: seller.email || user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          name: seller.brand_name,
          product_description: "Fashion and clothing items",
        },
        metadata: {
          seller_id: seller.id,
          user_id: user.id,
        },
      });

      stripeAccountId = account.id;

      // Save account ID to database
      await supabase
        .from("sellers")
        .update({ stripe_account_id: account.id })
        .eq("id", seller.id);
    }

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://allclothes.store";

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/account/seller/stripe?refresh=1`,
      return_url: `${baseUrl}/account/seller/stripe?success=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Connect account" },
      { status: 500 }
    );
  }
}

// GET: Get Connect account status
export async function GET(request: NextRequest) {
  try {
    // If Stripe is not configured, return not connected status
    if (!stripe) {
      return NextResponse.json({
        connected: false,
        onboarding_complete: false,
        payouts_enabled: false,
        balance: null,
        stripe_not_configured: true,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get seller record
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled")
      .eq("user_id", user.id)
      .single();

    if (sellerError || !seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    if (!seller.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        onboarding_complete: false,
        payouts_enabled: false,
        balance: null,
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(seller.stripe_account_id);

    // Get balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: seller.stripe_account_id,
    });

    // Update DB if status changed
    const onboardingComplete = account.details_submitted || false;
    const payoutsEnabled = account.payouts_enabled || false;

    if (
      onboardingComplete !== seller.stripe_onboarding_complete ||
      payoutsEnabled !== seller.stripe_payouts_enabled
    ) {
      await supabase
        .from("sellers")
        .update({
          stripe_onboarding_complete: onboardingComplete,
          stripe_payouts_enabled: payoutsEnabled,
        })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      connected: true,
      onboarding_complete: onboardingComplete,
      payouts_enabled: payoutsEnabled,
      balance: {
        available: balance.available.map(b => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount / 100,
          currency: b.currency.toUpperCase(),
        })),
      },
    });
  } catch (error) {
    console.error("Stripe status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get account status" },
      { status: 500 }
    );
  }
}
