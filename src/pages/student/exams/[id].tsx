import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readSession, writeSession } from "@/lib/examPaper";
import { formatDateTime } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type Exam = Database["public"]["Functions"]["my_exams"]["Returns"][number];
type Props = ShellProps & { exam: Exam; now: number };

const UUID = /^[0-9a-f-]{36}$/i;

// Masuk ujian (F3.8): murid memasukkan token → RPC start_attempt (F3.7) → halaman pengerjaan.
// Attempt berjalan + session_id tersimpan di perangkat ini → langsung lanjut tanpa token.
export const getServerSideProps = requireRole(
  "student",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;
    const { data } = await supabase.rpc("my_exams");
    const exam = data?.find((e) => e.id === id);
    return exam ? { exam, now: Date.now() } : null;
  },
);

export default function StartExamPage({ user, exam, now }: Props) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const running = exam.attempt_status === "in_progress" && exam.attempt_id;
  useEffect(() => {
    if (running && readSession(exam.attempt_id)) {
      void router.replace(`/student/attempts/${exam.attempt_id}`);
    }
  }, [running, exam.attempt_id, router]);

  const closed =
    exam.attempt_status === "submitted"
      ? "Ujian ini sudah kamu kumpulkan."
      : new Date(exam.start_at).getTime() > now
        ? `Ujian dimulai ${formatDateTime(exam.start_at)}.`
        : new Date(exam.end_at).getTime() <= now
          ? "Jadwal ujian sudah berakhir."
          : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await createClient()
      .rpc("start_attempt", { p_exam_id: exam.id, p_token: token })
      .single();
    if (error || !data) {
      setBusy(false);
      // 22023 = pesan dari RPC (token salah, belum dimulai, ...), aman ditampilkan
      setError(
        error?.code === "22023"
          ? error.message
          : "Gagal memulai ujian. Periksa koneksi lalu coba lagi.",
      );
      return;
    }
    writeSession(data.attempt_id, data.session_id);
    await router.push(`/student/attempts/${data.attempt_id}`);
  }

  return (
    <AppShell user={user} title="Masuk ujian">
      <div className="flex max-w-md flex-col gap-4">
        <Link
          href="/student/exams"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Daftar ujian
        </Link>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">{exam.title}</h2>
          <p className="text-sm text-muted-foreground">{exam.subject_name}</p>
          <p className="mt-2 text-sm">
            {formatDateTime(exam.start_at)} – {formatDateTime(exam.end_at)}
          </p>
          <p className="text-sm text-muted-foreground">
            Durasi {exam.duration_minutes} menit
          </p>
        </div>

        {closed ? (
          <p className="rounded-lg border p-4 text-sm">{closed}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Label htmlFor="token">Token ujian</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="6 karakter dari guru"
              className="h-11 font-mono text-lg tracking-widest"
              aria-invalid={!!error}
              aria-describedby={error ? "token-error" : undefined}
              required
            />
            {error && (
              <p
                id="token-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {running
                ? "Ujian sudah kamu mulai. Masukkan token untuk melanjutkan di perangkat ini; jawaban yang tersimpan tetap ada."
                : "Waktu mulai berjalan setelah kamu menekan Mulai."}
            </p>
            <Button
              type="submit"
              className="h-11"
              disabled={busy || token.trim().length < 6}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {running ? "Lanjutkan ujian" : "Mulai ujian"}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
