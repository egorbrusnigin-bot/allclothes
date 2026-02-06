import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvsaxxnlnzpswtyjpgkr.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sortBy") || "total_sales";
    const limit = parseInt(searchParams.get("limit") || "10");

    const validSortFields = ["total_sales", "total_orders", "page_views", "total_favorites", "balance"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "total_sales";

    const { data: brands, error } = await supabase
      .from("brands")
      .select("id, name, slug, logo_url, country, total_sales, total_orders, page_views, total_favorites, balance")
      .order(sortField, { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Rankings error:", error);
      return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
    }

    return NextResponse.json({
      rankings: brands?.map((brand, index) => ({
        ...brand,
        rank: index + 1,
      })) || [],
    });
  } catch (error) {
    console.error("Rankings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
