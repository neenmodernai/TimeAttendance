// src/lib/db.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
/** Server-only Supabase client (service role). RLS blocks every other key. */
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export async function getSettings(sb: SupabaseClient = db()) {
  const { data } = await sb.from("settings").select("key,value");
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    lateFrom: (m.late_from as string) ?? "09:15",
    workDays: (m.work_days as number[]) ?? [1, 2, 3, 4, 5],
    holidays: (m.holidays as string[]) ?? [],
    hrEmail: ((m.hr_email as string) || process.env.HR_EMAIL || "").trim(),
    remindEnabled: (m.remind_enabled as boolean) ?? true,
  };
}
