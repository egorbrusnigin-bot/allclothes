"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  size: string;
  quantity: number;
  price: number;
  product_image?: string;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  currency: string;
  payment_status: string;
  payment_method?: string;
  customer_email: string;
  customer_name?: string;
  shipping_address?: {
    name: string;
    address: string;
    city: string;
    postal_code: string;
    country: string;
    phone?: string;
  };
  items: OrderItem[];
  stripe_payment_intent_id?: string;
}

export default function SellerOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkSellerAndLoadOrders();
  }, []);

  async function checkSellerAndLoadOrders() {
    if (!supabase) {
      router.push("/account/become-seller");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/?login=1");
      return;
    }

    // Check if user is approved seller
    const { data: seller } = await supabase
      .from("sellers")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (!seller || seller.status !== "approved") {
      router.push("/account/become-seller");
      return;
    }

    // Get seller's brands
    const { data: brands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id);

    if (!brands || brands.length === 0) {
      setLoading(false);
      return;
    }

    const brandIds = brands.map(b => b.id);

    // Load orders for seller's products
    const { data: ordersData, error } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        status,
        total_amount,
        currency,
        payment_status,
        payment_method,
        customer_email,
        customer_name,
        shipping_address,
        stripe_payment_intent_id,
        order_items (
          id,
          product_id,
          product_name,
          size,
          quantity,
          price,
          product_image
        )
      `)
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading orders:", error);
      // Try simpler query without join
      const { data: simpleOrders } = await supabase
        .from("orders")
        .select("*")
        .in("brand_id", brandIds)
        .order("created_at", { ascending: false });

      if (simpleOrders) {
        setOrders(simpleOrders.map(o => ({ ...o, items: [] })));
      }
    } else if (ordersData) {
      setOrders(ordersData.map(o => ({
        ...o,
        items: o.order_items || []
      })));
    }

    setLoading(false);
  }

  const filteredOrders = orders.filter(order => {
    // Status filter
    if (filter !== "all" && order.status !== filter) return false;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchEmail = order.customer_email?.toLowerCase().includes(q);
      const matchName = order.customer_name?.toLowerCase().includes(q);
      const matchId = order.id?.toLowerCase().includes(q);
      const matchProduct = order.items?.some(item =>
        item.product_name?.toLowerCase().includes(q)
      );
      if (!matchEmail && !matchName && !matchId && !matchProduct) return false;
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "confirmed": return "#3b82f6";
      case "shipped": return "#8b5cf6";
      case "delivered": return "#22c55e";
      case "cancelled": return "#ef4444";
      default: return "#666";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "#22c55e";
      case "pending": return "#f59e0b";
      case "failed": return "#ef4444";
      case "refunded": return "#6b7280";
      default: return "#666";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const exportToExcel = () => {
    const data = filteredOrders.map(order => ({
      "Order ID": order.id.substring(0, 8),
      "Date": formatDate(order.created_at),
      "Customer Email": order.customer_email,
      "Customer Name": order.customer_name || "",
      "Products": order.items.map(i => `${i.product_name} (${i.size})`).join(", "),
      "Total": `€${(order.total_amount / 100).toFixed(2)}`,
      "Payment Status": order.payment_status,
      "Order Status": order.status,
      "Shipping Address": order.shipping_address
        ? `${order.shipping_address.address}, ${order.shipping_address.city}, ${order.shipping_address.postal_code}, ${order.shipping_address.country}`
        : "",
      "Phone": order.shipping_address?.phone || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 10 }, { wch: 18 }, { wch: 30 }, { wch: 20 },
      { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 50 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div style={{ padding: "100px 60px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>
          Loading orders...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px 60px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/account/seller"
            style={{ fontSize: 12, color: "#666", textDecoration: "none" }}
          >
            ← Back to Dashboard
          </Link>
          <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
            ORDERS ({filteredOrders.length})
          </h1>
        </div>

        <button
          onClick={exportToExcel}
          disabled={filteredOrders.length === 0}
          style={{
            padding: "10px 20px",
            background: filteredOrders.length === 0 ? "#eee" : "#000",
            color: filteredOrders.length === 0 ? "#999" : "#fff",
            border: "none",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            cursor: filteredOrders.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: 20,
        marginBottom: 30,
        paddingBottom: 20,
        borderBottom: "1px solid #e6e6e6",
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "1px solid #e6e6e6",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "8px 16px",
                border: filter === status ? "1px solid #000" : "1px solid #e6e6e6",
                background: filter === status ? "#000" : "#fff",
                color: filter === status ? "#fff" : "#666",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#999" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            {orders.length === 0 ? "No orders yet" : "No orders match your filters"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredOrders.map(order => (
            <div key={order.id} style={{ border: "1px solid #e6e6e6" }}>
              {/* Order Header */}
              <div
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                style={{
                  padding: "16px 20px",
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 150px 100px 100px 30px",
                  gap: 20,
                  alignItems: "center",
                  cursor: "pointer",
                  background: expandedOrder === order.id ? "#fafafa" : "#fff",
                  transition: "background 0.15s",
                }}
              >
                {/* Order ID & Date */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>
                    #{order.id.substring(0, 8)}
                  </div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
                    {formatDate(order.created_at)}
                  </div>
                </div>

                {/* Customer & Products */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {order.customer_email}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    {order.items.length > 0
                      ? order.items.map(i => i.product_name).join(", ").substring(0, 60) + (order.items.map(i => i.product_name).join(", ").length > 60 ? "..." : "")
                      : "Products info unavailable"
                    }
                  </div>
                </div>

                {/* Amount */}
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  €{(order.total_amount / 100).toFixed(2)}
                </div>

                {/* Payment Status */}
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: getPaymentStatusColor(order.payment_status),
                }}>
                  {order.payment_status}
                </div>

                {/* Order Status */}
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: getStatusColor(order.status),
                }}>
                  {order.status}
                </div>

                {/* Expand Arrow */}
                <div style={{
                  fontSize: 14,
                  color: "#999",
                  transform: expandedOrder === order.id ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 0.2s"
                }}>
                  ▼
                </div>
              </div>

              {/* Expanded Details */}
              {expandedOrder === order.id && (
                <div style={{
                  padding: "20px",
                  borderTop: "1px solid #e6e6e6",
                  background: "#fafafa",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 30,
                }}>
                  {/* Left: Order Items */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                      Items
                    </div>
                    {order.items.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {order.items.map(item => (
                          <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {item.product_image && (
                              <img
                                src={item.product_image}
                                alt={item.product_name}
                                style={{ width: 50, height: 66, objectFit: "cover", background: "#eee" }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.product_name}</div>
                              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                                Size: {item.size} · Qty: {item.quantity}
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              €{(item.price / 100).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#999" }}>
                        Order items details not available
                      </div>
                    )}

                    {/* Payment Info */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e6e6e6" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                        Payment
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        <div>Method: {order.payment_method || "Card"}</div>
                        <div>Status: <span style={{ color: getPaymentStatusColor(order.payment_status), fontWeight: 600 }}>{order.payment_status}</span></div>
                        {order.stripe_payment_intent_id && (
                          <div style={{ fontSize: 10, color: "#999", marginTop: 4, fontFamily: "monospace" }}>
                            PI: {order.stripe_payment_intent_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Shipping */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                      Shipping Address
                    </div>
                    {order.shipping_address ? (
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 600 }}>{order.shipping_address.name}</div>
                        <div>{order.shipping_address.address}</div>
                        <div>{order.shipping_address.city}, {order.shipping_address.postal_code}</div>
                        <div>{order.shipping_address.country}</div>
                        {order.shipping_address.phone && (
                          <div style={{ marginTop: 8, color: "#666" }}>
                            Phone: {order.shipping_address.phone}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#999" }}>
                        Shipping address not available
                      </div>
                    )}

                    {/* Customer Info */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e6e6e6" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                        Customer
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {order.customer_name && <div style={{ fontWeight: 600 }}>{order.customer_name}</div>}
                        <div style={{ color: "#666" }}>{order.customer_email}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`mailto:${order.customer_email}?subject=Order%20%23${order.id.substring(0, 8)}`, "_blank");
                        }}
                        style={{
                          padding: "8px 16px",
                          border: "1px solid #e6e6e6",
                          background: "#fff",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Email Customer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
