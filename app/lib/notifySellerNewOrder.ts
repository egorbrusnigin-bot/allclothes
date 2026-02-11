import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

interface OrderNotification {
  orderId: string;
  brandId: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number; // in cents
  currency: string;
  items: { productName: string; size: string; quantity: number }[];
}

export async function notifySellerNewOrder(order: OrderNotification) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get brand owner info
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name, owner_id")
      .eq("id", order.brandId)
      .single();

    if (!brand) return;

    // Get owner email
    const { data: { user } } = await supabase.auth.admin.getUserById(brand.owner_id);
    const sellerEmail = user?.email;

    if (!sellerEmail) return;

    const totalFormatted = `€${(order.totalAmount / 100).toFixed(2)}`;
    const customerDisplay = order.customerName || order.customerEmail;

    // 1. Create in-app notification
    await supabase.from("notifications").insert({
      user_id: brand.owner_id,
      type: "new_order",
      title: "New Order Received",
      message: `Order for ${totalFormatted} from ${customerDisplay}`,
      data: {
        order_id: order.orderId,
        brand_id: order.brandId,
        total: order.totalAmount,
        items_count: order.items.length,
      },
      read: false,
    });

    // 2. Send email via Resend
    if (resend) {
      const itemsHtml = order.items
        .map(
          (i) =>
            `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${i.productName}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${i.size}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${i.quantity}</td>
            </tr>`
        )
        .join("");

      await resend.emails.send({
        from: EMAIL_FROM,
        to: sellerEmail,
        subject: `New order ${totalFormatted} — ${brand.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
            <div style="background:#000;color:#fff;padding:20px 24px">
              <h1 style="margin:0;font-size:16px;letter-spacing:1px">NEW ORDER</h1>
            </div>
            <div style="padding:24px;border:1px solid #eee;border-top:none">
              <p style="margin:0 0 16px;font-size:14px;color:#666">
                You have a new order on <strong>${brand.name}</strong>
              </p>
              <div style="background:#f9f9f9;padding:16px;margin-bottom:20px">
                <div style="font-size:24px;font-weight:700;margin-bottom:4px">${totalFormatted}</div>
                <div style="font-size:13px;color:#666">from ${customerDisplay}</div>
              </div>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <thead>
                  <tr style="background:#f5f5f5">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px">Product</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px">Size</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px">Qty</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://allclothes.com"}/account/seller/orders"
                 style="display:inline-block;background:#000;color:#fff;padding:12px 24px;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">
                View Order
              </a>
              <p style="margin:20px 0 0;font-size:12px;color:#999">
                Please ship this order as soon as possible.
              </p>
            </div>
          </div>
        `,
      });

      console.log(`Email sent to ${sellerEmail} for order ${order.orderId}`);
    }

    console.log(`Notification created for seller ${sellerEmail} - order ${order.orderId}`);
  } catch (error) {
    console.error("Failed to notify seller:", error);
    // Don't throw - notification failure shouldn't break order flow
  }
}
