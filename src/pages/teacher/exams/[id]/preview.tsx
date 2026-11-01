import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  PreviewBody,
  toPreview,
  type Preview,
} from "@/components/teacher/QuestionPreview";
import { Button } from "@/components/ui/button";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  exam: { id: string; title: string; duration: number };
  questions: Preview[];
};

const UUID = /^[0-9a-f-]{36}$/i;
const LABELS = ["A", "B", "C", "D", "E"];

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pratinjau ujian (F3.5): guru mencoba ujian seperti murid. Hanya membaca (gSSP + RLS guru);
// jawaban hanya di state browser → tidak ada attempt yang tercatat.
// Pengacakan soal/opsi mengikuti pengaturan ujian, diacak ulang tiap halaman dimuat.
// ponytail: tampilan sederhana; pratinjau beralih ke halaman ujian murid (F3.8) bila sudah ada
export const getServerSideProps = requireRole(
  "teacher",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;
    const { data: e } = await supabase
      .from("exams")
      .select(
        "id, title, duration_minutes, shuffle_questions, shuffle_options, exam_questions(order_no, points, question_id)",
      )
      .eq("id", id)
      .order("order_no", { referencedTable: "exam_questions" })
      .maybeSingle();
    if (!e) return null;

    const ids = e.exam_questions.map((q) => q.question_id);
    const [{ data: rows }, { data: subs }] = await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, type, content, image_path, points, question_options(label, content, image_path), question_pairs(left_text, right_text, right_key, position)",
        )
        .in("id", ids)
        .order("label", { referencedTable: "question_options" }),
      supabase
        .from("questions")
        .select("parent_id, content, points")
        .in("parent_id", ids)
        .order("position"),
    ]);

    const paths = (rows ?? [])
      .flatMap((q) => [
        q.image_path,
        ...q.question_options.map((o) => o.image_path),
      ])
      .filter((p): p is string => !!p);
    const { data: signed } = paths.length
      ? await supabase.storage
          .from("question-images")
          .createSignedUrls(paths, 60 * 60)
      : { data: [] };
    const url = (p: string | null) =>
      (p && signed?.find((s) => s.path === p)?.signedUrl) || null;

    const byId = new Map((rows ?? []).map((q) => [q.id, q]));
    let questions = e.exam_questions.flatMap((eq) => {
      const q = byId.get(eq.question_id);
      if (!q) return [];
      const preview = toPreview(
        q,
        (subs ?? []).filter((s) => s.parent_id === q.id),
        url,
      );
      if (eq.points !== null) preview.points = Number(eq.points);
      if (e.shuffle_options && q.type === "multiple_choice")
        preview.options = shuffle(preview.options).map((o, i) => ({
          ...o,
          label: LABELS[i],
        }));
      return [preview];
    });
    if (e.shuffle_questions) questions = shuffle(questions);

    return {
      exam: { id: e.id, title: e.title, duration: e.duration_minutes },
      questions,
    };
  },
);

export default function ExamPreviewPage({ user, exam, questions }: Props) {
  const [current, setCurrent] = useState(0);
  const total = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <AppShell user={user} title={`Pratinjau: ${exam.title}`}>
      <div className="flex max-w-3xl flex-col gap-4">
        <Link
          href={`/teacher/exams/${exam.id}`}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Kembali ke ujian
        </Link>
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          Mode pratinjau: jawaban tidak disimpan dan tidak tercatat sebagai
          pengerjaan murid. Durasi {exam.duration} menit · {questions.length}{" "}
          soal · total {Math.round(total * 100) / 100} poin.
        </p>

        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ujian ini belum punya soal.
          </p>
        ) : (
          <>
            <nav aria-label="Nomor soal" className="flex flex-wrap gap-2">
              {questions.map((_, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={i === current ? "default" : "outline"}
                  className="size-11"
                  aria-current={i === current ? "step" : undefined}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </Button>
              ))}
            </nav>

            {/* Semua soal dirender agar jawaban tetap ada saat pindah nomor */}
            {questions.map((q, i) => (
              <section
                key={i}
                hidden={i !== current}
                aria-label={`Soal ${i + 1}`}
                className="rounded-lg border bg-card p-4"
              >
                <h2 className="mb-2 font-medium">Soal {i + 1}</h2>
                <PreviewBody data={q} name={`q${i}`} />
              </section>
            ))}

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={current === 0}
                onClick={() => setCurrent(current - 1)}
              >
                <ChevronLeft aria-hidden /> Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={current === questions.length - 1}
                onClick={() => setCurrent(current + 1)}
              >
                Berikutnya <ChevronRight aria-hidden />
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
