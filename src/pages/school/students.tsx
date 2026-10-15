import Link from "next/link";
import { ChevronLeft, ChevronRight, FileUp, Search } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import CreateUserDialog from "@/components/school/CreateUserDialog";
import type { ManagedUser } from "@/components/school/EditUserDialog";
import UserRowActions from "@/components/school/UserRowActions";
import UserStatusBadge from "@/components/school/UserStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole, type ShellProps } from "@/lib/requireRole";

const PAGE_SIZE = 20;

type Props = ShellProps & {
  students: ManagedUser[];
  page: number;
  total: number;
  q: string;
};

export const getServerSideProps = requireRole(
  "school_admin",
  async ({ query }, supabase) => {
    const page = Math.max(1, Number(query.page) || 1);
    // Buang karakter khusus filter PostgREST (`,()`) dan wildcard agar input tidak mengubah query.
    const q = String(query.q ?? "")
      .replace(/[,()%*\\]/g, " ")
      .trim()
      .slice(0, 50);
    const from = (page - 1) * PAGE_SIZE;

    let request = supabase
      .from("profiles")
      .select("id, full_name, nis_nip, is_active", { count: "exact" })
      .eq("role", "student");
    if (q) request = request.or(`full_name.ilike.*${q}*,nis_nip.ilike.*${q}*`);
    const { data, count } = await request
      .order("nis_nip")
      .range(from, from + PAGE_SIZE - 1);

    return {
      page,
      q,
      total: count ?? 0,
      students: (data ?? []).map((s) => ({
        id: s.id,
        fullName: s.full_name,
        nisNip: s.nis_nip,
        isActive: s.is_active,
      })),
    };
  },
);

export default function StudentsPage({
  user,
  students,
  page,
  total,
  q,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) =>
    `/school/students?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <AppShell user={user} title="Murid">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* GET form biasa: hasil cari ada di URL (?q=), bisa di-refresh/dibagikan */}
          <form role="search" className="flex w-full gap-2 sm:w-auto">
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Cari nama atau NIS"
              aria-label="Cari nama atau NIS"
              className="h-11 sm:w-64"
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
            >
              <Search aria-hidden />
              <span className="sr-only">Cari</span>
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" asChild>
              <Link href="/school/students/import">
                <FileUp aria-hidden /> Import Excel
              </Link>
            </Button>
            <CreateUserDialog role="student" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {total} murid{q && ` cocok dengan “${q}”`}. Kelas diatur di menu
          Kelas.
        </p>

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
                    {q ? "Tidak ada murid yang cocok." : "Belum ada murid."}
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.nisNip}</TableCell>
                    <TableCell className="min-w-40 font-medium">
                      {s.fullName}
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge active={s.isActive} />
                    </TableCell>
                    <TableCell>
                      <UserRowActions role="student" user={s} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pages > 1 && (
          <nav
            aria-label="Halaman"
            className="flex items-center justify-end gap-2"
          >
            <span className="mr-2 text-sm text-muted-foreground">
              Halaman {page} dari {pages}
            </span>
            <PageLink
              href={href(page - 1)}
              disabled={page <= 1}
              label="Sebelumnya"
            >
              <ChevronLeft aria-hidden />
            </PageLink>
            <PageLink
              href={href(page + 1)}
              disabled={page >= pages}
              label="Berikutnya"
            >
              <ChevronRight aria-hidden />
            </PageLink>
          </nav>
        )}
      </div>
    </AppShell>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" className="size-11" disabled>
        {children}
        <span className="sr-only">{label}</span>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" className="size-11" asChild>
      <Link href={href}>
        {children}
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  );
}
