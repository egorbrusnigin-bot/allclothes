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

// POST: получить рейты для заказа
export async function POST(request: NextRequest) {
  try {
    if (!shippo) {
      return NextResponse.json(
        { error: "Shipping service not configured. Add SHIPPO_API_KEY to .env" },
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

    const { orderId, parcel, addressFrom } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Проверяем что заказ принадлежит продавцу
    const { data: order } = await admin
      .from("orders")
      .select("id, shipping_address, brand_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Проверяем что бренд принадлежит продавцу
    const { data: brand } = await admin
      .from("brands")
      .select("id, owner_id")
      .eq("id", order.brand_id)
      .eq("owner_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "Not your order" }, { status: 403 });
    }

    // Парсим адрес доставки
    let shippingAddr = order.shipping_address;
    if (typeof shippingAddr === "string") {
      try { shippingAddr = JSON.parse(shippingAddr); } catch { shippingAddr = null; }
    }

    if (!shippingAddr) {
      return NextResponse.json({ error: "No shipping address on order" }, { status: 400 });
    }

    // Создаём shipment в Shippo для получения рейтов
    const shipment = await shippo.shipments.create({
      addressFrom: {
        name: addressFrom?.name || "Sender",
        street1: addressFrom?.street1 || addressFrom?.address || "",
        city: addressFrom?.city || "",
        zip: addressFrom?.zip || addressFrom?.postalCode || "",
        country: addressFrom?.country || "DE",
      },
      addressTo: {
        name: shippingAddr.name || shippingAddr.fullName || "",
        street1: shippingAddr.address || "",
        city: shippingAddr.city || "",
        zip: shippingAddr.postal_code || shippingAddr.postalCode || "",
        country: shippingAddr.country || "",
      },
      parcels: [
        {
          length: parcel?.length || "30",
          width: parcel?.width || "20",
          height: parcel?.height || "10",
          distanceUnit: "cm",
          weight: parcel?.weight || "0.5",
          massUnit: "kg",
        },
      ],
      async: false,
    });

    // Возвращаем рейты
    const rates = (shipment.rates || []).map((r: any) => ({
      objectId: r.objectId,
      carrier: r.provider,
      service: r.servicelevel?.name || r.servicelevel?.token || "",
      price: r.amount,
      currency: r.currency,
      days: r.estimatedDays || r.durationTerms || null,
    }));

    return NextResponse.json({
      shipmentId: shipment.objectId,
      rates,
    });
  } catch (error: any) {
    console.error("Shipping rates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get rates" },
      { status: 500 }
    );
  }
}
