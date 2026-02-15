import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getUser(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

// GET — reviews for a product or brand
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const productId = request.nextUrl.searchParams.get("productId");
    const brandId = request.nextUrl.searchParams.get("brandId");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

    if (!productId && !brandId) {
      return NextResponse.json({ error: "productId or brandId required" }, { status: 400 });
    }

    let query = supabase
      .from("reviews")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (productId) {
      query = query.eq("product_id", productId);
    } else if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    const { data: reviews, error, count } = await query;
    if (error) throw error;

    // Enrich with user info and product info
    const enriched = await Promise.all(
      (reviews || []).map(async (review: any) => {
        // User info
        const { data: { user: reviewer } } = await supabase.auth.admin.getUserById(review.user_id);
        const email = reviewer?.email || "";
        const name = email.split("@")[0] || "User";

        // Product info (for brand-level reviews)
        let productName = "";
        let productImage = "";
        if (brandId) {
          const { data: product } = await supabase
            .from("products")
            .select("name, slug")
            .eq("id", review.product_id)
            .single();
          productName = product?.name || "";

          const { data: img } = await supabase
            .from("product_images")
            .select("image_url")
            .eq("product_id", review.product_id)
            .eq("is_main", true)
            .limit(1)
            .single();
          productImage = img?.image_url || "";
        }

        return {
          ...review,
          userName: name,
          userInitial: name.charAt(0).toUpperCase(),
          productName,
          productImage,
        };
      })
    );

    // Calculate average rating
    let avgRating = 0;
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if ((reviews || []).length > 0) {
      // For full stats, query all ratings (not just current page)
      let statsQuery = supabase.from("reviews").select("rating");
      if (productId) statsQuery = statsQuery.eq("product_id", productId);
      else if (brandId) statsQuery = statsQuery.eq("brand_id", brandId);

      const { data: allRatings } = await statsQuery;
      if (allRatings && allRatings.length > 0) {
        const sum = allRatings.reduce((s: number, r: any) => s + r.rating, 0);
        avgRating = Math.round((sum / allRatings.length) * 10) / 10;
        allRatings.forEach((r: any) => {
          ratingDistribution[r.rating as keyof typeof ratingDistribution]++;
        });
      }
    }

    return NextResponse.json({
      reviews: enriched,
      total: count || 0,
      avgRating,
      ratingDistribution,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

// POST — create a review (verified purchase only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { productId, orderId, rating, text, images } = await request.json();

    if (!productId || !orderId || !rating) {
      return NextResponse.json({ error: "productId, orderId, and rating required" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify purchase: check order_items for this product in user's order
    const { data: orderItem } = await supabase
      .from("order_items")
      .select("id, order_id")
      .eq("product_id", productId)
      .eq("order_id", orderId)
      .single();

    if (!orderItem) {
      return NextResponse.json({ error: "Purchase not verified" }, { status: 403 });
    }

    // Verify this order belongs to the user
    const { data: order } = await supabase
      .from("orders")
      .select("user_id, brand_id")
      .eq("id", orderId)
      .single();

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: "Not your order" }, { status: 403 });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("order_id", orderId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Review already exists for this purchase" }, { status: 409 });
    }

    // Get product's brand_id
    const { data: product } = await supabase
      .from("products")
      .select("brand_id")
      .eq("id", productId)
      .single();

    // Create review
    const { data: review, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        product_id: productId,
        brand_id: product?.brand_id || order.brand_id,
        order_id: orderId,
        rating,
        text: text || "",
        images: images || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ review });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
