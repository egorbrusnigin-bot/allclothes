import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { Shippo } from "shippo";

const shippo = process.env.SHIPPO_API_KEY
  ? new Shippo({ apiKeyHeader: process.env.SHIPPO_API_KEY })
  : null;

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

// POST: купить лейбл по выбранному рейту
export async function POST(request: NextRequest) {
  try {
    if (!shippo) {
      return NextResponse.json(
        { error: "Shipping service not configured" },
        { status: 503 }
      );
    }

    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getSellerUser(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, rateObjectId } = await request.json();

    if (!orderId || !rateObjectId) {
      return NextResponse.json({ error: "orderId and rateObjectId required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Проверяем что заказ принадлежит продавцу
    const { data: order } = await admin
      .from("orders")
      .select("id, brand_id, label_url")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.label_url) {
      return NextResponse.json({ error: "Label already created" }, { status: 400 });
    }

    const { data: brand } = await admin
      .from("brands")
      .select("id, owner_id")
      .eq("id", order.brand_id)
      .eq("owner_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "Not your order" }, { status: 403 });
    }

    // Покупаем лейбл
    const isTestKey = process.env.SHIPPO_API_KEY?.startsWith("shippo_test");
    let transaction;
    try {
      transaction = await shippo.transactions.create({
        rate: rateObjectId,
        labelFileType: "PDF",
        async: false,
      });
    } catch (shippoErr: any) {
      console.error("Shippo transaction API error:", shippoErr);
      const hint = isTestKey
        ? " You are using a Shippo test API key — some carriers do not support label creation in test mode. Use a live key for production."
        : "";
      return NextResponse.json(
        { error: (shippoErr.message || "Shippo API error") + hint },
        { status: 400 }
      );
    }

    const txn = transaction as any;

    if (txn.status !== "SUCCESS") {
      const errorMsg = txn.messages?.map((m: any) => m.text).join(", ") || "Label creation failed";
      console.error("Shippo transaction failed:", JSON.stringify(txn, null, 2));
      const hint = isTestKey
        ? " (Shippo test mode — this carrier may not support label purchase in test mode)"
        : "";
      return NextResponse.json(
        { error: errorMsg + hint },
        { status: 400 }
      );
    }

    // Сохраняем в заказ
    await admin
      .from("orders")
      .update({
        tracking_number: txn.trackingNumber || null,
        label_url: txn.labelUrl || null,
        carrier: txn.rate?.provider || null,
        service_level: txn.rate?.servicelevel?.name || null,
        shippo_transaction_id: txn.objectId || null,
        status: "shipped",
      })
      .eq("id", orderId);

    return NextResponse.json({
      trackingNumber: txn.trackingNumber,
      labelUrl: txn.labelUrl,
      carrier: txn.rate?.provider,
    });
  } catch (error: any) {
    console.error("Create label error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create label" },
      { status: 500 }
    );
  }
}
