import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import CreateSchoolDialog from "@/components/admin/CreateSchoolDialog";
import SchoolStatusBadge from "@/components/admin/SchoolStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

const PAGE_SIZE = 20;

type School = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  activeUntil: string | null;
};
type Props = ShellProps & { schools: School[]; page: number; total: number };

export const getServerSideProps = requireRole(
  "super_admin",
  async ({ query }, supabase) => {
    const page = Math.max(1, Number(query.page) || 1);
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from("tenants")
      .select("id, code, name, status, active_until", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    const now = Date.now();
    return {
      page,
      total: count ?? 0,
      schools: (data ?? []).map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        active:
          t.status === "active" &&
          !!t.active_until &&
          new Date(t.active_until).getTime() > now,
        activeUntil: t.active_until,
      })),
    };
  },
);

export default function SchoolsPage({ user, schools, page, total }: Props) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell user={user} title="Sekolah">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {total} sekolah terdaftar
          </p>
          <CreateSchoolDialog />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktif sampai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada sekolah.
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">
                      <Link
                        href={`/admin/schools/${s.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {s.code}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-48">{s.name}</TableCell>
                    <TableCell>
                      <SchoolStatusBadge active={s.active} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(s.activeUntil)}
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
            <PageLink page={page - 1} disabled={page <= 1} label="Sebelumnya">
              <ChevronLeft aria-hidden />
            </PageLink>
            <PageLink
              page={page + 1}
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
  page,
  disabled,
  label,
  children,
}: {
  page: number;
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
      <Link href={`/admin/schools?page=${page}`}>
        {children}
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  );
}
