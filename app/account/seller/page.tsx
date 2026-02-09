"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";

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

function ViewsChart({ dailyStats }: { dailyStats: DailyStats[] }) {
  const daysPerPage = 14;
  const pastDays = 49; // 49 days in the past
  const futureDays = 7; // 7 days in the future
  const totalDays = pastDays + futureDays; // 56 total = 4 pages
  const totalPages = totalDays / daysPerPage;

  // Start on last page (most recent, with TODAY near the middle)
  const [page, setPage] = useState(totalPages - 1);

  // Generate all days (oldest first, future last - chronological order)
  const allDays: { date: string; views: number; isFuture: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = pastDays - 1; i >= -futureDays; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const stat = dailyStats.find(s => s.date === dateStr);
    const dayDate = new Date(d);
    dayDate.setHours(0, 0, 0, 0);
    allDays.push({
      date: dateStr,
      views: stat ? stat.page_views + stat.product_views : 0,
      isFuture: dayDate > today,
    });
  }

  // Page 0 = oldest, last page = most recent (with TODAY)
  const startIdx = page * daysPerPage;
  const endIdx = Math.min(startIdx + daysPerPage, allDays.length);
  const visibleDays = allDays.slice(startIdx, endIdx);
  const max = Math.max(...visibleDays.map(d => d.views), 1);

  const formatDateRange = () => {
    if (visibleDays.length === 0) return "";
    const first = new Date(visibleDays[0].date);
    const last = new Date(visibleDays[visibleDays.length - 1].date);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${first.getDate()} ${months[first.getMonth()]} — ${last.getDate()} ${months[last.getMonth()]}`;
  };

  return (
    <div style={{ border: "1px solid #e6e6e6", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          VIEWS
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, color: "#999" }}>{formatDateRange()}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(p - 1, 0))}
              disabled={page <= 0}
              style={{
                width: 28,
                height: 28,
                border: "1px solid #e6e6e6",
                background: page <= 0 ? "#fafafa" : "#fff",
                cursor: page <= 0 ? "not-allowed" : "pointer",
                fontSize: 14,
                color: page <= 0 ? "#ccc" : "#000",
              }}
            >
              ←
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
              disabled={page >= totalPages - 1}
              style={{
                width: 28,
                height: 28,
                border: "1px solid #e6e6e6",
                background: page >= totalPages - 1 ? "#fafafa" : "#fff",
                cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                fontSize: 14,
                color: page >= totalPages - 1 ? "#ccc" : "#000",
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
        {visibleDays.map((day, i) => {
          const height = day.views > 0 ? Math.max((day.views / max) * 100, 10) : 0;
          const date = new Date(day.date);
          const dayNum = date.getDate();
          const todayStr = new Date().toISOString().split("T")[0];
          const isToday = day.date === todayStr;
          const isFuture = day.isFuture;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: isFuture ? 0.4 : 1 }}>
              <div
                style={{
                  height: 100,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  width: "100%",
                  position: "relative"
                }}
              >
                {day.views > 0 && !isFuture && (
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#000", marginBottom: 4 }}>
                    {day.views}
                  </div>
                )}
                <div
                  style={{
                    width: day.views > 0 && !isFuture ? "50%" : "100%",
                    maxWidth: day.views > 0 && !isFuture ? 24 : "none",
                    minWidth: day.views > 0 && !isFuture ? 8 : 0,
                    height: day.views > 0 && !isFuture ? `${height}%` : "1px",
                    background: day.views > 0 && !isFuture ? "#000" : "#eee",
                    borderRadius: day.views > 0 && !isFuture ? "2px 2px 0 0" : 0,
                    transition: "height 0.2s ease"
                  }}
                  title={isFuture ? `${day.date}: upcoming` : `${day.date}: ${day.views} views`}
                />
              </div>
              <div style={{
                fontSize: 9,
                color: isToday ? "#000" : "#999",
                fontWeight: isToday ? 700 : 400,
              }}>
                {isToday ? "TODAY" : dayNum}
              </div>
            </div>
          );
        })}
      </div>

      {/* Page indicator */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 16 }}>
        {Array.from({ length: totalPages }).map((_, i) => (
          <div
            key={i}
            onClick={() => setPage(i)}
            style={{
              width: i === page ? 16 : 6,
              height: 6,
              background: i === page ? "#000" : "#e6e6e6",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const router = useRouter();
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

    await loadStats(user.id);
    setLoading(false);
  }

  async function loadStats(userId: string) {
    if (!supabase) return;

    // Try to get brand data with stats columns
    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("id, name, slug, balance, total_sales, total_orders, page_views, product_views, total_favorites")
      .eq("owner_id", userId);

    // If query failed (columns don't exist), try basic query
    if (brandsError) {
      console.error("Extended query failed, trying basic:", brandsError.message);
      const { data: basicBrands } = await supabase
        .from("brands")
        .select("id, name, slug")
        .eq("owner_id", userId);

      if (basicBrands && basicBrands.length > 0) {
        const mappedBrands = basicBrands.map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          balance: 0,
          total_sales: 0,
          total_orders: 0,
          page_views: 0,
          product_views: 0,
          total_favorites: 0,
        }));
        setBrands(mappedBrands);
        setBrandCount(mappedBrands.length);
      }
    } else if (brandsData && brandsData.length > 0) {
      const mappedBrands = brandsData.map(b => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        balance: b.balance || 0,
        total_sales: b.total_sales || 0,
        total_orders: b.total_orders || 0,
        page_views: b.page_views || 0,
        product_views: b.product_views || 0,
        total_favorites: b.total_favorites || 0,
      }));
      setBrands(mappedBrands);
      setBrandCount(mappedBrands.length);

      // Calculate totals
      setTotalBalance(mappedBrands.reduce((sum, b) => sum + b.balance, 0));
      setTotalSales(mappedBrands.reduce((sum, b) => sum + b.total_sales, 0));
      setTotalOrders(mappedBrands.reduce((sum, b) => sum + b.total_orders, 0));
      setTotalPageViews(mappedBrands.reduce((sum, b) => sum + b.page_views, 0));
      setTotalProductViews(mappedBrands.reduce((sum, b) => sum + b.product_views, 0));
      setTotalFavorites(mappedBrands.reduce((sum, b) => sum + b.total_favorites, 0));
    }

    // Get total brands count for ranking
    const { count: totalCount } = await supabase
      .from("brands")
      .select("id", { count: "exact", head: true });
    setTotalBrandsCount(totalCount || 0);
    setSalesRank(1);

    // Try to load daily stats for chart
    const brandIds = (brandsData || []).map(b => b.id);
    if (brandIds.length > 0) {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: statsData, error: statsError } = await supabase
        .from("brand_daily_stats")
        .select("date, page_views, product_views, orders, sales")
        .in("brand_id", brandIds)
        .gte("date", sixtyDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: true });

      if (!statsError && statsData) {
        // Aggregate by date
        const byDate: Record<string, { date: string; page_views: number; product_views: number; orders: number; sales: number }> = {};
        statsData.forEach(s => {
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

    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId);
    setProductCount(productsCount || 0);

    const { count: pending } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "pending");
    setPendingCount(pending || 0);

    const { count: approved } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "approved");
    setApprovedCount(approved || 0);
  }

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 400 }}>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          SELLER DASHBOARD
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
          My Shop
        </h1>
      </div>

      {/* Main Stats - Highlighted */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <div style={{ background: "#000", color: "#fff", padding: 28 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6, marginBottom: 12 }}>
            BALANCE
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            €{(totalBalance / 100).toFixed(2)}
          </div>
        </div>
        <div style={{ background: "#000", color: "#fff", padding: 28 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.6, marginBottom: 12 }}>
            TOTAL SALES
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            €{(totalSales / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Stripe Connect Banner */}
      {!stripeConnected && (
        <Link
          href="/account/seller/stripe"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            textDecoration: "none",
            color: "#92400e",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Connect Stripe to receive payments</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Set up payouts to start earning</div>
            </div>
          </div>
          <span style={{ fontSize: 14 }}>→</span>
        </Link>
      )}

      {stripeConnected && !stripePayoutsEnabled && (
        <Link
          href="/account/seller/stripe"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            textDecoration: "none",
            color: "#92400e",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Stripe payouts pending</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Complete verification to enable payouts</div>
            </div>
          </div>
          <span style={{ fontSize: 14 }}>→</span>
        </Link>
      )}

      {/* Secondary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
        <div style={{ background: "#f5f5f5", padding: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>#{salesRank || "-"}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
            Rank / {totalBrandsCount}
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalOrders}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
            Orders
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalPageViews}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
            Page Views
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalProductViews}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
            Product Views
          </div>
        </div>
        <div style={{ background: "#f5f5f5", padding: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalFavorites}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
            Favorites
          </div>
        </div>
      </div>

      {/* Views Chart */}
      <ViewsChart dailyStats={dailyStats} />

      {/* Export Button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            const wb = XLSX.utils.book_new();

            // Summary sheet
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

            // Brands sheet
            if (brands.length > 0) {
              const brandsData = [
                ["Brand", "Sales (€)", "Orders", "Page Views", "Product Views", "Favorites", "Balance (€)"],
                ...brands.map(b => [
                  b.name,
                  Number((b.total_sales / 100).toFixed(2)),
                  b.total_orders,
                  b.page_views,
                  b.product_views,
                  b.total_favorites,
                  Number((b.balance / 100).toFixed(2)),
                ])
              ];
              const brandsSheet = XLSX.utils.aoa_to_sheet(brandsData);
              brandsSheet["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
              XLSX.utils.book_append_sheet(wb, brandsSheet, "Brands");
            }

            // Daily stats sheet
            if (dailyStats.length > 0) {
              const dailyData = [
                ["Date", "Page Views", "Product Views", "Total Views", "Orders", "Sales (€)"],
                ...dailyStats.map(d => [
                  d.date,
                  d.page_views,
                  d.product_views,
                  d.page_views + d.product_views,
                  d.orders,
                  Number((d.sales / 100).toFixed(2)),
                ])
              ];
              const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
              dailySheet["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
              XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Stats");
            }

            // Download
            const brandName = brands[0]?.name?.replace(/[^a-zA-Z0-9]/g, "-") || "seller";
            XLSX.writeFile(wb, `${brandName}-analytics-${new Date().toISOString().split("T")[0]}.xlsx`);
          }}
          style={{
            padding: "10px 20px",
            background: "#fff",
            color: "#000",
            border: "1px solid #e6e6e6",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s",
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

      {/* Product Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <div style={{ border: "1px solid #e6e6e6", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{brandCount}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Brands</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{productCount}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Products</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Pending</div>
        </div>
        <div style={{ border: "1px solid #e6e6e6", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>{approvedCount}</div>
          <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>Approved</div>
        </div>
      </div>

      {/* Brands List */}
      {brands.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            YOUR BRANDS
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand/${brand.slug}`}
                style={{
                  textDecoration: "none",
                  color: "#000",
                  padding: "16px 20px",
                  background: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f0f0f0"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#fafafa"}
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
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          ACTIONS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          <Link
            href="/account/seller/brands"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              border: "1px solid #e6e6e6",
              textAlign: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Manage Brands</div>
          </Link>
          <Link
            href="/account/seller/products"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              border: "1px solid #e6e6e6",
              textAlign: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Manage Products</div>
          </Link>
          <Link
            href="/account/seller/stripe"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              border: "1px solid #e6e6e6",
              textAlign: "center",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Payment Settings</div>
            {stripeConnected && stripePayoutsEnabled && (
              <span style={{ color: "#22c55e", fontSize: 10 }}>●</span>
            )}
          </Link>
          <Link
            href="/account/seller/orders"
            style={{
              textDecoration: "none",
              color: "#000",
              padding: 20,
              border: "1px solid #e6e6e6",
              textAlign: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>View Orders</div>
          </Link>
          <Link
            href="/account/seller/products/new"
            style={{
              textDecoration: "none",
              color: "#fff",
              padding: 20,
              background: "#000",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>+ New Product</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
