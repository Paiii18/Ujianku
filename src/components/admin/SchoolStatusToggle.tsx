import { useRouter } from "next/router";
import { toast } from "sonner";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { createClient } from "@/lib/supabase/browser";

// Nonaktifkan manual / aktifkan kembali. Aktifkan kembali hanya bila masa aktif masih tersisa;
// selain itu harus lewat pembayaran (mark_payment_paid). Audit lewat trigger.
export default function SchoolStatusToggle({
  id,
  status,
  hasTimeLeft,
}: {
  id: string;
  status: "active" | "inactive";
  hasTimeLeft: boolean;
}) {
  const router = useRouter();
  const next = status === "active" ? "inactive" : "active";

  if (next === "active" && !hasTimeLeft) return null;

  async function toggle() {
    const { error } = await createClient()
      .from("tenants")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      toast.error("Gagal mengubah status sekolah");
      return;
    }
    toast.success(
      next === "inactive" ? "Sekolah dinonaktifkan" : "Sekolah aktif kembali",
    );
    await router.replace(router.asPath);
  }

  return next === "inactive" ? (
    <ConfirmAction
      label="Nonaktifkan sekolah"
      variant="destructive"
      title="Nonaktifkan sekolah?"
      description="Semua user sekolah ini langsung tidak bisa memakai aplikasi. Data tetap tersimpan."
      confirmLabel="Ya, nonaktifkan"
      onConfirm={toggle}
    />
  ) : (
    <ConfirmAction
      label="Aktifkan kembali"
      variant="outline"
      title="Aktifkan kembali sekolah?"
      description="User sekolah bisa memakai aplikasi lagi sampai masa aktif berakhir."
      confirmLabel="Ya, aktifkan"
      onConfirm={toggle}
    />
  );
}
