import { supabase } from "./supabase";

/**
 * Check if the current user is an admin
 * Admin is determined by:
 * 1. profile.role = 'admin' in database, OR
 * 2. email is in NEXT_PUBLIC_ADMIN_EMAILS environment variable
 */
export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Check 1: profile.role = 'admin'
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return true;

  // Check 2: ADMIN_EMAILS from env
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim()) ||
    [];
  return adminEmails.includes(user.email || "");
}

/**
 * Check if the current user is a seller
 * (has an approved entry in the sellers table)
 */
export async function isSeller(): Promise<boolean> {
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("sellers")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  // User is a seller if they have a record in sellers table with approved status
  return !error && data !== null && data.status === "approved";
}

/**
 * Get the current user's role
 * Returns 'admin', 'seller', or 'user'
 */
export async function getUserRole(): Promise<"admin" | "seller" | "user"> {
  if (!supabase) return "user";

  const admin = await isAdmin();
  if (admin) return "admin";

  const seller = await isSeller();
  if (seller) return "seller";

  return "user";
}

/**
 * Get the current user's ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Get the current user's seller ID
 * Returns the seller record ID if the user is a seller
 */
export async function getSellerRecord(): Promise<{
  id: string;
  user_id: string;
  brand_name: string;
  status: string;
} | null> {
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("sellers")
    .select("id, user_id, brand_name, status")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data;
}
