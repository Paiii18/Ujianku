import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import EditSchoolNameForm from "@/components/admin/EditSchoolNameForm";
import PaymentsTable, {
  PAYMENT_COLUMNS,
  toPayment,
  type Payment,
} from "@/components/admin/PaymentsTable";
import RecordPaymentDialog from "@/components/admin/RecordPaymentDialog";
import SchoolStatusBadge from "@/components/admin/SchoolStatusBadge";
import SchoolStatusToggle from "@/components/admin/SchoolStatusToggle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  school: {
    id: string;
    code: string;
    name: string;
    status: "active" | "inactive";
    active: boolean;
    hasTimeLeft: boolean;
    activeUntil: string | null;
    createdAt: string;
  };
  admins: { id: string; fullName: string; isActive: boolean }[];
  payments: Payment[];
};

const UUID = /^[0-9a-f-]{36}$/i;

export const getServerSideProps = requireRole(
  "super_admin",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;

    const [{ data: t }, { data: admins }, { data: payments }] =
      await Promise.all([
        supabase
          .from("tenants")
          .select("id, code, name, status, active_until, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, full_name, is_active")
          .eq("tenant_id", id)
          .eq("role", "school_admin")
          .order("created_at"),
        // ponytail: 24 terakhir (±2 tahun); riwayat lengkap di /admin/subscriptions
        supabase
          .from("subscriptions")
          .select(PAYMENT_COLUMNS)
          .eq("tenant_id", id)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);
    if (!t) return null;

    const hasTimeLeft =
      !!t.active_until && new Date(t.active_until).getTime() > Date.now();

    return {
      school: {
        id: t.id,
        code: t.code,
        name: t.name,
        status: t.status,
        active: t.status === "active" && hasTimeLeft,
        hasTimeLeft,
        activeUntil: t.active_until,
        createdAt: t.created_at,
      },
      admins: (admins ?? []).map((a) => ({
        id: a.id,
        fullName: a.full_name,
        isActive: a.is_active,
      })),
      payments: (payments ?? []).map(toPayment),
    };
  },
);

export default function SchoolDetailPage({
  user,
  school,
  admins,
  payments,
}: Props) {
  return (
    <AppShell user={user} title={school.code}>
      <div className="flex max-w-3xl flex-col gap-4">
        <Link
          href="/admin/schools"
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Daftar sekolah
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 font-heading text-xl">
              {school.name} <SchoolStatusBadge active={school.active} />
            </CardTitle>
            <CardDescription>
              Kode <span className="font-mono">{school.code}</span> · terdaftar{" "}
              {formatDate(school.createdAt)} · aktif sampai{" "}
              {formatDate(school.activeUntil)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditSchoolNameForm
              key={school.name}
              id={school.id}
              name={school.name}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Langganan</CardTitle>
            <CardDescription>
              Pembayaran lunas menambah masa aktif 1 bulan dari tanggal berakhir
              sebelumnya, atau dari hari ini bila sudah lewat.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <RecordPaymentDialog tenantId={school.id} />
              <SchoolStatusToggle
                id={school.id}
                status={school.status}
                hasTimeLeft={school.hasTimeLeft}
              />
            </div>
            <PaymentsTable payments={payments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin Sekolah</CardTitle>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada admin.</p>
            ) : (
              <ul className="divide-y">
                {admins.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span>{a.fullName}</span>
                    {!a.isActive && <Badge variant="outline">Nonaktif</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
