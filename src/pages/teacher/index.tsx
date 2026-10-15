import AppShell from "@/components/layout/AppShell";
import EmptyDashboard from "@/components/layout/EmptyDashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Teaching = { subject: string; classes: string[] };
type Props = ShellProps & { teaching: Teaching[] };

// Kelas & mapel yang diampu di tahun ajaran aktif (F2.6)
export const getServerSideProps = requireRole(
  "teacher",
  async (_ctx, supabase) => {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) return null;
    const { data } = await supabase
      .from("teaching_assignments")
      .select(
        "subject:subjects!teaching_assignments_subject_id_tenant_id_fkey(name), class:classes!teaching_assignments_class_id_tenant_id_fkey!inner(name, grade_level, year:academic_years!classes_academic_year_id_tenant_id_fkey!inner(is_active))",
      )
      .eq("teacher_id", claims.claims.sub)
      .eq("class.year.is_active", true);

    const bySubject = new Map<string, { name: string; grade: number }[]>();
    for (const a of data ?? []) {
      const list = bySubject.get(a.subject.name) ?? [];
      list.push({ name: a.class.name, grade: a.class.grade_level });
      bySubject.set(a.subject.name, list);
    }
    return {
      teaching: [...bySubject]
        .sort(([a], [b]) => a.localeCompare(b, "id"))
        .map(([subject, classes]) => ({
          subject,
          classes: classes
            .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
            .map((c) => c.name),
        })),
    };
  },
);

export default function TeacherDashboard({ user, teaching }: Props) {
  return (
    <AppShell user={user} title="Dashboard">
      <div className="flex flex-col gap-4">
        <EmptyDashboard
          name={user.fullName}
          text="Ujian, bank soal, dan antrean koreksi Anda akan tampil di sini."
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Kelas & mapel yang Anda ampu</CardTitle>
            <CardDescription>Tahun ajaran aktif</CardDescription>
          </CardHeader>
          <CardContent>
            {teaching.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada penugasan. Hubungi Admin Sekolah.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {teaching.map((t) => (
                  <li key={t.subject} className="text-sm">
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-muted-foreground">
                      {t.classes.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
