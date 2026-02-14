"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";

interface OrderRow {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
}

export default function AccountHome() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [ordersRes, favRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, currency, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("favorites")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const orders = (ordersRes.data || []) as OrderRow[];
      setRecentOrders(orders);

      // For total orders & spent, fetch all orders count
      const { count: allOrdersCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      setTotalOrders(allOrdersCount || 0);

      // Sum total spent from recent + if more exist
      if (orders.length > 0) {
        const { data: allOrders } = await supabase
          .from("orders")
          .select("total_amount")
          .eq("user_id", user.id);
        const spent = (allOrders || []).reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);
        setTotalSpent(spent / 100); // cents to euros
      }

      setFavoritesCount(favRes.count || 0);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }

    setLoading(false);
  }

  if (isMobile) {
    return null;
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 560 }}>
        <div style={{ fontSize: 11, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 0" }}>
      {/* Welcome header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{greeting}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 6, letterSpacing: 0.3 }}>{dateStr}</div>
      </div>

      {/* Overview cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        marginBottom: 32,
      }}>
        <MetricCard label="TOTAL ORDERS" value={String(totalOrders)} />
        <MetricCard label="TOTAL SPENT" value={`€${totalSpent.toFixed(2)}`} />
        <MetricCard label="FAVORITES" value={String(favoritesCount)} />
      </div>

      {/* Recent Orders */}
      <div style={{
        border: "1px solid #e6e6e6",
        background: "#fff",
        marginBottom: 32,
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e6e6e6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Recent Orders</span>
          <Link href="/account/orders" style={{ fontSize: 11, color: "#666", textDecoration: "none", letterSpacing: 0.3 }}>
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#999", letterSpacing: 0.3 }}>No orders yet</div>
            <Link href="/catalog" style={{ fontSize: 11, color: "#000", textDecoration: "underline", marginTop: 8, display: "inline-block" }}>
              Browse catalog
            </Link>
          </div>
        ) : (
          recentOrders.map((order, i) => (
            <div
              key={order.id}
              style={{
                padding: "14px 20px",
                borderBottom: i < recentOrders.length - 1 ? "1px solid #f0f0f0" : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
                  #{order.id.slice(0, 8).toUpperCase()}
                </div>
                <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>
                  {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <StatusBadge status={order.status} />
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.3, minWidth: 70, textAlign: "right" }}>
                  €{(order.total_amount / 100).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Quick Links</div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
        }}>
          <QuickLink href="/account/orders" label="My Orders" description="View order history" />
          <QuickLink href="/account/messages" label="My Messages" description="Check your inbox" />
          <QuickLink href="/account/profile" label="My Details" description="Edit your profile" />
          <QuickLink href="/account/help" label="Need Help?" description="Support & FAQ" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid #e6e6e6",
      background: "#fff",
      padding: "20px",
    }}>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#fff8e1", text: "#f59e0b" },
    confirmed: { bg: "#e8f5e9", text: "#16a34a" },
    shipped: { bg: "#e3f2fd", text: "#2563eb" },
    delivered: { bg: "#f1f1f1", text: "#000" },
    cancelled: { bg: "#fce4ec", text: "#dc2626" },
  };
  const c = colors[status] || { bg: "#f1f1f1", text: "#666" };

  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      padding: "3px 8px",
      background: c.bg,
      color: c.text,
    }}>
      {status}
    </span>
  );
}

function QuickLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} style={{
      textDecoration: "none",
      color: "#000",
      border: "1px solid #e6e6e6",
      padding: "16px 18px",
      display: "block",
      background: "#fff",
      transition: "background 0.15s",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#999", marginTop: 4, letterSpacing: 0.3 }}>{description}</div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 10 }}>→</div>
    </Link>
  );
}
