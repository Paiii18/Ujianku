import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = 6;

type Props = ShellProps & {
  activeCount: number;
  inactiveCount: number;
  pendingCount: number;
  examCount: number;
  expiring: { id: string; code: string; name: string; activeUntil: string }[];
  revenue: { label: string; total: number }[];
};

// Bulan dalam WIB, misal "2026-10" (kunci) dan "Oktober 2026" (label).
const monthKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
});
const monthLabel = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "long",
});

export const getServerSideProps = requireRole(
  "super_admin",
  async (_ctx, supabase) => {
    const now = Date.now();
    const [
      { data: tenants },
      { data: paid },
      { count: pendingCount },
      { count: examCount },
    ] = await Promise.all([
      // ponytail: semua sekolah dihitung di sini; pindah ke agregasi SQL (RPC) bila sekolah > ±1.000
      supabase.from("tenants").select("id, code, name, status, active_until"),
      supabase
        .from("subscriptions")
        .select("amount, paid_at")
        .eq("status", "paid")
        .gte(
          "paid_at",
          new Date(now - (MONTHS * 31 + 1) * DAY_MS).toISOString(),
        ),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("exams").select("id", { count: "exact", head: true }),
    ]);

    // Aktif = status 'active' DAN masa aktif belum lewat (sama dengan tenant_is_active()).
    const isActive = (t: { status: string; active_until: string | null }) =>
      t.status === "active" &&
      !!t.active_until &&
      new Date(t.active_until).getTime() > now;
    const active = (tenants ?? []).filter(isActive);

    // 6 bulan terakhir termasuk bulan ini, terlama di atas.
    const months = new Map<string, { label: string; total: number }>();
    const cursor = new Date(now);
    cursor.setUTCDate(15); // tengah bulan: aman dari pergeseran zona waktu
    cursor.setUTCMonth(cursor.getUTCMonth() - (MONTHS - 1));
    for (let i = 0; i < MONTHS; i++) {
      months.set(monthKey.format(cursor), {
        label: monthLabel.format(cursor),
        total: 0,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (const p of paid ?? []) {
      const m = p.paid_at && months.get(monthKey.format(new Date(p.paid_at)));
      if (m) m.total += p.amount;
    }

    return {
      activeCount: active.length,
      inactiveCount: (tenants ?? []).length - active.length,
      pendingCount: pendingCount ?? 0,
      examCount: examCount ?? 0,
      expiring: active
        .filter((t) => new Date(t.active_until!).getTime() - now <= 7 * DAY_MS)
        .sort((a, b) => a.active_until!.localeCompare(b.active_until!))
        .map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          activeUntil: t.active_until!,
        })),
      revenue: [...months.values()],
    };
  },
);

export default function AdminDashboard({
  user,
  activeCount,
  inactiveCount,
  pendingCount,
  examCount,
  expiring,
  revenue,
}: Props) {
  return (
    <AppShell user={user} title="Dashboard">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Sekolah aktif" value={activeCount} />
          <Stat label="Sekolah nonaktif" value={inactiveCount} />
          <Stat
            label="Pembayaran menunggu"
            value={pendingCount}
            href="/admin/subscriptions?status=pending"
          />
          <Stat label="Ujian" value={examCount} hint="Semua sekolah" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Habis dalam 7 hari</CardTitle>
              <CardDescription>
                Sekolah aktif yang perlu segera diperpanjang.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expiring.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada sekolah yang segera habis.
                </p>
              ) : (
                <ul className="divide-y">
                  {expiring.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/admin/schools/${s.id}`}
                        className="flex min-h-11 items-center justify-between gap-2 py-2 hover:text-primary"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-mono font-medium">
                            {s.code}
                          </span>{" "}
                          · {s.name}
                        </span>
                        <span className="shrink-0 text-sm font-medium">
                          {formatDate(s.activeUntil)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pendapatan per bulan</CardTitle>
              <CardDescription>
                Pembayaran lunas, menurut tanggal lunas (WIB).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.map((m) => (
                    <TableRow key={m.label}>
                      <TableCell>{m.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(m.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const card = (
    <Card
      className={
        href ? "h-full transition-colors hover:border-primary" : "h-full"
      }
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-3xl tabular-nums">
          {value}
        </CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
