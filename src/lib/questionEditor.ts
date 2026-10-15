import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Data bersama halaman buat/ubah soal (getServerSideProps): mapel sekolah + id guru & sekolah.
export async function loadEditorContext(supabase: SupabaseClient<Database>) {
  const [{ data: claims }, { data: tenantId }, { data: subjects }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase.rpc("my_tenant"),
      supabase.from("subjects").select("id, code, name").order("code"),
    ]);
  if (!claims?.claims || !tenantId) return null;
  return {
    userId: claims.claims.sub,
    tenantId,
    subjects: subjects ?? [],
  };
}
