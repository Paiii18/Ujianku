import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase/admin hanya boleh dipakai di server (API Route).",
  );
}

// service_role MELEWATI RLS. Hanya untuk API Route yang butuh Auth Admin API
// (buat akun, reset password). Setiap query WAJIB memfilter tenant_id secara eksplisit.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
