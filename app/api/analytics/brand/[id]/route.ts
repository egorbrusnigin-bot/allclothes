import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvsaxxnlnzpswtyjpgkr.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: brandId } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get brand with analytics
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id, name, balance, total_sales, total_orders, page_views, product_views, total_favorites")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Get ranking by sales
    const { data: allBrands } = await supabase
      .from("brands")
      .select("id, total_sales")
      .order("total_sales", { ascending: false });

    let salesRank = 1;
    if (allBrands) {
      const index = allBrands.findIndex((b) => b.id === brandId);
      if (index !== -1) salesRank = index + 1;
    }

    // Get last 30 days stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: dailyStats } = await supabase
      .from("brand_daily_stats")
      .select("*")
      .eq("brand_id", brandId)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // Calculate trends
    const last7Days = dailyStats?.slice(-7) || [];
    const previous7Days = dailyStats?.slice(-14, -7) || [];

    const last7Views = last7Days.reduce((sum, d) => sum + (d.page_views || 0), 0);
    const prev7Views = previous7Days.reduce((sum, d) => sum + (d.page_views || 0), 0);
    const viewsTrend = prev7Views > 0 ? ((last7Views - prev7Views) / prev7Views) * 100 : 0;

    const last7Sales = last7Days.reduce((sum, d) => sum + (d.sales || 0), 0);
    const prev7Sales = previous7Days.reduce((sum, d) => sum + (d.sales || 0), 0);
    const salesTrend = prev7Sales > 0 ? ((last7Sales - prev7Sales) / prev7Sales) * 100 : 0;

    return NextResponse.json({
      brand: {
        ...brand,
        salesRank,
        totalBrands: allBrands?.length || 0,
      },
      dailyStats: dailyStats || [],
      trends: {
        views: {
          last7Days: last7Views,
          trend: Math.round(viewsTrend),
        },
        sales: {
          last7Days: last7Sales,
          trend: Math.round(salesTrend),
        },
      },
    });
  } catch (error) {
    console.error("Brand analytics error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
