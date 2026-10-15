import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import ConfirmAction from "@/components/admin/ConfirmAction";
import AddStudentsDialog from "@/components/school/AddStudentsDialog";
import ClassDialog, {
  type ClassInfo,
  type TeacherOption,
} from "@/components/school/ClassDialog";
import UserStatusBadge from "@/components/school/UserStatusBadge";
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
import { createClient } from "@/lib/supabase/browser";

type Student = {
  id: string;
  fullName: string;
  nis: string | null;
  isActive: boolean;
};
type Props = ShellProps & {
  cls: ClassInfo & {
    academicYearId: string;
    yearLabel: string;
    homeroom: string | null;
  };
  students: Student[];
  teachers: TeacherOption[];
};

const UUID = /^[0-9a-f-]{36}$/i;

export const getServerSideProps = requireRole(
  "school_admin",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;

    const [{ data: c }, { data: members }] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, name, grade_level, academic_year_id, homeroom_teacher_id, academic_years(name, semester), homeroom:profiles!classes_homeroom_teacher_id_tenant_id_fkey(full_name)",
        )
        .eq("id", id)
        .maybeSingle(),
      // ponytail: tanpa pagination, satu kelas ±40 murid
      supabase
        .from("class_students")
        .select(
          "student:profiles!class_students_student_id_tenant_id_fkey(id, full_name, nis_nip, is_active)",
        )
        .eq("class_id", id)
        .limit(200),
    ]);
    if (!c?.academic_years) return null;

    // Guru aktif + wali kelas saat ini (walau sudah nonaktif) agar pilihan tidak hilang saat diubah
    let teacherQuery = supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher");
    teacherQuery = c.homeroom_teacher_id
      ? teacherQuery.or(`is_active.eq.true,id.eq.${c.homeroom_teacher_id}`)
      : teacherQuery.eq("is_active", true);
    const { data: teacherRows } = await teacherQuery
      .order("full_name")
      .limit(200);

    return {
      cls: {
        id: c.id,
        name: c.name,
        gradeLevel: c.grade_level,
        homeroomTeacherId: c.homeroom_teacher_id,
        academicYearId: c.academic_year_id,
        yearLabel: `${c.academic_years.name} ${SEMESTER_LABEL[c.academic_years.semester]}`,
        homeroom: c.homeroom?.full_name ?? null,
      },
      teachers: (teacherRows ?? []).map((t) => ({
        id: t.id,
        fullName: t.full_name,
      })),
      students: (members ?? [])
        .flatMap((m) => (m.student ? [m.student] : []))
        .map((s) => ({
          id: s.id,
          fullName: s.full_name,
          nis: s.nis_nip,
          isActive: s.is_active,
        }))
        .sort((a, b) => (a.nis ?? "").localeCompare(b.nis ?? "")),
    };
  },
);

export default function ClassDetailPage({
  user,
  cls,
  students,
  teachers,
}: Props) {
  const router = useRouter();

  async function removeStudent(s: Student) {
    const { error } = await createClient()
      .from("class_students")
      .delete()
      .eq("class_id", cls.id)
      .eq("student_id", s.id);
    if (error) {
      toast.error("Gagal mengeluarkan murid");
      return;
    }
    toast.success(`${s.fullName} dikeluarkan dari ${cls.name}`);
    await router.replace(router.asPath);
  }

  async function removeClass() {
    const { error } = await createClient()
      .from("classes")
      .delete()
      .eq("id", cls.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Tidak bisa dihapus: kelas masih berisi murid atau dipakai penugasan guru/ujian."
          : "Gagal menghapus kelas",
      );
      return;
    }
    toast.success(`Kelas ${cls.name} dihapus`);
    await router.replace(`/school/classes?year=${cls.academicYearId}`);
  }

  return (
    <AppShell user={user} title={`Kelas ${cls.name}`}>
      <div className="flex flex-col gap-4">
        <Link
          href={`/school/classes?year=${cls.academicYearId}`}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Semua kelas
        </Link>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Tahun ajaran</dt>
            <dd className="font-medium">{cls.yearLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tingkat</dt>
            <dd className="font-medium">{cls.gradeLevel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Wali kelas</dt>
            <dd className="font-medium">
              {cls.homeroom ?? "Belum ditentukan"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Jumlah murid</dt>
            <dd className="font-medium">{students.length}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <AddStudentsDialog
            classId={cls.id}
            className={cls.name}
            academicYearId={cls.academicYearId}
          />
          <ClassDialog
            academicYearId={cls.academicYearId}
            teachers={teachers}
            cls={cls}
          />
          <ConfirmAction
            label="Hapus kelas"
            variant="destructive"
            title={`Hapus kelas ${cls.name}?`}
            description="Hanya kelas kosong (tanpa murid dan penugasan guru) yang bisa dihapus."
            confirmLabel="Hapus"
            onConfirm={removeClass}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIS</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada murid di kelas ini.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.nis}</TableCell>
                    <TableCell className="min-w-40 font-medium">
                      {s.fullName}
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge active={s.isActive} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ConfirmAction
                          label="Keluarkan"
                          variant="outline"
                          title={`Keluarkan ${s.fullName} dari ${cls.name}?`}
                          description="Akun murid tidak dihapus. Murid bisa dimasukkan ke kelas lain di tahun ajaran ini."
                          confirmLabel="Keluarkan"
                          onConfirm={() => removeStudent(s)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
