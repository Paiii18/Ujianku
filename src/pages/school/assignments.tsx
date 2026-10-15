import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "@/components/layout/AppShell";
import AssignmentCell, {
  type Assignment,
  type TeacherChoice,
} from "@/components/school/AssignmentCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEMESTER_LABEL } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Year = { id: string; label: string; isActive: boolean };
type Named = { id: string; name: string };
type Props = ShellProps & {
  years: Year[];
  yearId: string | null;
  classes: Named[];
  subjects: (Named & { code: string })[];
  teachers: TeacherChoice[];
  // kunci: `${classId}:${subjectId}`
  cells: Record<string, Assignment[]>;
};

export const getServerSideProps = requireRole(
  "school_admin",
  async ({ query }, supabase) => {
    const [{ data: yearRows }, { data: subjectRows }, { data: teacherRows }] =
      await Promise.all([
        supabase
          .from("academic_years")
          .select("id, name, semester, is_active")
          .order("name", { ascending: false })
          .order("semester", { ascending: false })
          .limit(100),
        supabase.from("subjects").select("id, code, name").order("code"),
        supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("role", "teacher")
          .order("full_name")
          .limit(200),
      ]);
    const years = (yearRows ?? []).map((y) => ({
      id: y.id,
      label: `${y.name} ${SEMESTER_LABEL[y.semester]}`,
      isActive: y.is_active,
    }));
    // Default: tahun ajaran aktif, lalu yang terbaru (sama dengan halaman Kelas)
    const yearId =
      years.find((y) => y.id === query.year)?.id ??
      years.find((y) => y.isActive)?.id ??
      years[0]?.id ??
      null;

    const { data: classRows } = yearId
      ? await supabase
          .from("classes")
          .select("id, name")
          .eq("academic_year_id", yearId)
          .order("grade_level")
          .order("name")
      : { data: [] };
    const classes = classRows ?? [];

    const { data: assignmentRows } = classes.length
      ? await supabase
          .from("teaching_assignments")
          .select("id, teacher_id, subject_id, class_id")
          .in(
            "class_id",
            classes.map((c) => c.id),
          )
      : { data: [] };
    const cells: Record<string, Assignment[]> = {};
    for (const a of assignmentRows ?? []) {
      (cells[`${a.class_id}:${a.subject_id}`] ??= []).push({
        id: a.id,
        teacherId: a.teacher_id,
      });
    }

    return {
      years,
      yearId,
      classes,
      subjects: subjectRows ?? [],
      teachers: (teacherRows ?? []).map((t) => ({
        id: t.id,
        fullName: t.full_name,
        isActive: t.is_active,
      })),
      cells,
    };
  },
);

export default function AssignmentsPage({
  user,
  years,
  yearId,
  classes,
  subjects,
  teachers,
  cells,
}: Props) {
  const router = useRouter();
  const missing = !yearId
    ? { text: "Belum ada tahun ajaran.", href: "/school/academic-years" }
    : subjects.length === 0
      ? { text: "Belum ada mapel.", href: "/school/subjects" }
      : classes.length === 0
        ? {
            text: "Belum ada kelas di tahun ajaran ini.",
            href: "/school/classes",
          }
        : null;

  return (
    <AppShell user={user} title="Penugasan guru">
      <div className="flex flex-col gap-4">
        {yearId && (
          <label className="flex w-full flex-col gap-1 text-sm font-medium sm:w-64">
            Tahun ajaran
            <select
              value={yearId}
              onChange={(e) =>
                router.push(`/school/assignments?year=${e.target.value}`)
              }
              className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isActive ? " (aktif)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {missing ? (
          <p className="text-sm text-muted-foreground">
            {missing.text}{" "}
            <Link
              href={missing.href}
              className="text-primary underline underline-offset-4"
            >
              Tambahkan dulu
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ketuk sel untuk memilih guru yang mengampu mapel di kelas itu.
            </p>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">
                      Kelas
                    </TableHead>
                    {subjects.map((s) => (
                      <TableHead key={s.id} className="min-w-40" title={s.name}>
                        {s.code}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">
                        {c.name}
                      </TableCell>
                      {subjects.map((s) => (
                        <TableCell key={s.id} className="p-1">
                          <AssignmentCell
                            classId={c.id}
                            className={c.name}
                            subjectId={s.id}
                            subjectName={s.name}
                            teachers={teachers}
                            assigned={cells[`${c.id}:${s.id}`] ?? []}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
