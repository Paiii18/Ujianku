import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TaughtSubject = {
  id: string;
  code: string;
  name: string;
  classes: { id: string; name: string; studentCount: number }[];
};

// Mapel & kelas yang diampu guru di tahun ajaran (default: aktif) — pilihan langkah 1 & 2 wizard.
export async function loadTaughtSubjects(
  supabase: SupabaseClient<Database>,
  userId: string,
  academicYearId?: string,
) {
  let request = supabase
    .from("teaching_assignments")
    .select(
      "subject:subjects!teaching_assignments_subject_id_tenant_id_fkey(id, code, name), class:classes!teaching_assignments_class_id_tenant_id_fkey!inner(id, name, academic_year_id, academic_years!inner(is_active), class_students(count))",
    )
    .eq("teacher_id", userId);
  request = academicYearId
    ? request.eq("class.academic_year_id", academicYearId)
    : request.eq("class.academic_years.is_active", true);
  const { data } = await request;

  const subjects = new Map<string, TaughtSubject>();
  for (const { subject, class: c } of data ?? []) {
    const s = subjects.get(subject.id) ?? { ...subject, classes: [] };
    s.classes.push({
      id: c.id,
      name: c.name,
      studentCount: c.class_students[0]?.count ?? 0,
    });
    subjects.set(subject.id, s);
  }
  return [...subjects.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((s) => ({
      ...s,
      classes: s.classes.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
