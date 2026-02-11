"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase";
import { useIsMobile } from "../../../lib/useIsMobile";

const COUNTRIES = [
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" }, { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" }, { code: "NL", name: "Netherlands" }, { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" }, { code: "CH", name: "Switzerland" }, { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" }, { code: "SE", name: "Sweden" }, { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" }, { code: "FI", name: "Finland" }, { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" }, { code: "GR", name: "Greece" }, { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" }, { code: "HR", name: "Croatia" }, { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" }, { code: "BG", name: "Bulgaria" }, { code: "LT", name: "Lithuania" },
  { code: "LV", name: "Latvia" }, { code: "EE", name: "Estonia" }, { code: "LU", name: "Luxembourg" },
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" }, { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" }, { code: "TR", name: "Turkey" }, { code: "JP", name: "Japan" },
  { code: "CN", name: "China" }, { code: "KR", name: "South Korea" }, { code: "IL", name: "Israel" },
];

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  size: string;
  quantity: number;
  price: number;
  image_url?: string;
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
  tracking_number?: string;
  label_url?: string;
  carrier?: string;
  service_level?: string;
}

export default function SellerOrdersPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Shipping label flow
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shippingStep, setShippingStep] = useState<"form" | "rates" | "creating" | "done">("form");
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [shippingError, setShippingError] = useState("");
  const [shippingResult, setShippingResult] = useState<{ trackingNumber: string; labelUrl: string; carrier: string } | null>(null);
  const [senderAddress, setSenderAddress] = useState({
    name: "", street1: "", city: "", zip: "", country: "DE",
  });
  const [parcelSize, setParcelSize] = useState({
    length: "30", width: "20", height: "10", weight: "0.5",
  });
  const [shippingModalVisible, setShippingModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  useEffect(() => {
    checkSellerAndLoadOrders();
    loadNotifications();
  }, []);

  async function loadNotifications() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }

  async function markNotificationRead(id: string) {
    if (!supabase) return;
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function markAllRead() {
    if (!supabase) return;
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setNotifications([]);
  }

  async function checkSellerAndLoadOrders() {
    if (!supabase) {
      router.push("/account/become-seller");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/?login=1");
      return;
    }

    try {
      const res = await fetch("/api/seller/orders", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 401) {
        router.push("/?login=1");
        return;
      }
      if (res.status === 403) {
        router.push("/account/become-seller");
        return;
      }

      const data = await res.json();

      if (data.orders) {
        setOrders(data.orders.map((o: any) => {
          // shipping_address хранится как JSON строка — парсим
          let shipping = o.shipping_address;
          if (typeof shipping === "string") {
            try { shipping = JSON.parse(shipping); } catch { shipping = null; }
          }
          return {
            ...o,
            shipping_address: shipping,
            items: o.order_items || [],
          };
        }));
      }
    } catch (err) {
      console.error("Error loading orders:", err);
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

  async function getShippingRates() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !shippingOrderId) return;

    setShippingError("");
    setShippingStep("rates");
    setShippingRates([]);

    try {
      const res = await fetch("/api/seller/shipping-rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId: shippingOrderId,
          addressFrom: senderAddress,
          parcel: parcelSize,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setShippingError(data.error || "Failed to get rates");
        setShippingStep("form");
        return;
      }

      setShippingRates(data.rates || []);
    } catch {
      setShippingError("Network error");
      setShippingStep("form");
    }
  }

  async function purchaseLabel(rateObjectId: string) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !shippingOrderId) return;

    setShippingStep("creating");
    setShippingError("");

    try {
      const res = await fetch("/api/seller/create-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId: shippingOrderId,
          rateObjectId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setShippingError(data.error || "Failed to create label");
        setShippingStep("rates");
        return;
      }

      setShippingResult(data);
      setShippingStep("done");

      // Обновляем заказ в списке
      setOrders(prev => prev.map(o =>
        o.id === shippingOrderId
          ? { ...o, tracking_number: data.trackingNumber, label_url: data.labelUrl, carrier: data.carrier, status: "shipped" }
          : o
      ));
    } catch {
      setShippingError("Network error");
      setShippingStep("rates");
    }
  }

  function openShippingModal(orderId: string) {
    setShippingOrderId(orderId);
    setShippingStep("form");
    setShippingRates([]);
    setShippingError("");
    setShippingResult(null);
    setCountrySearch("");
    setShowCountryDropdown(false);
    // Trigger animation
    requestAnimationFrame(() => setShippingModalVisible(true));
  }

  function closeShippingModal() {
    setShippingModalVisible(false);
    setTimeout(() => setShippingOrderId(null), 200);
  }

  const filteredCountries = countrySearch.length >= 1
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      ).slice(0, 8)
    : COUNTRIES.slice(0, 8);

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
    <div style={{ padding: isMobile ? "20px 0" : "40px 60px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", marginBottom: isMobile ? 20 : 30, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 20 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Notification Bell */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                background: "none", border: "1px solid #e6e6e6", padding: "8px 10px",
                cursor: "pointer", position: "relative", display: "flex", alignItems: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifications.length > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -4,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#ef4444", color: "#fff",
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {notifications.length > 9 ? "9+" : notifications.length}
                </div>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: 320, background: "#fff", border: "1px solid #e6e6e6",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 100,
              }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid #e6e6e6",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Notifications
                  </span>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{
                        background: "none", border: "none", fontSize: 10,
                        color: "#666", cursor: "pointer", textDecoration: "underline",
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "#999" }}>
                      No new notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        style={{
                          padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
                          cursor: "pointer", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{n.message}</div>
                        <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
      </div>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: isMobile ? 12 : 20,
        marginBottom: isMobile ? 20 : 30,
        paddingBottom: isMobile ? 12 : 20,
        borderBottom: "1px solid #e6e6e6",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        flexWrap: "wrap"
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: isMobile ? "100%" : 300 }}>
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
        <div style={{ display: "flex", gap: 6, overflowX: isMobile ? "auto" : undefined, WebkitOverflowScrolling: "touch" }}>
          {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: isMobile ? "6px 10px" : "8px 16px",
                whiteSpace: "nowrap",
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
                  padding: isMobile ? "12px 14px" : "16px 20px",
                  display: isMobile ? "flex" : "grid",
                  flexDirection: isMobile ? "column" : undefined,
                  gridTemplateColumns: isMobile ? undefined : "100px 1fr 150px 100px 100px 30px",
                  gap: isMobile ? 8 : 20,
                  alignItems: isMobile ? "stretch" : "center",
                  cursor: "pointer",
                  background: "#fff",
                }}
              >
                {/* Top row on mobile: ID + arrow */}
                <div style={isMobile ? { display: "flex", justifyContent: "space-between", alignItems: "center" } : undefined}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>
                      #{order.id.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
                      {formatDate(order.created_at)}
                    </div>
                  </div>
                  {isMobile && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: expandedOrder === order.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)", flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>

                {/* Customer & Products */}
                <div>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {order.customer_email}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {order.items.length > 0
                      ? order.items.map(i => i.product_name).join(", ").substring(0, isMobile ? 40 : 60) + (order.items.map(i => i.product_name).join(", ").length > (isMobile ? 40 : 60) ? "..." : "")
                      : "Products info unavailable"
                    }
                  </div>
                </div>

                {/* Amount + statuses row on mobile */}
                <div style={isMobile ? { display: "flex", gap: 12, alignItems: "center" } : undefined}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    €{(order.total_amount / 100).toFixed(2)}
                  </div>

                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: getPaymentStatusColor(order.payment_status),
                  }}>
                    {order.payment_status}
                  </div>

                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: getStatusColor(order.status),
                  }}>
                    {order.status}
                  </div>
                </div>

                {/* Expand Arrow - desktop only */}
                {!isMobile && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: expandedOrder === order.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>

              {/* Expanded Details */}
              <div style={{
                display: "grid",
                gridTemplateRows: expandedOrder === order.id ? "1fr" : "0fr",
                transition: "grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
              }}>
              <div style={{ overflow: "hidden" }}>
              <div style={{
                  padding: isMobile ? "16px" : "24px 20px",
                  borderTop: "1px solid #e6e6e6",
                  background: "#fff",
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: isMobile ? 20 : 40,
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
                            {item.image_url && (
                              <img
                                src={item.image_url}
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
                              €{Number(item.price).toFixed(2)}
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

                    {/* Tracking Info */}
                    {order.tracking_number && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e6e6e6" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                          Shipping
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          <div>Carrier: <span style={{ fontWeight: 600, color: "#000" }}>{order.carrier}</span></div>
                          <div>Tracking: <span style={{ fontWeight: 600, color: "#000", fontFamily: "monospace" }}>{order.tracking_number}</span></div>
                        </div>
                        {order.label_url && (
                          <a
                            href={order.label_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              marginTop: 8, padding: "6px 14px",
                              background: "#000", color: "#fff", textDecoration: "none",
                              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                            }}
                          >
                            Download Label PDF
                          </a>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!order.tracking_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openShippingModal(order.id);
                          }}
                          style={{
                            padding: "8px 16px",
                            border: "none",
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="3" width="15" height="13" />
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            <circle cx="5.5" cy="18.5" r="2.5" />
                            <circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                          Ship Order
                        </button>
                      )}
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
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Shipping Label Modal */}
      {shippingOrderId && (
        <div
          onClick={closeShippingModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: 20,
            opacity: shippingModalVisible ? 1 : 0,
            transition: "opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", width: "100%", maxWidth: 480,
              maxHeight: "90vh", overflowY: "auto", padding: isMobile ? 20 : 32,
              transform: shippingModalVisible ? "scale(1) translateY(0)" : "scale(0.96) translateY(10px)",
              opacity: shippingModalVisible ? 1 : 0,
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", margin: 0 }}>
                {shippingStep === "done" ? "LABEL CREATED" : "SHIP ORDER"}
              </h3>
              <button onClick={closeShippingModal} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }}>
                x
              </button>
            </div>

            {shippingError && (
              <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", fontSize: 12, marginBottom: 16 }}>
                {shippingError}
              </div>
            )}

            {/* Step 1: Sender address + parcel */}
            {shippingStep === "form" && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, color: "#666" }}>
                  Sender Address (your address)
                </div>
                {[
                  { key: "name", label: "Name", placeholder: "Brand Name" },
                  { key: "street1", label: "Street", placeholder: "123 Main St" },
                  { key: "city", label: "City", placeholder: "Berlin" },
                  { key: "zip", label: "Postal Code", placeholder: "10115" },
                ].map(f => (
                  <input
                    key={f.key}
                    type="text"
                    placeholder={f.placeholder}
                    value={(senderAddress as any)[f.key]}
                    onChange={(e) => setSenderAddress(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{
                      width: "100%", padding: "8px 10px", border: "1px solid #e6e6e6",
                      fontSize: 12, marginBottom: 8, outline: "none", fontFamily: "inherit",
                    }}
                  />
                ))}

                {/* Country autocomplete */}
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Search country..."
                    value={showCountryDropdown ? countrySearch : (
                      COUNTRIES.find(c => c.code === senderAddress.country)
                        ? `${COUNTRIES.find(c => c.code === senderAddress.country)!.name} (${senderAddress.country})`
                        : senderAddress.country
                    )}
                    onFocus={() => {
                      setShowCountryDropdown(true);
                      setCountrySearch("");
                    }}
                    onChange={(e) => {
                      setCountrySearch(e.target.value);
                      setShowCountryDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                    style={{
                      width: "100%", padding: "8px 10px", border: "1px solid #e6e6e6",
                      fontSize: 12, outline: "none", fontFamily: "inherit",
                    }}
                  />
                  {showCountryDropdown && filteredCountries.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0,
                      background: "#fff", border: "1px solid #e6e6e6", borderTop: "none",
                      maxHeight: 200, overflowY: "auto", zIndex: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}>
                      {filteredCountries.map(c => (
                        <div
                          key={c.code}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSenderAddress(prev => ({ ...prev, country: c.code }));
                            setCountrySearch("");
                            setShowCountryDropdown(false);
                          }}
                          style={{
                            padding: "8px 10px", fontSize: 12, cursor: "pointer",
                            background: senderAddress.country === c.code ? "#f5f5f5" : "#fff",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f0f0f0"}
                          onMouseLeave={e => e.currentTarget.style.background = senderAddress.country === c.code ? "#f5f5f5" : "#fff"}
                        >
                          <span style={{ fontWeight: 600 }}>{c.code}</span>
                          <span style={{ color: "#666", marginLeft: 8 }}>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 16, color: "#666" }}>
                  Parcel Size
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { key: "length", label: "Length (cm)" },
                    { key: "width", label: "Width (cm)" },
                    { key: "height", label: "Height (cm)" },
                    { key: "weight", label: "Weight (kg)" },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>{f.label}</div>
                      <input
                        type="text"
                        value={(parcelSize as any)[f.key]}
                        onChange={(e) => setParcelSize(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{
                          width: "100%", padding: "8px 10px", border: "1px solid #e6e6e6",
                          fontSize: 12, outline: "none", fontFamily: "inherit",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={getShippingRates}
                  disabled={!senderAddress.name || !senderAddress.street1 || !senderAddress.city}
                  style={{
                    marginTop: 20, width: "100%", padding: "12px 0",
                    background: (!senderAddress.name || !senderAddress.street1 || !senderAddress.city) ? "#ccc" : "#000",
                    color: "#fff", border: "none", fontSize: 12, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
                  }}
                >
                  Get Shipping Rates
                </button>
              </div>
            )}

            {/* Step 2: Choose rate */}
            {shippingStep === "rates" && (
              <div>
                {shippingRates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#999", fontSize: 12 }}>
                    Loading rates...
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, color: "#666" }}>
                      Choose Carrier ({shippingRates.length} options)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {shippingRates.map((rate, i) => (
                        <button
                          key={i}
                          onClick={() => purchaseLabel(rate.objectId)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "12px 14px", border: "1px solid #e6e6e6", background: "#fff",
                            cursor: "pointer", textAlign: "left",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{rate.carrier}</div>
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                              {rate.service}
                              {rate.days && <span> · {rate.days} days</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {rate.currency} {rate.price}
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShippingStep("form")}
                      style={{
                        marginTop: 12, width: "100%", padding: "10px 0",
                        background: "#fff", border: "1px solid #e6e6e6", fontSize: 11,
                        fontWeight: 600, cursor: "pointer", color: "#666",
                      }}
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Creating */}
            {shippingStep === "creating" && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#999", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                Creating shipping label...
              </div>
            )}

            {/* Step 4: Done */}
            {shippingStep === "done" && shippingResult && (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", border: "2px solid #22c55e",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Label Created</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                  Carrier: {shippingResult.carrier}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginBottom: 20 }}>
                  {shippingResult.trackingNumber}
                </div>
                <a
                  href={shippingResult.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block", padding: "12px 28px",
                    background: "#000", color: "#fff", textDecoration: "none",
                    fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                  }}
                >
                  Download Label PDF
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
