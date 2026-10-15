import { useRouter } from "next/router";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import ConfirmAction from "@/components/admin/ConfirmAction";
import AcademicYearDialog, {
  type AcademicYear,
} from "@/components/school/AcademicYearDialog";
import { Badge } from "@/components/ui/badge";
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

type Year = AcademicYear & { isActive: boolean };
type Props = ShellProps & { years: Year[] };

export const getServerSideProps = requireRole(
  "school_admin",
  async (_ctx, supabase) => {
    // ponytail: tanpa pagination, 2 baris per tahun; limit sebagai pengaman
    const { data } = await supabase
      .from("academic_years")
      .select("id, name, semester, is_active")
      .order("name", { ascending: false })
      .order("semester", { ascending: false })
      .limit(100);
    return {
      years: (data ?? []).map((y) => ({
        id: y.id,
        name: y.name,
        semester: y.semester,
        isActive: y.is_active,
      })),
    };
  },
);

export default function AcademicYearsPage({ user, years }: Props) {
  const router = useRouter();
  const refresh = () => router.replace(router.asPath);

  async function activate(y: Year) {
    const { error } = await createClient().rpc("activate_academic_year", {
      p_id: y.id,
    });
    if (error) {
      toast.error("Gagal mengaktifkan tahun ajaran");
      return;
    }
    toast.success(`${y.name} ${SEMESTER_LABEL[y.semester]} sekarang aktif`);
    await refresh();
  }

  async function remove(y: Year) {
    const { error } = await createClient()
      .from("academic_years")
      .delete()
      .eq("id", y.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Tidak bisa dihapus: tahun ajaran sudah dipakai kelas."
          : "Gagal menghapus tahun ajaran",
      );
      return;
    }
    toast.success("Tahun ajaran dihapus");
    await refresh();
  }

  return (
    <AppShell user={user} title="Tahun ajaran">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Hanya satu tahun ajaran yang aktif. Kelas dan ujian baru memakai
            tahun ajaran aktif.
          </p>
          <AcademicYearDialog />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun ajaran</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada tahun ajaran.
                  </TableCell>
                </TableRow>
              ) : (
                years.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-medium">{y.name}</TableCell>
                    <TableCell>{SEMESTER_LABEL[y.semester]}</TableCell>
                    <TableCell>
                      {y.isActive ? (
                        <Badge className="bg-success text-success-foreground">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Tidak aktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {!y.isActive && (
                          <ConfirmAction
                            label="Jadikan aktif"
                            variant="outline"
                            title={`Aktifkan ${y.name} ${SEMESTER_LABEL[y.semester]}?`}
                            description="Tahun ajaran yang sedang aktif akan dinonaktifkan."
                            confirmLabel="Jadikan aktif"
                            onConfirm={() => activate(y)}
                          />
                        )}
                        <AcademicYearDialog year={y} />
                        {!y.isActive && (
                          <ConfirmAction
                            label="Hapus"
                            variant="destructive"
                            title={`Hapus ${y.name} ${SEMESTER_LABEL[y.semester]}?`}
                            description="Tahun ajaran yang sudah dipakai kelas tidak bisa dihapus."
                            confirmLabel="Hapus"
                            onConfirm={() => remove(y)}
                          />
                        )}
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
