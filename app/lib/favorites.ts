import { supabase } from "./supabase";
import { getCurrentUserId } from "./auth";

/**
 * Check if a specific product is favorited by the current user
 */
export async function isProductFavorited(productId: string): Promise<boolean> {
  if (!supabase) return false;

  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .single();

  return !error && data !== null;
}

/**
 * Add a product to favorites
 */
export async function addToFavorites(productId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase not initialized" };

  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: "User not authenticated" };

  const { error } = await supabase
    .from("user_favorites")
    .insert({ user_id: userId, product_id: productId });

  if (error) {
    // Handle duplicate error gracefully (already favorited)
    if (error.code === "23505") {
      return { success: true }; // Already favorited, treat as success
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove a product from favorites
 */
export async function removeFromFavorites(productId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase not initialized" };

  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: "User not authenticated" };

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(productId: string, currentStatus: boolean): Promise<{ success: boolean; error?: string }> {
  if (currentStatus) {
    return await removeFromFavorites(productId);
  } else {
    return await addToFavorites(productId);
  }
}

/**
 * Get all favorited product IDs for the current user
 */
export async function getFavoritedProductIds(): Promise<string[]> {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_favorites")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(fav => fav.product_id);
}

/**
 * Get all favorite products with full details (for favorites page)
 */
export async function getFavoriteProducts() {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_favorites")
    .select(`
      product_id,
      created_at,
      products (
        id,
        slug,
        name,
        price,
        currency,
        created_at,
        brands(name, slug, logo_url, country),
        product_images(image_url, is_main, display_order)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error loading favorites:", error);
    return [];
  }

  // Transform to match Product interface
  return data
    .filter(fav => fav.products) // Filter out any null products (deleted)
    .map(fav => {
      const product = fav.products as any;
      return {
        ...product,
        brand: Array.isArray(product.brands)
          ? product.brands[0]
          : product.brands
      };
    });
}
