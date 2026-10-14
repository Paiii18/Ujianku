import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

const schema = z.object({
  // Nominal bebas (Q-001 belum diputuskan), rupiah tanpa desimal; batas kolom numeric(12,2).
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "Isi nominal dalam angka (rupiah)"),
  paidNow: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function RecordPaymentDialog({
  tenantId,
}: {
  tenantId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", paidNow: true },
  });

  async function onSubmit(values: Values) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({ tenant_id: tenantId, amount: Number(values.amount) })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Gagal mencatat pembayaran");
      return;
    }

    // Dua langkah (tidak satu transaksi): bila lunas gagal, pembayaran tetap tercatat 'pending'
    // dan bisa ditandai lunas dari tabel.
    if (values.paidNow) {
      const { error: payError } = await supabase.rpc("mark_payment_paid", {
        p_subscription_id: data.id,
      });
      if (payError) {
        toast.error("Pembayaran tercatat, tetapi gagal ditandai lunas");
      } else {
        toast.success("Pembayaran lunas, masa aktif bertambah 1 bulan");
      }
    } else {
      toast.success("Pembayaran dicatat (menunggu)");
    }
    setOpen(false);
    reset();
    await router.replace(router.asPath);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">Catat pembayaran</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat pembayaran</DialogTitle>
          <DialogDescription>
            Setiap pembayaran lunas menambah masa aktif 1 bulan.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="payment-amount">Nominal (Rp)</FieldLabel>
              <Input
                id="payment-amount"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="500000"
                className="h-11"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
              <FieldError errors={[errors.amount]} />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                {...register("paidNow")}
              />
              Sudah diterima — tandai lunas sekarang
            </label>
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
