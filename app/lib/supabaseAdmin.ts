import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    _supabaseAdmin = createClient(url, serviceKey);
  }
  return _supabaseAdmin;
}

// For backwards compatibility
export const supabaseAdmin = {
  from: (table: string) => getSupabaseAdmin().from(table),
};
