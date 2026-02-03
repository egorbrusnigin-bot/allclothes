"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ── types ─────────────────────────────────────────
type Status =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

interface OrderItem {
  id: string;
  product_name: string;
  brand_name: string;
  price: number;
  currency: string;
  size: string;
  quantity: number;
  image_url: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: Status;
  total: number;
  currency: string;
  created_at: string;
  order_items: OrderItem[];
}

// ── page ────────────────────────────────────────────
export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/?login=1");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          total,
          currency,
          created_at,
          order_items(id, product_name, brand_name, price, currency, size, quantity, image_url)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading orders:", error);
      } else {
        setOrders(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoaded(true);
    }
  }

  if (!loaded) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p
          style={{
            fontSize: 11,
            color: "#999",
            letterSpacing: 1,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* title row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          MY ORDERS
        </h1>
        <span style={{ fontSize: 10, color: "#999", letterSpacing: 0.3 }}>
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </div>

      {/* empty state */}
      {orders.length === 0 && (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            border: "1px solid #e6e6e6",
            color: "#ccc",
          }}
        >
          <p
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              margin: 0,
            }}
          >
            NO ORDERS YET
          </p>
        </div>
      )}

      {/* cards */}
      <div style={{ display: "grid", gap: 12 }}>
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </div>
  );
}

// ── order card ──────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const [reviewHover, setReviewHover] = useState(false);

  const firstItem = order.order_items?.[0];
  const imageUrl = firstItem?.image_url;
  const totalQty = (order.order_items || []).reduce(
    (sum, it) => sum + it.quantity,
    0
  );

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: 22 }}>
      {/* header: number + badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>
          #{order.order_number}
        </span>
        <span style={badgeStyle(order.status)}>
          {capitalize(order.status)}
        </span>
      </div>

      {/* date */}
      <p
        style={{
          fontSize: 10,
          color: "#999",
          margin: "0 0 18px",
          letterSpacing: 0.2,
        }}
      >
        {formatDate(order.created_at)}
      </p>

      {/* thin divider */}
      <div style={{ height: 1, background: "#ebebeb", marginBottom: 18 }} />

      {/* body: stats grid + image */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        {/* 3 stat columns */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          <Stat label="STATUS" value={capitalize(order.status)} />
          <Stat
            label="TOTAL"
            value={`${order.currency} ${order.total.toFixed(2)}`}
          />
          <Stat
            label="ITEMS"
            value={`${totalQty} ${totalQty === 1 ? "item" : "items"}`}
          />
        </div>

        {/* product image */}
        <div
          style={{
            width: 80,
            height: 104,
            flexShrink: 0,
            background: "#f0f0f0",
            overflow: "hidden",
          }}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Product"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
      </div>

      {/* review button */}
      <button
        onMouseEnter={() => setReviewHover(true)}
        onMouseLeave={() => setReviewHover(false)}
        style={{
          all: "unset",
          display: "block",
          marginTop: 20,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          cursor: "pointer",
          padding: "6px 14px",
          border: `1px solid ${reviewHover ? "#000" : "#bbb"}`,
          color: reviewHover ? "#000" : "#666",
          transition: "all 0.2s ease",
        }}
      >
        Leave a review
      </button>
    </div>
  );
}

// ── stat column ─────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#999",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>
        {value}
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── badge style by status ───────────────────────────
function badgeStyle(status: Status): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: "3px 9px",
  };

  switch (status) {
    case "cancelled":
    case "refunded":
    case "delivered":
      return { ...base, background: "#1a1a1a", color: "#fff" };
    case "shipped":
    case "processing":
      return { ...base, border: "1px solid #1a1a1a", color: "#1a1a1a" };
    case "pending":
      return { ...base, border: "1px solid #999", color: "#999" };
  }
}
