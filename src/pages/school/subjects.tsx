import { useRouter } from "next/router";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import ConfirmAction from "@/components/admin/ConfirmAction";
import SubjectDialog, { type Subject } from "@/components/school/SubjectDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import { createClient } from "@/lib/supabase/browser";

type Props = ShellProps & { subjects: Subject[] };

export const getServerSideProps = requireRole(
  "school_admin",
  async (_ctx, supabase) => {
    // ponytail: tanpa pagination, mapel per sekolah puluhan; tambah pagination bila > 200
    const { data } = await supabase
      .from("subjects")
      .select("id, code, name")
      .order("code")
      .limit(200);
    return { subjects: data ?? [] };
  },
);

export default function SubjectsPage({ user, subjects }: Props) {
  const router = useRouter();

  async function remove(s: Subject) {
    const { error } = await createClient()
      .from("subjects")
      .delete()
      .eq("id", s.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Tidak bisa dihapus: mapel sudah dipakai penugasan guru atau soal."
          : "Gagal menghapus mapel",
      );
      return;
    }
    toast.success(`Mapel ${s.code} dihapus`);
    await router.replace(router.asPath);
  }

  return (
    <AppShell user={user} title="Mapel">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {subjects.length} mata pelajaran
          </p>
          <SubjectDialog />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada mapel.
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">
                      {s.code}
                    </TableCell>
                    <TableCell className="min-w-40">{s.name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <SubjectDialog subject={s} />
                        <ConfirmAction
                          label="Hapus"
                          variant="destructive"
                          title={`Hapus mapel ${s.code}?`}
                          description="Mapel yang sudah dipakai penugasan guru atau soal tidak bisa dihapus."
                          confirmLabel="Hapus"
                          onConfirm={() => remove(s)}
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
