"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../lib/useIsMobile";

interface BrandStats {
  id: string;
  name: string;
  slug: string;
  balance: number;
  total_sales: number;
  total_orders: number;
  page_views: number;
  product_views: number;
  total_favorites: number;
}

interface DailyStats {
  date: string;
  page_views: number;
  product_views: number;
  orders: number;
  sales: number;
}

type DateRange = "7d" | "30d" | "90d";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getDaysForRange(range: DateRange): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

function filterByRange(stats: DailyStats[], range: DateRange): DailyStats[] {
  const days = getDaysForRange(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return stats.filter(s => new Date(s.date) >= cutoff);
}

function getPreviousPeriod(stats: DailyStats[], range: DateRange): DailyStats[] {
  const days = getDaysForRange(range);
  const end = new Date();
  end.setDate(end.getDate() - days);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return stats.filter(s => {
    const d = new Date(s.date);
    return d >= start && d < end;
  });
}

function sumField(stats: DailyStats[], field: keyof DailyStats): number {
  return stats.reduce((sum, s) => sum + ((s[field] as number) || 0), 0);
}

function calcChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

// ── Date Range Selector ──────────────────────────────
function DateRangeSelector({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const options: { value: DateRange; label: string }[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
  ];
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid #e6e6e6",
            marginLeft: opt.value === "7d" ? 0 : -1,
            background: value === opt.value ? "#000" : "#fff",
            color: value === opt.value ? "#fff" : "#666",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Line Chart Component ─────────────────────────────
function StripeLineChart({
  data,
  title,
  currentValue,
  comparisonText,
  formatValue,
  isMobile,
}: {
  data: { date: string; value: number }[];
  title: string;
  currentValue: string;
  comparisonText: string;
  formatValue?: (v: number) => string;
  isMobile: boolean;
}) {
  const fmt = formatValue || ((v: number) => String(v));

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 16 : 24, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{currentValue}</div>
        </div>
        <div style={{ fontSize: 11, color: "#666", textAlign: "right", marginTop: 4 }}>
          {comparisonText}
        </div>
      </div>
      <div style={{ width: "100%", height: isMobile ? 150 : 200, marginTop: 16 }}>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: "#999" }}
                axisLine={{ stroke: "#e6e6e6" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#999" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "#000",
                  border: "none",
                  borderRadius: 0,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#999", fontSize: 10, marginBottom: 4 }}
                itemStyle={{ color: "#fff" }}
                labelFormatter={(label) => formatDate(label as string)}
                formatter={(value: number) => [fmt(value), title]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#000"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#000", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#ccc", fontSize: 11 }}>
            No data for this period
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric Card ──────────────────────────────────────
function MetricCard({ label, value, comparison, isMobile }: { label: string; value: string; comparison: string; isMobile: boolean }) {
  return (
    <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 14 : 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: -0.5 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
        {comparison}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
export default function SellerDashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [brandCount, setBrandCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [brands, setBrands] = useState<BrandStats[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPageViews, setTotalPageViews] = useState(0);
  const [totalProductViews, setTotalProductViews] = useState(0);
  const [totalFavorites, setTotalFavorites] = useState(0);
  const [salesRank, setSalesRank] = useState(0);
  const [totalBrandsCount, setTotalBrandsCount] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState(0);
  const [stripePending, setStripePending] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("7d");

  // Computed stats based on date range
  const currentPeriod = useMemo(() => filterByRange(dailyStats, dateRange), [dailyStats, dateRange]);
  const previousPeriod = useMemo(() => getPreviousPeriod(dailyStats, dateRange), [dailyStats, dateRange]);

  const periodSales = useMemo(() => sumField(currentPeriod, "sales"), [currentPeriod]);
  const prevSales = useMemo(() => sumField(previousPeriod, "sales"), [previousPeriod]);
  const periodOrders = useMemo(() => sumField(currentPeriod, "orders"), [currentPeriod]);
  const prevOrders = useMemo(() => sumField(previousPeriod, "orders"), [previousPeriod]);
  const periodPageViews = useMemo(() => sumField(currentPeriod, "page_views"), [currentPeriod]);
  const prevPageViews = useMemo(() => sumField(previousPeriod, "page_views"), [previousPeriod]);
  const periodProductViews = useMemo(() => sumField(currentPeriod, "product_views"), [currentPeriod]);
  const prevProductViews = useMemo(() => sumField(previousPeriod, "product_views"), [previousPeriod]);

  // Chart data
  const viewsChartData = useMemo(() =>
    currentPeriod.map(s => ({ date: s.date, value: s.page_views + s.product_views })),
    [currentPeriod]
  );
  const ordersChartData = useMemo(() =>
    currentPeriod.map(s => ({ date: s.date, value: s.orders })),
    [currentPeriod]
  );
  const salesChartData = useMemo(() =>
    currentPeriod.map(s => ({ date: s.date, value: Number((s.sales / 100).toFixed(2)) })),
    [currentPeriod]
  );

  // Today stats
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
  const todayStat = dailyStats.find(s => s.date === todayStr);
  const yesterdayStat = dailyStats.find(s => s.date === yesterdayStr);
  const todaySalesVal = (todayStat?.sales || 0) / 100;
  const yesterdaySalesVal = (yesterdayStat?.sales || 0) / 100;

  useEffect(() => {
    checkSellerAndLoad();
  }, []);

  async function checkSellerAndLoad() {
    if (!supabase) {
      router.push("/account/become-seller");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/?login=1");
      return;
    }

    const { data: sellerData, error: sellerError } = await supabase
      .from("sellers")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (sellerError || !sellerData || sellerData.status !== "approved") {
      router.push("/account/become-seller");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    await Promise.all([
      // Fetch Stripe status + balance from API
      session ? fetch("/api/stripe/connect", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setStripeConnected(true);
            setStripePayoutsEnabled(data.payouts_enabled || false);
            if (data.balance) {
              const avail = data.balance.available?.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) || 0;
              const pend = data.balance.pending?.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) || 0;
              setStripeAvailable(avail);
              setStripePending(pend);
            }
          }
        }
      }).catch(() => {}) : Promise.resolve(),
      loadStats(user.id),
      loadRecentOrders(user.id),
      Promise.resolve(
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(20)
      ).then(({ data }) => {
        setNotifications(data || []);
      }).catch(() => {}),
    ]);
    setLoading(false);
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

  async function loadRecentOrders(userId: string) {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/seller/orders", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentOrders((data.orders || []).slice(0, 5));
      }
    } catch { /* ignore */ }
  }

  async function loadStats(userId: string) {
    if (!supabase) return;

    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("id, name, slug, balance, total_sales, total_orders, page_views, product_views, total_favorites")
      .eq("owner_id", userId);

    if (brandsError) {
      const { data: basicBrands } = await supabase
        .from("brands")
        .select("id, name, slug")
        .eq("owner_id", userId);

      if (basicBrands && basicBrands.length > 0) {
        const mappedBrands = basicBrands.map(b => ({
          id: b.id, name: b.name, slug: b.slug,
          balance: 0, total_sales: 0, total_orders: 0, page_views: 0, product_views: 0, total_favorites: 0,
        }));
        setBrands(mappedBrands);
        setBrandCount(mappedBrands.length);
      }
    } else if (brandsData && brandsData.length > 0) {
      const mappedBrands = brandsData.map(b => ({
        id: b.id, name: b.name, slug: b.slug,
        balance: b.balance || 0, total_sales: b.total_sales || 0, total_orders: b.total_orders || 0,
        page_views: b.page_views || 0, product_views: b.product_views || 0, total_favorites: b.total_favorites || 0,
      }));
      setBrands(mappedBrands);
      setBrandCount(mappedBrands.length);
      setTotalBalance(mappedBrands.reduce((sum, b) => sum + b.balance, 0));
      setTotalSales(mappedBrands.reduce((sum, b) => sum + b.total_sales, 0));
      setTotalOrders(mappedBrands.reduce((sum, b) => sum + b.total_orders, 0));
      setTotalPageViews(mappedBrands.reduce((sum, b) => sum + b.page_views, 0));
      setTotalProductViews(mappedBrands.reduce((sum, b) => sum + b.product_views, 0));
      setTotalFavorites(mappedBrands.reduce((sum, b) => sum + b.total_favorites, 0));
    }

    const brandIds = (brandsData || []).map(b => b.id);
    // Fetch 180 days for previous period comparison at 90d range
    const fetchDate = new Date();
    fetchDate.setDate(fetchDate.getDate() - 180);

    const [totalCountRes, productsCountRes, pendingRes, approvedRes, statsRes] = await Promise.all([
      supabase.from("brands").select("id", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "pending"),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "approved"),
      brandIds.length > 0
        ? supabase.from("brand_daily_stats").select("date, page_views, product_views, orders, sales").in("brand_id", brandIds).gte("date", fetchDate.toISOString().split("T")[0]).order("date", { ascending: true })
        : Promise.resolve({ data: null, error: null }),
    ]);

    setTotalBrandsCount(totalCountRes.count || 0);
    setSalesRank(1);
    setProductCount(productsCountRes.count || 0);
    setPendingCount(pendingRes.count || 0);
    setApprovedCount(approvedRes.count || 0);

    if (!statsRes.error && statsRes.data) {
      const byDate: Record<string, DailyStats> = {};
      statsRes.data.forEach((s: any) => {
        if (!byDate[s.date]) {
          byDate[s.date] = { date: s.date, page_views: 0, product_views: 0, orders: 0, sales: 0 };
        }
        byDate[s.date].page_views += s.page_views || 0;
        byDate[s.date].product_views += s.product_views || 0;
        byDate[s.date].orders += s.orders || 0;
        byDate[s.date].sales += s.sales || 0;
      });
      setDailyStats(Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)));
    }
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 400 }}>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 28 }}>
        <div>
          <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            SELLER DASHBOARD
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            My Shop
          </h1>
        </div>
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
                  <button onClick={markAllRead} style={{
                    background: "none", border: "none", fontSize: 10, color: "#666", cursor: "pointer", textDecoration: "underline",
                  }}>
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
                    <div key={n.id} onClick={() => markNotificationRead(n.id)} style={{
                      padding: "12px 16px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "background 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{n.message}</div>
                      <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stripe Connect Banners ──────────────────────── */}
      {!stripeConnected && (
        <Link href="/account/seller/stripe" style={{ marginTop: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", background: "#fef2f2", border: "2px solid #fca5a5",
          textDecoration: "none", color: "#991b1b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Connect Stripe to start selling</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Customers cannot buy your products until you connect Stripe</div>
            </div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>→</span>
        </Link>
      )}
      {stripeConnected && !stripePayoutsEnabled && (
        <Link href="/account/seller/stripe" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: "#fef3c7", border: "1px solid #fcd34d",
          textDecoration: "none", color: "#92400e",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Stripe payouts pending</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Complete verification to enable payouts</div>
            </div>
          </div>
          <span style={{ fontSize: 14 }}>→</span>
        </Link>
      )}

      {/* ── Today ───────────────────────────────────────── */}
      <div style={{ background: "#000", color: "#fff", padding: isMobile ? 24 : 36, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
              Today
            </div>
            <div style={{ fontSize: isMobile ? 36 : 48, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 }}>
              €{todaySalesVal.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>Gross volume</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
              Yesterday
            </div>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              €{yesterdaySalesVal.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Balance ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 0, marginTop: 24 }}>
        <Link href="/account/seller/stripe" style={{
          border: "1px solid #e6e6e6", borderRight: isMobile ? "1px solid #e6e6e6" : "none",
          padding: isMobile ? 18 : 28, textDecoration: "none", color: "#000",
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>
            Total Earnings
          </div>
          <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -0.5 }}>
            €{((totalBalance / 100) + stripeAvailable + stripePending).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 10 }}>All time →</div>
        </Link>
        <Link href="/account/seller/stripe" style={{
          border: "1px solid #e6e6e6", borderRight: isMobile ? "1px solid #e6e6e6" : "none",
          borderTop: isMobile ? "none" : "1px solid #e6e6e6",
          padding: isMobile ? 18 : 28, textDecoration: "none", color: "#000",
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>
            Stripe Available
          </div>
          <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -0.5 }}>
            €{stripeAvailable.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 10 }}>
            {stripePending > 0 ? `€${stripePending.toFixed(2)} pending` : "View details →"}
          </div>
        </Link>
        <Link href="/account/seller/stripe" style={{
          border: "1px solid #e6e6e6",
          borderTop: isMobile ? "none" : "1px solid #e6e6e6",
          padding: isMobile ? 18 : 28, textDecoration: "none", color: "#000",
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>
            Pre-Stripe Balance
          </div>
          <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -0.5 }}>
            €{(totalBalance / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 10 }}>
            {stripeConnected && stripePayoutsEnabled ? "Payouts enabled" : "View settings →"}
          </div>
        </Link>
      </div>

      {/* ── Your Overview ───────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>
            Your overview
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 8 : 12 }}>
          <MetricCard
            label="Gross Volume"
            value={`€${(periodSales / 100).toFixed(2)}`}
            comparison={`${calcChange(periodSales, prevSales)} previous period`}
            isMobile={isMobile}
          />
          <MetricCard
            label="Orders"
            value={String(periodOrders)}
            comparison={`${calcChange(periodOrders, prevOrders)} previous period`}
            isMobile={isMobile}
          />
          <MetricCard
            label="Page Views"
            value={String(periodPageViews)}
            comparison={`${calcChange(periodPageViews, prevPageViews)} previous period`}
            isMobile={isMobile}
          />
          <MetricCard
            label="Product Views"
            value={String(periodProductViews)}
            comparison={`${calcChange(periodProductViews, prevProductViews)} previous period`}
            isMobile={isMobile}
          />
          <MetricCard
            label="Favorites"
            value={String(totalFavorites)}
            comparison={`${totalOrders} total orders`}
            isMobile={isMobile}
          />
          <MetricCard
            label="Rank"
            value={`#${salesRank || "-"}`}
            comparison={`of ${totalBrandsCount} brands`}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* ── Line Charts ─────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginBottom: 20 }}>
          Analytics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 8 : 12 }}>
          <StripeLineChart
            data={viewsChartData}
            title="Views"
            currentValue={String(periodPageViews + periodProductViews)}
            comparisonText={`${calcChange(periodPageViews + periodProductViews, prevPageViews + prevProductViews)} prev`}
            isMobile={isMobile}
          />
          <StripeLineChart
            data={ordersChartData}
            title="Orders"
            currentValue={String(periodOrders)}
            comparisonText={`${calcChange(periodOrders, prevOrders)} prev`}
            isMobile={isMobile}
          />
        </div>
        <div style={{ marginTop: isMobile ? 8 : 12 }}>
          <StripeLineChart
            data={salesChartData}
            title="Sales"
            currentValue={`€${(periodSales / 100).toFixed(2)}`}
            comparisonText={`${calcChange(periodSales, prevSales)} prev`}
            formatValue={(v) => `€${v}`}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* ── Export ───────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={() => {
            const wb = XLSX.utils.book_new();
            const summaryData = [
              ["Seller Analytics Report"],
              ["Generated:", new Date().toLocaleString()],
              [""],
              ["OVERVIEW"],
              ["Total Sales", `€${(totalSales / 100).toFixed(2)}`],
              ["Available Balance", `€${(totalBalance / 100).toFixed(2)}`],
              ["Total Orders", totalOrders],
              ["Sales Rank", `#${salesRank} of ${totalBrandsCount}`],
              [""],
              ["ENGAGEMENT"],
              ["Page Views", totalPageViews],
              ["Product Views", totalProductViews],
              ["Favorites", totalFavorites],
              [""],
              ["PRODUCTS"],
              ["Total Brands", brandCount],
              ["Total Products", productCount],
              ["Approved", approvedCount],
              ["Pending", pendingCount],
            ];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            summarySheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
            if (brands.length > 0) {
              const bData = [
                ["Brand", "Sales (€)", "Orders", "Page Views", "Product Views", "Favorites", "Balance (€)"],
                ...brands.map(b => [b.name, Number((b.total_sales / 100).toFixed(2)), b.total_orders, b.page_views, b.product_views, b.total_favorites, Number((b.balance / 100).toFixed(2))])
              ];
              const bSheet = XLSX.utils.aoa_to_sheet(bData);
              bSheet["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
              XLSX.utils.book_append_sheet(wb, bSheet, "Brands");
            }
            if (dailyStats.length > 0) {
              const dData = [
                ["Date", "Page Views", "Product Views", "Total Views", "Orders", "Sales (€)"],
                ...dailyStats.map(d => [d.date, d.page_views, d.product_views, d.page_views + d.product_views, d.orders, Number((d.sales / 100).toFixed(2))])
              ];
              const dSheet = XLSX.utils.aoa_to_sheet(dData);
              dSheet["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
              XLSX.utils.book_append_sheet(wb, dSheet, "Daily Stats");
            }
            const brandName = brands[0]?.name?.replace(/[^a-zA-Z0-9]/g, "-") || "seller";
            XLSX.writeFile(wb, `${brandName}-analytics-${new Date().toISOString().split("T")[0]}.xlsx`);
          }}
          style={{
            padding: "10px 20px", background: "#fff", color: "#000", border: "1px solid #e6e6e6",
            fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* ── Product Stats ───────────────────────────────── */}
      <div style={{ borderTop: "1px solid #e6e6e6", marginTop: 24, paddingTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginBottom: 20 }}>
          Products
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 8 : 12 }}>
        <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 14 : 20, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800 }}>{brandCount}</div>
          <div style={{ fontSize: isMobile ? 8 : 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Brands</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 14 : 20, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800 }}>{productCount}</div>
          <div style={{ fontSize: isMobile ? 8 : 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Products</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 14 : 20, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={{ fontSize: isMobile ? 8 : 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Pending</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: isMobile ? 14 : 20, textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: "#10b981" }}>{approvedCount}</div>
          <div style={{ fontSize: isMobile ? 8 : 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Approved</div>
        </div>
      </div>

      {/* ── Your Brands ─────────────────────────────────── */}
      {brands.length > 0 && (
        <div style={{ border: "1px solid #e6e6e6", marginTop: 12 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6e6e6" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Your Brands</div>
          </div>
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brand/${brand.slug}`} style={{
              textDecoration: "none", color: "#000", padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid #f0f0f0", transition: "background 0.15s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#fafafa"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{brand.name}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {brand.page_views} views · {brand.total_orders} orders · €{(brand.total_sales / 100).toFixed(2)}
                </div>
              </div>
              <span style={{ fontSize: 16, color: "#999" }}>→</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Recent Orders ───────────────────────────────── */}
      {recentOrders.length > 0 && (
        <div style={{ border: "1px solid #e6e6e6", marginTop: 12 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6e6e6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Recent Orders</div>
            <Link href="/account/seller/orders" style={{ fontSize: 11, color: "#666", textDecoration: "none" }}>View All →</Link>
          </div>
          {recentOrders.map((order: any) => (
            <Link key={order.id} href="/account/seller/orders" style={{
              textDecoration: "none", color: "#000", padding: "12px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid #f0f0f0", transition: "background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace", flexShrink: 0 }}>
                  #{order.id.substring(0, 8)}
                </div>
                <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {order.customer_email}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {order.total_amount != null ? `€${(order.total_amount / 100).toFixed(2)}` : ""}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 6px",
                  background: order.status === "shipped" ? "#d4edda" : order.status === "pending" ? "#fff3cd" : "#e2e3e5",
                  color: order.status === "shipped" ? "#155724" : order.status === "pending" ? "#856404" : "#383d41",
                }}>{order.status}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Quick Actions ───────────────────────────────── */}
      <div style={{ borderTop: "1px solid #e6e6e6", marginTop: 24, paddingTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginBottom: 20 }}>
          Quick Actions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 8 : 2 }}>
          {[
            { href: "/account/seller/brands", label: "Manage Brands" },
            { href: "/account/seller/products", label: "Manage Products" },
            { href: "/account/seller/stripe", label: "Payment Settings", badge: stripeConnected && stripePayoutsEnabled },
            { href: "/account/seller/orders", label: "View Orders" },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              textDecoration: "none", color: "#000", padding: 20, border: "1px solid #e6e6e6",
              textAlign: "center", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
              {a.badge && <span style={{ color: "#22c55e", fontSize: 10 }}>●</span>}
            </Link>
          ))}
          <Link href="/account/seller/products/new" style={{
            textDecoration: "none", color: "#fff", padding: 20, background: "#000", textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>+ New Product</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
