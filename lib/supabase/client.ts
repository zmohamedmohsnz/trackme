import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/env";

export function createClient(detectSessionInUrl = true) {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey, {
    auth: { detectSessionInUrl },
  });
}
