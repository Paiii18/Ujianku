import { useState } from "react";
import { toast } from "sonner";
import ConfirmAction from "@/components/admin/ConfirmAction";
import { createClient } from "@/lib/supabase/browser";

// Token ujian terbit + tombol perbarui (F3.4). Token lama langsung tidak berlaku.
export default function ExamTokenCard({
  examId,
  token: initial,
}: {
  examId: string;
  token: string;
}) {
  const [token, setToken] = useState(initial);

  async function refresh() {
    const { data, error } = await createClient().rpc("refresh_exam_token", {
      p_exam_id: examId,
    });
    if (error || !data) {
      toast.error(
        error?.code === "22023" ? error.message : "Gagal memperbarui token",
      );
      return;
    }
    setToken(data);
    toast.success("Token diperbarui");
  }

  return (
    <div className="flex max-w-3xl flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">Token ujian</p>
        <p
          className="font-mono text-3xl font-semibold tracking-[0.3em]"
          aria-live="polite"
        >
          {token}
        </p>
      </div>
      <ConfirmAction
        label="Perbarui token"
        variant="outline"
        title="Perbarui token?"
        description="Token lama langsung tidak berlaku. Bagikan token baru ke murid yang belum masuk ujian."
        confirmLabel="Perbarui"
        onConfirm={refresh}
      />
    </div>
  );
}
