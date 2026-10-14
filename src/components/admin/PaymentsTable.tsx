import Link from "next/link";
import { useRouter } from "next/router";
import { toast } from "sonner";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

export type Payment = {
  id: string;
  amount: number;
  status: Database["public"]["Enums"]["payment_status"];
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  school?: { id: string; code: string };
};

// Kolom select Supabase yang cocok dengan toPayment().
export const PAYMENT_COLUMNS =
  "id, amount, status, period_start, period_end, created_at";

export function toPayment(row: {
  id: string;
  amount: number;
  status: Payment["status"];
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  tenants?: { id: string; code: string } | null;
}): Payment {
  return {
    id: row.id,
    amount: row.amount,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    ...(row.tenants ? { school: row.tenants } : {}),
  };
}

const STATUS = {
  pending: (
    <Badge className="bg-warning text-warning-foreground">Menunggu</Badge>
  ),
  paid: <Badge className="bg-success text-success-foreground">Lunas</Badge>,
  cancelled: <Badge variant="outline">Dibatalkan</Badge>,
} satisfies Record<Payment["status"], React.ReactNode>;

export default function PaymentsTable({
  payments,
  showSchool = false,
}: {
  payments: Payment[];
  showSchool?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {showSchool && <TableHead>Sekolah</TableHead>}
            <TableHead>Dicatat</TableHead>
            <TableHead>Nominal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showSchool ? 6 : 5}
                className="h-20 text-center text-muted-foreground"
              >
                Belum ada pembayaran.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p) => (
              <TableRow key={p.id}>
                {showSchool && (
                  <TableCell className="font-mono font-medium">
                    {p.school && (
                      <Link
                        href={`/admin/schools/${p.school.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {p.school.code}
                      </Link>
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">
                  {formatDate(p.createdAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatRupiah(p.amount)}
                </TableCell>
                <TableCell>{STATUS[p.status]}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {p.periodStart
                    ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === "pending" && <PendingActions id={p.id} />}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PendingActions({ id }: { id: string }) {
  const router = useRouter();

  async function run(action: "pay" | "cancel") {
    const supabase = createClient();
    const { error } =
      action === "pay"
        ? await supabase.rpc("mark_payment_paid", { p_subscription_id: id })
        : await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("id", id);
    if (error) {
      toast.error("Gagal memproses pembayaran. Muat ulang halaman.");
      return;
    }
    toast.success(
      action === "pay" ? "Pembayaran lunas" : "Pembayaran dibatalkan",
    );
    await router.replace(router.asPath);
  }

  return (
    <div className="flex justify-end gap-2">
      <ConfirmAction
        label="Tandai lunas"
        size="sm"
        title="Tandai pembayaran lunas?"
        description="Masa aktif sekolah bertambah 1 bulan. Pembayaran lunas tidak bisa dibatalkan."
        confirmLabel="Ya, tandai lunas"
        onConfirm={() => run("pay")}
      />
      <ConfirmAction
        label="Batalkan"
        size="sm"
        variant="outline"
        title="Batalkan pembayaran?"
        description="Pembayaran ditandai dibatalkan dan tetap tersimpan di riwayat."
        confirmLabel="Ya, batalkan"
        onConfirm={() => run("cancel")}
      />
    </div>
  );
}
