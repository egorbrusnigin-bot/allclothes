"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase";
import { isAdmin } from "../../../lib/auth";

interface BrandStats {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  balance: number;
  total_sales: number;
  total_orders: number;
  page_views: number;
  product_views: number;
  total_favorites: number;
  products_count: number;
  seller_email?: string;
  seller_status?: string;
}

interface PlatformStats {
  totalBrands: number;
  totalProducts: number;
  totalSellers: number;
  totalSales: number;
  totalOrders: number;
  totalPageViews: number;
  totalProductViews: number;
  totalFavorites: number;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<BrandStats[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [sortBy, setSortBy] = useState<string>("total_sales");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    if (!supabase) {
      router.push("/");
      return;
    }

    const adminCheck = await isAdmin();
    if (!adminCheck) {
      router.push("/account");
      return;
    }

    await loadAnalytics();
    setLoading(false);
  }

  async function loadAnalytics() {
    if (!supabase) return;

    // Load all brands with stats
    const { data: brandsData, error: brandsError } = await supabase
      .from("brands")
      .select("id, name, slug, owner_id, created_at, balance, total_sales, total_orders, page_views, product_views, total_favorites");

    if (brandsError) {
      console.error("Failed to load brands:", brandsError);
      // Try basic query
      const { data: basicBrands } = await supabase
        .from("brands")
        .select("id, name, slug, owner_id, created_at");

      if (basicBrands) {
        const mappedBrands = basicBrands.map(b => ({
          ...b,
          balance: 0,
          total_sales: 0,
          total_orders: 0,
          page_views: 0,
          product_views: 0,
          total_favorites: 0,
          products_count: 0,
        }));
        setBrands(mappedBrands);
      }
    } else if (brandsData) {
      // Get product counts for each brand
      const { data: productsData } = await supabase
        .from("products")
        .select("brand_id");

      const productCounts: Record<string, number> = {};
      productsData?.forEach(p => {
        if (p.brand_id) {
          productCounts[p.brand_id] = (productCounts[p.brand_id] || 0) + 1;
        }
      });

      // Get seller info
      const { data: sellersData } = await supabase
        .from("sellers")
        .select("user_id, email, status");

      const sellerMap: Record<string, { email: string; status: string }> = {};
      sellersData?.forEach(s => {
        sellerMap[s.user_id] = { email: s.email || "", status: s.status };
      });

      const mappedBrands = brandsData.map(b => ({
        ...b,
        balance: b.balance || 0,
        total_sales: b.total_sales || 0,
        total_orders: b.total_orders || 0,
        page_views: b.page_views || 0,
        product_views: b.product_views || 0,
        total_favorites: b.total_favorites || 0,
        products_count: productCounts[b.id] || 0,
        seller_email: sellerMap[b.owner_id]?.email,
        seller_status: sellerMap[b.owner_id]?.status,
      }));

      setBrands(mappedBrands);

      // Calculate platform stats
      const stats: PlatformStats = {
        totalBrands: mappedBrands.length,
        totalProducts: Object.values(productCounts).reduce((a, b) => a + b, 0),
        totalSellers: sellersData?.length || 0,
        totalSales: mappedBrands.reduce((sum, b) => sum + b.total_sales, 0),
        totalOrders: mappedBrands.reduce((sum, b) => sum + b.total_orders, 0),
        totalPageViews: mappedBrands.reduce((sum, b) => sum + b.page_views, 0),
        totalProductViews: mappedBrands.reduce((sum, b) => sum + b.product_views, 0),
        totalFavorites: mappedBrands.reduce((sum, b) => sum + b.total_favorites, 0),
      };
      setPlatformStats(stats);
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }

  const filteredBrands = brands
    .filter(b =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.seller_email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy as keyof BrandStats] ?? 0;
      const bVal = b[sortBy as keyof BrandStats] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 400 }}>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 32 }}>
      {/* Header */}
      <div>
        <Link
          href="/account/moderation"
          style={{ fontSize: 11, color: "#666", textDecoration: "none", display: "inline-block", marginBottom: 16 }}
        >
          ← Back to Moderation
        </Link>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
          ADMIN
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
          Platform Analytics
        </h1>
      </div>

      {/* Platform Overview */}
      {platformStats && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            PLATFORM OVERVIEW
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <div style={{ background: "#000", color: "#fff", padding: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>
                {platformStats.totalBrands}
              </div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, marginTop: 4 }}>
                Brands
              </div>
            </div>
            <div style={{ background: "#000", color: "#fff", padding: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>
                {platformStats.totalProducts}
              </div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, marginTop: 4 }}>
                Products
              </div>
            </div>
            <div style={{ background: "#000", color: "#fff", padding: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>
                {platformStats.totalSellers}
              </div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, marginTop: 4 }}>
                Sellers
              </div>
            </div>
            <div style={{ background: "#000", color: "#fff", padding: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>
                {platformStats.totalOrders}
              </div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, marginTop: 4 }}>
                Orders
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, marginTop: 2 }}>
            <div style={{ background: "#f5f5f5", padding: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                €{(platformStats.totalSales / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
                Total Sales
              </div>
            </div>
            <div style={{ background: "#f5f5f5", padding: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {platformStats.totalPageViews.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
                Page Views
              </div>
            </div>
            <div style={{ background: "#f5f5f5", padding: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {platformStats.totalProductViews.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
                Product Views
              </div>
            </div>
            <div style={{ background: "#f5f5f5", padding: 20 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {platformStats.totalFavorites.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
                Favorites
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brands Table */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            ALL BRANDS ({filteredBrands.length})
          </div>
          <input
            type="text"
            placeholder="Search brands or emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e6e6e6",
              fontSize: 12,
              width: 250,
              outline: "none",
            }}
          />
        </div>

        <div style={{ border: "1px solid #e6e6e6", overflow: "hidden" }}>
          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
              background: "#fafafa",
              borderBottom: "1px solid #e6e6e6",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            <div
              style={{ padding: "12px 16px", cursor: "pointer" }}
              onClick={() => handleSort("name")}
            >
              Brand {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("products_count")}
            >
              Products {sortBy === "products_count" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("total_sales")}
            >
              Sales {sortBy === "total_sales" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("total_orders")}
            >
              Orders {sortBy === "total_orders" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("page_views")}
            >
              Page Views {sortBy === "page_views" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("product_views")}
            >
              Prod Views {sortBy === "product_views" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("total_favorites")}
            >
              Favorites {sortBy === "total_favorites" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
            <div
              style={{ padding: "12px 16px", cursor: "pointer", textAlign: "right" }}
              onClick={() => handleSort("balance")}
            >
              Balance {sortBy === "balance" && (sortOrder === "asc" ? "↑" : "↓")}
            </div>
          </div>

          {/* Table Rows */}
          {filteredBrands.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>
              No brands found
            </div>
          ) : (
            filteredBrands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand/${brand.slug}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                  borderBottom: "1px solid #e6e6e6",
                  textDecoration: "none",
                  color: "#000",
                  fontSize: 12,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600 }}>{brand.name}</div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {brand.seller_email || "No email"}
                    {brand.seller_status && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          background: brand.seller_status === "approved" ? "#dcfce7" : "#fef3c7",
                          color: brand.seller_status === "approved" ? "#166534" : "#92400e",
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {brand.seller_status}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right" }}>
                  {brand.products_count}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600 }}>
                  €{(brand.total_sales / 100).toFixed(2)}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right" }}>
                  {brand.total_orders}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right" }}>
                  {brand.page_views.toLocaleString()}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right" }}>
                  {brand.product_views.toLocaleString()}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right" }}>
                  {brand.total_favorites}
                </div>
                <div style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600 }}>
                  €{(brand.balance / 100).toFixed(2)}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Export */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => {
            // Prepare data for Excel
            const headers = ["Brand", "Email", "Status", "Products", "Sales (€)", "Orders", "Page Views", "Product Views", "Favorites", "Balance (€)", "Created At"];
            const data = filteredBrands.map(b => [
              b.name,
              b.seller_email || "",
              b.seller_status || "",
              b.products_count,
              Number((b.total_sales / 100).toFixed(2)),
              b.total_orders,
              b.page_views,
              b.product_views,
              b.total_favorites,
              Number((b.balance / 100).toFixed(2)),
              new Date(b.created_at).toLocaleDateString(),
            ]);

            // Create workbook with multiple sheets
            const wb = XLSX.utils.book_new();

            // Summary sheet
            const summaryData = [
              ["Platform Analytics Report"],
              ["Generated:", new Date().toLocaleString()],
              [""],
              ["PLATFORM OVERVIEW"],
              ["Total Brands", platformStats?.totalBrands || 0],
              ["Total Products", platformStats?.totalProducts || 0],
              ["Total Sellers", platformStats?.totalSellers || 0],
              ["Total Orders", platformStats?.totalOrders || 0],
              ["Total Sales (€)", platformStats ? Number((platformStats.totalSales / 100).toFixed(2)) : 0],
              ["Total Page Views", platformStats?.totalPageViews || 0],
              ["Total Product Views", platformStats?.totalProductViews || 0],
              ["Total Favorites", platformStats?.totalFavorites || 0],
            ];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            summarySheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

            // Brands sheet
            const brandsSheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
            brandsSheet["!cols"] = [
              { wch: 25 }, // Brand
              { wch: 30 }, // Email
              { wch: 12 }, // Status
              { wch: 10 }, // Products
              { wch: 12 }, // Sales
              { wch: 10 }, // Orders
              { wch: 12 }, // Page Views
              { wch: 12 }, // Product Views
              { wch: 10 }, // Favorites
              { wch: 12 }, // Balance
              { wch: 12 }, // Created
            ];
            XLSX.utils.book_append_sheet(wb, brandsSheet, "Brands");

            // Top sellers sheet (sorted by sales)
            const topSellers = [...filteredBrands]
              .sort((a, b) => b.total_sales - a.total_sales)
              .slice(0, 20)
              .map((b, i) => [
                i + 1,
                b.name,
                b.seller_email || "",
                Number((b.total_sales / 100).toFixed(2)),
                b.total_orders,
                b.products_count,
              ]);
            const topSellersSheet = XLSX.utils.aoa_to_sheet([
              ["Rank", "Brand", "Email", "Sales (€)", "Orders", "Products"],
              ...topSellers
            ]);
            topSellersSheet["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, topSellersSheet, "Top Sellers");

            // Most viewed sheet
            const mostViewed = [...filteredBrands]
              .sort((a, b) => (b.page_views + b.product_views) - (a.page_views + a.product_views))
              .slice(0, 20)
              .map((b, i) => [
                i + 1,
                b.name,
                b.page_views,
                b.product_views,
                b.page_views + b.product_views,
                b.total_favorites,
              ]);
            const mostViewedSheet = XLSX.utils.aoa_to_sheet([
              ["Rank", "Brand", "Page Views", "Product Views", "Total Views", "Favorites"],
              ...mostViewed
            ]);
            mostViewedSheet["!cols"] = [{ wch: 6 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, mostViewedSheet, "Most Viewed");

            // Download
            XLSX.writeFile(wb, `platform-analytics-${new Date().toISOString().split("T")[0]}.xlsx`);
          }}
          style={{
            padding: "12px 24px",
            background: "#000",
            color: "#fff",
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          Export Excel
        </button>
        <button
          onClick={() => {
            const csv = [
              ["Brand", "Email", "Status", "Products", "Sales", "Orders", "Page Views", "Product Views", "Favorites", "Balance"].join(","),
              ...filteredBrands.map(b => [
                `"${b.name}"`,
                `"${b.seller_email || ""}"`,
                b.seller_status || "",
                b.products_count,
                (b.total_sales / 100).toFixed(2),
                b.total_orders,
                b.page_views,
                b.product_views,
                b.total_favorites,
                (b.balance / 100).toFixed(2),
              ].join(","))
            ].join("\n");

            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `brands-analytics-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
          }}
          style={{
            padding: "12px 24px",
            background: "#fff",
            color: "#000",
            border: "1px solid #e6e6e6",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
