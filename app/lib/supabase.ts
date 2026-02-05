import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mvsaxxnlnzpswtyjpgkr.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_z5ctL1Ik9-J3JJL2zfIC0Q_Vgr_jQOc";

export const supabase: SupabaseClient = createClient(url, key);
