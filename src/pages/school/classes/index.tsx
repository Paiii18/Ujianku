import Link from "next/link";
import { useRouter } from "next/router";
import AppShell from "@/components/layout/AppShell";
import ClassDialog, {
  type TeacherOption,
} from "@/components/school/ClassDialog";
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
type ClassRow = {
  id: string;
  name: string;
  gradeLevel: number;
  homeroom: string | null;
  students: number;
};
type Props = ShellProps & {
  years: Year[];
  yearId: string | null;
  classes: ClassRow[];
  teachers: TeacherOption[];
};

export const getServerSideProps = requireRole(
  "school_admin",
  async ({ query }, supabase) => {
    const [{ data: yearRows }, { data: teacherRows }] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id, name, semester, is_active")
        .order("name", { ascending: false })
        .order("semester", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .eq("is_active", true)
        .order("full_name")
        .limit(200),
    ]);
    const years = (yearRows ?? []).map((y) => ({
      id: y.id,
      label: `${y.name} ${SEMESTER_LABEL[y.semester]}`,
      isActive: y.is_active,
    }));
    // Default: tahun ajaran aktif, lalu yang terbaru
    const yearId =
      years.find((y) => y.id === query.year)?.id ??
      years.find((y) => y.isActive)?.id ??
      years[0]?.id ??
      null;

    const { data: classRows } = yearId
      ? await supabase
          .from("classes")
          .select(
            "id, name, grade_level, homeroom:profiles!classes_homeroom_teacher_id_tenant_id_fkey(full_name), class_students(count)",
          )
          .eq("academic_year_id", yearId)
          .order("grade_level")
          .order("name")
      : { data: [] };

    return {
      years,
      yearId,
      teachers: (teacherRows ?? []).map((t) => ({
        id: t.id,
        fullName: t.full_name,
      })),
      classes: (classRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.grade_level,
        homeroom: c.homeroom?.full_name ?? null,
        students: c.class_students[0]?.count ?? 0,
      })),
    };
  },
);

export default function ClassesPage({
  user,
  years,
  yearId,
  classes,
  teachers,
}: Props) {
  const router = useRouter();

  return (
    <AppShell user={user} title="Kelas">
      {!yearId ? (
        <p className="text-sm text-muted-foreground">
          Belum ada tahun ajaran.{" "}
          <Link
            href="/school/academic-years"
            className="text-primary underline underline-offset-4"
          >
            Buat tahun ajaran
          </Link>{" "}
          dulu sebelum membuat kelas.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="flex w-full flex-col gap-1 text-sm font-medium sm:w-64">
              Tahun ajaran
              <select
                value={yearId}
                onChange={(e) =>
                  router.push(`/school/classes?year=${e.target.value}`)
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
            <ClassDialog academicYearId={yearId} teachers={teachers} />
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Wali kelas</TableHead>
                  <TableHead className="text-right">Murid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada kelas di tahun ajaran ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/school/classes/${c.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>{c.gradeLevel}</TableCell>
                      <TableCell className="min-w-40">
                        {c.homeroom ?? (
                          <span className="text-muted-foreground">
                            Belum ditentukan
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{c.students}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
