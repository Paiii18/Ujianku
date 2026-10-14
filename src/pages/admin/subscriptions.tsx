import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import PaymentsTable, {
  PAYMENT_COLUMNS,
  toPayment,
  type Payment,
} from "@/components/admin/PaymentsTable";
import { Button } from "@/components/ui/button";
import { requireRole, type ShellProps } from "@/lib/requireRole";

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "paid", label: "Lunas" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

type Props = ShellProps & {
  payments: Payment[];
  page: number;
  total: number;
  status: Filter;
};

export const getServerSideProps = requireRole(
  "super_admin",
  async ({ query }, supabase) => {
    const page = Math.max(1, Number(query.page) || 1);
    const status =
      FILTERS.find((f) => f.value === query.status)?.value ?? ("" as Filter);
    const from = (page - 1) * PAGE_SIZE;

    let q = supabase
      .from("subscriptions")
      .select(`${PAYMENT_COLUMNS}, tenants(id, code)`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (status) q = q.eq("status", status);
    const { data, count } = await q;

    return {
      page,
      status,
      total: count ?? 0,
      payments: (data ?? []).map(toPayment),
    };
  },
);

export default function SubscriptionsPage({
  user,
  payments,
  page,
  total,
  status,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, s: Filter = status) =>
    `/admin/subscriptions?${new URLSearchParams({
      ...(s ? { status: s } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    })}`;

  return (
    <AppShell user={user} title="Langganan">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Catat pembayaran baru dari halaman detail sekolah.
        </p>
        <nav aria-label="Filter status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              asChild
              variant={f.value === status ? "default" : "outline"}
              className="h-11"
            >
              <Link
                href={href(1, f.value)}
                aria-current={f.value === status ? "page" : undefined}
              >
                {f.label}
              </Link>
            </Button>
          ))}
        </nav>

        <PaymentsTable payments={payments} showSchool />

        {pages > 1 && (
          <nav
            aria-label="Halaman"
            className="flex items-center justify-end gap-2 text-sm"
          >
            <span className="mr-2 text-muted-foreground">
              Halaman {page} dari {pages}
            </span>
            <Button
              asChild={page > 1}
              variant="outline"
              className="h-11"
              disabled={page <= 1}
            >
              {page > 1 ? (
                <Link href={href(page - 1)}>Sebelumnya</Link>
              ) : (
                <span>Sebelumnya</span>
              )}
            </Button>
            <Button
              asChild={page < pages}
              variant="outline"
              className="h-11"
              disabled={page >= pages}
            >
              {page < pages ? (
                <Link href={href(page + 1)}>Berikutnya</Link>
              ) : (
                <span>Berikutnya</span>
              )}
            </Button>
          </nav>
        )}
      </div>
    </AppShell>
  );
}
