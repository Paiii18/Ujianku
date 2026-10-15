import AppShell from "@/components/layout/AppShell";
import CreateUserDialog from "@/components/school/CreateUserDialog";
import type { ManagedUser } from "@/components/school/EditUserDialog";
import UserRowActions from "@/components/school/UserRowActions";
import UserStatusBadge from "@/components/school/UserStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Teacher = ManagedUser & { email: string };
type Props = ShellProps & { teachers: Teacher[] };

export const getServerSideProps = requireRole(
  "school_admin",
  async (_ctx, supabase) => {
    // ponytail: tanpa pagination, guru per sekolah < 200; tambah pagination seperti /school/students bila perlu
    const [{ data }, { data: emails }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, nis_nip, is_active")
        .eq("role", "teacher")
        .order("full_name")
        .limit(200),
      supabase.rpc("teacher_emails"),
    ]);
    const emailOf = new Map((emails ?? []).map((e) => [e.id, e.email]));
    return {
      teachers: (data ?? []).map((t) => ({
        id: t.id,
        fullName: t.full_name,
        nisNip: t.nis_nip,
        isActive: t.is_active,
        email: emailOf.get(t.id) ?? "—",
      })),
    };
  },
);

export default function TeachersPage({ user, teachers }: Props) {
  return (
    <AppShell user={user} title="Guru">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {teachers.length} guru
          </p>
          <CreateUserDialog role="teacher" />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada guru.
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="min-w-40 font-medium">
                      {t.fullName}
                    </TableCell>
                    <TableCell>{t.email}</TableCell>
                    <TableCell className="font-mono">
                      {t.nisNip ?? "—"}
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge active={t.isActive} />
                    </TableCell>
                    <TableCell>
                      <UserRowActions role="teacher" user={t} />
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
