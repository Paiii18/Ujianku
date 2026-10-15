import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Kelas di tahun ajaran aktif sekolah user (RLS), dikunci nama huruf kecil untuk pencocokan import.
export async function activeYearClasses(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("classes")
    .select("id, name, academic_years!inner(is_active)")
    .eq("academic_years.is_active", true)
    .order("name");
  return new Map(
    (data ?? []).map((c) => [c.name.toLowerCase(), { id: c.id, name: c.name }]),
  );
}
