import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Client chạy trong trình duyệt. KHÔNG có service-role key hoặc thông tin DB ở đây. */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("YOUR_PROJECT") || key.includes("REPLACE_ME")) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cached;
}

export function requireSupabase(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) throw new Error("Chưa cấu hình Supabase trong frontend/.env.local.");
  return client;
}
