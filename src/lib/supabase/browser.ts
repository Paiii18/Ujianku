import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Dipakai di komponen/halaman (browser). Sesi disimpan di cookie agar terbaca juga oleh server.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
