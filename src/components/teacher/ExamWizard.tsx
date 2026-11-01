import { useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import ConfirmAction from "@/components/admin/ConfirmAction";
import ExamQuestionPicker, {
  type PickedQuestion,
} from "@/components/teacher/ExamQuestionPicker";
import ExamStudentPicker, {
  type PickedStudent,
} from "@/components/teacher/ExamStudentPicker";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TaughtSubject } from "@/lib/examEditor";
import { fromWibInput, QUESTION_TYPE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type ScoreVisibility = Database["public"]["Enums"]["score_visibility"];

// Angka disimpan sebagai teks agar input bisa dikosongkan saat diketik
export type WizardExam = {
  id: string;
  status: "draft" | "published";
  subjectId: string;
  title: string;
  startAt: string; // datetime-local WIB
  endAt: string;
  duration: string;
  kkm: string;
  classIds: string[];
  students: PickedStudent[];
  questions: PickedQuestion[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  requireFullscreen: boolean;
  limitTabs: boolean;
  maxTabSwitches: string;
  essayThreshold: string; // persen
  scoreVisibility: ScoreVisibility;
};

const STEPS = ["Info", "Peserta", "Soal", "Pengaturan"];
const VISIBILITY: Record<ScoreVisibility, string> = {
  hidden: "Tidak ditampilkan",
  score: "Nilai saja",
  score_and_review: "Nilai + jawaban & pembahasan",
};
// ponytail: <select>/checkbox native, gaya disamakan dengan Input
const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
const CHECK = "size-5 accent-primary";

const num = (v: string) => Number(v.trim().replace(",", "."));
const isInt = (v: string, min: number, max: number) =>
  /^\d+$/.test(v.trim()) && num(v) >= min && num(v) <= max;
const isNum = (v: string, min: number, max: number) =>
  /^\d+([.,]\d{1,2})?$/.test(v.trim()) && num(v) >= min && num(v) <= max;

// Pesan error langkah tertentu; null = valid. Validasi akhir tetap di RPC save_exam.
function stepError(step: number, e: WizardExam): string | null {
  if (step === 0) {
    if (!e.title.trim()) return "Judul wajib diisi";
    if (!e.subjectId) return "Pilih mapel";
    if (!e.startAt || !e.endAt) return "Isi waktu mulai dan selesai";
    if (e.endAt <= e.startAt) return "Waktu selesai harus setelah waktu mulai";
    if (!isInt(e.duration, 1, 600)) return "Durasi harus 1–600 menit";
    if (!isNum(e.kkm, 0, 100)) return "KKM harus 0–100";
  }
  if (step === 2) {
    const bad = e.questions.findIndex(
      (q) => q.points.trim() && !isNum(q.points, 0.01, 1000),
    );
    if (bad >= 0) return `Poin soal no ${bad + 1} harus 0,01–1000`;
  }
  if (step === 3) {
    if (e.limitTabs && !isInt(e.maxTabSwitches, 1, 100))
      return "Batas pindah tab harus 1–100";
    if (!isInt(e.essayThreshold, 0, 100))
      return "Ambang kemiripan essay harus 0–100%";
  }
  return null;
}

// Wizard buat/ubah ujian (F3.3): info → peserta → soal → pengaturan → simpan draft / terbitkan.
// Semua langkah di satu state; disimpan sekali lewat RPC save_exam (satu transaksi).
export default function ExamWizard({
  exam: initial,
  subjects,
  locked,
}: {
  exam: WizardExam;
  subjects: TaughtSubject[];
  locked: boolean; // sudah ada murid yang mengerjakan
}) {
  const router = useRouter();
  const [exam, setExam] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof WizardExam>(key: K, value: WizardExam[K]) =>
    setExam((e) => ({ ...e, [key]: value }));
  const subject = subjects.find((s) => s.id === exam.subjectId);
  const classes = subject?.classes ?? [];
  const classStudents = classes
    .filter((c) => exam.classIds.includes(c.id))
    .reduce((sum, c) => sum + c.studentCount, 0);
  const totalPoints = exam.questions.reduce(
    (sum, q) => sum + (q.points.trim() ? num(q.points) : q.bankPoints),
    0,
  );

  function go(next: number) {
    // Maju hanya bila langkah-langkah sebelumnya valid; mundur selalu boleh
    for (let s = 0; s < next; s++) {
      const message = stepError(s, exam);
      if (message) {
        setStep(s);
        return setError(message);
      }
    }
    setError(null);
    setStep(next);
  }

  function changeSubject(id: string) {
    // Kelas mapel lama tidak berlaku untuk mapel baru
    const allowed = new Set(
      subjects.find((s) => s.id === id)?.classes.map((c) => c.id),
    );
    setExam((e) => ({
      ...e,
      subjectId: id,
      classIds: e.classIds.filter((c) => allowed.has(c)),
    }));
  }

  function moveQuestion(index: number, delta: number) {
    const list = [...exam.questions];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    set("questions", list);
  }

  async function save(publish: boolean) {
    for (let s = 0; s < STEPS.length; s++) {
      const message = stepError(s, exam);
      if (message) {
        setStep(s);
        return setError(message);
      }
    }
    setError(null);
    setSaving(true);
    const { error: rpcError } = await createClient().rpc("save_exam", {
      p_id: exam.id,
      p_subject_id: exam.subjectId,
      p_title: exam.title,
      p_start_at: fromWibInput(exam.startAt),
      p_end_at: fromWibInput(exam.endAt),
      p_duration_minutes: num(exam.duration),
      p_kkm: num(exam.kkm),
      p_class_ids: exam.classIds,
      p_student_ids: exam.students.map((s) => s.id),
      p_questions: exam.questions.map((q) => ({
        question_id: q.id,
        points: q.points.trim() ? num(q.points) : null,
      })),
      p_shuffle_questions: exam.shuffleQuestions,
      p_shuffle_options: exam.shuffleOptions,
      p_require_fullscreen: exam.requireFullscreen,
      p_max_tab_switches: exam.limitTabs ? num(exam.maxTabSwitches) : undefined,
      p_essay_threshold: num(exam.essayThreshold) / 100,
      p_score_visibility: exam.scoreVisibility,
      p_publish: publish,
    });
    setSaving(false);
    if (rpcError) {
      // 22023 = pesan validasi dari RPC, aman ditampilkan
      return setError(
        rpcError.code === "22023"
          ? rpcError.message
          : "Gagal menyimpan. Coba lagi.",
      );
    }
    toast.success(publish ? "Ujian diterbitkan" : "Draft disimpan");
    await router.push("/teacher/exams");
  }

  const steps: ReactNode[] = [
    // 1. Info ------------------------------------------------------------------
    <FieldGroup key="info">
      <Field>
        <FieldLabel htmlFor="e-title">Judul ujian</FieldLabel>
        <Input
          id="e-title"
          className="h-11"
          maxLength={200}
          value={exam.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Contoh: PTS Matematika Kelas X"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="e-subject">Mapel</FieldLabel>
        <select
          id="e-subject"
          className={SELECT}
          value={exam.subjectId}
          onChange={(e) => changeSubject(e.target.value)}
        >
          <option value="">— Pilih mapel —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <FieldDescription>
          Hanya mapel yang Anda ampu di tahun ajaran ini.
        </FieldDescription>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="e-start">Mulai (WIB)</FieldLabel>
          <Input
            id="e-start"
            type="datetime-local"
            className="h-11"
            value={exam.startAt}
            onChange={(e) => set("startAt", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="e-end">Selesai (WIB)</FieldLabel>
          <Input
            id="e-end"
            type="datetime-local"
            className="h-11"
            value={exam.endAt}
            onChange={(e) => set("endAt", e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="e-duration">Durasi (menit)</FieldLabel>
          <Input
            id="e-duration"
            inputMode="numeric"
            className="h-11"
            value={exam.duration}
            onChange={(e) => set("duration", e.target.value)}
          />
          <FieldDescription>
            Waktu mengerjakan sejak murid mulai; tetap berhenti di waktu
            selesai.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="e-kkm">KKM</FieldLabel>
          <Input
            id="e-kkm"
            inputMode="decimal"
            className="h-11"
            value={exam.kkm}
            onChange={(e) => set("kkm", e.target.value)}
          />
        </Field>
      </div>
    </FieldGroup>,

    // 2. Peserta ---------------------------------------------------------------
    <FieldGroup key="participants">
      <FieldSet>
        <FieldLegend variant="label">Kelas peserta</FieldLegend>
        <FieldDescription>
          Semua murid di kelas terpilih otomatis jadi peserta, termasuk murid
          yang masuk kelas belakangan.
        </FieldDescription>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pilih mapel di langkah Info dulu.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {classes.map((c) => (
              <label
                key={c.id}
                className="flex min-h-11 items-center gap-3 rounded-lg border px-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  className={CHECK}
                  checked={exam.classIds.includes(c.id)}
                  onChange={(e) =>
                    set(
                      "classIds",
                      e.target.checked
                        ? [...exam.classIds, c.id]
                        : exam.classIds.filter((id) => id !== c.id),
                    )
                  }
                />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.studentCount} murid
                </span>
              </label>
            ))}
          </div>
        )}
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Murid tambahan</FieldLegend>
        <FieldDescription>
          Murid dari kelas lain yang ikut ujian ini, mis. pindahan atau susulan.
        </FieldDescription>
        {exam.students.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {exam.students.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm"
              >
                {s.name}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label={`Hapus ${s.name}`}
                  onClick={() =>
                    set(
                      "students",
                      exam.students.filter((x) => x.id !== s.id),
                    )
                  }
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ExamStudentPicker
          selectedIds={new Set(exam.students.map((s) => s.id))}
          onAdd={(s) => set("students", [...exam.students, s])}
        />
      </FieldSet>
      <p className="text-sm" aria-live="polite">
        Perkiraan peserta: <b>{classStudents + exam.students.length}</b> murid
      </p>
    </FieldGroup>,

    // 3. Soal ------------------------------------------------------------------
    <div key="questions" className="flex flex-col gap-4">
      <p className="text-sm" aria-live="polite">
        {exam.questions.length} soal · Total poin{" "}
        <b>{Math.round(totalPoints * 100) / 100}</b>
      </p>
      {exam.questions.length > 0 && (
        <ol className="flex flex-col gap-2">
          {exam.questions.map((q, i) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
            >
              <span className="w-6 text-sm font-medium">{i + 1}.</span>
              <div className="min-w-40 flex-1">
                <p className="line-clamp-2 text-sm">{q.content}</p>
                <p className="text-xs text-muted-foreground">
                  {QUESTION_TYPE_LABEL[q.type]}
                </p>
              </div>
              <Input
                aria-label={`Poin soal no ${i + 1}`}
                inputMode="decimal"
                className="h-11 w-20"
                placeholder={String(q.bankPoints)}
                value={q.points}
                onChange={(e) =>
                  set(
                    "questions",
                    exam.questions.map((x) =>
                      x.id === q.id ? { ...x, points: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Naikkan soal no ${i + 1}`}
                disabled={i === 0}
                onClick={() => moveQuestion(i, -1)}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Turunkan soal no ${i + 1}`}
                disabled={i === exam.questions.length - 1}
                onClick={() => moveQuestion(i, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Hapus soal no ${i + 1}`}
                onClick={() =>
                  set(
                    "questions",
                    exam.questions.filter((x) => x.id !== q.id),
                  )
                }
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        Kosongkan kolom poin untuk memakai poin dari bank soal.
      </p>
      {exam.subjectId ? (
        <ExamQuestionPicker
          subjectId={exam.subjectId}
          selectedIds={new Set(exam.questions.map((q) => q.id))}
          onAdd={(q) => set("questions", [...exam.questions, q])}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pilih mapel di langkah Info dulu.
        </p>
      )}
    </div>,

    // 4. Pengaturan -----------------------------------------------------------
    <FieldGroup key="settings">
      {(
        [
          ["shuffleQuestions", "Acak urutan soal per murid"],
          ["shuffleOptions", "Acak urutan opsi jawaban"],
          ["requireFullscreen", "Wajib layar penuh (fullscreen)"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className={CHECK}
            checked={exam[key]}
            onChange={(e) => set(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
      <Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className={CHECK}
            checked={exam.limitTabs}
            onChange={(e) => set("limitTabs", e.target.checked)}
          />
          Kumpulkan otomatis bila murid pindah tab lebih dari
        </label>
        {exam.limitTabs && (
          <div className="flex items-center gap-2 pl-8">
            <Input
              aria-label="Batas pindah tab"
              inputMode="numeric"
              className="h-11 w-20"
              value={exam.maxTabSwitches}
              onChange={(e) => set("maxTabSwitches", e.target.value)}
            />
            <span className="text-sm">kali</span>
          </div>
        )}
        <FieldDescription>
          Pindah tab tetap dihitung dan tampil di monitoring walau tidak
          dibatasi.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="e-threshold">
          Ambang kemiripan essay (%)
        </FieldLabel>
        <Input
          id="e-threshold"
          inputMode="numeric"
          className="h-11 w-24"
          value={exam.essayThreshold}
          onChange={(e) => set("essayThreshold", e.target.value)}
        />
        <FieldDescription>
          Jawaban essay dengan kemiripan di bawah ambang ini masuk antrean
          koreksi manual.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="e-visibility">Tampilkan ke murid</FieldLabel>
        <select
          id="e-visibility"
          className={SELECT}
          value={exam.scoreVisibility}
          onChange={(e) =>
            set("scoreVisibility", e.target.value as ScoreVisibility)
          }
        >
          {Object.entries(VISIBILITY).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <FieldDescription>
          Berlaku setelah Anda mempublikasikan nilai.
        </FieldDescription>
      </Field>
    </FieldGroup>,
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {locked && (
        <p role="alert" className="rounded-lg border p-3 text-sm">
          Ujian ini sudah dikerjakan murid sehingga tidak bisa diubah lagi.
        </p>
      )}

      <nav aria-label="Langkah">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={step === i ? "step" : undefined}
                className="flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-1 text-xs aria-[current=step]:border-primary aria-[current=step]:bg-primary/5 aria-[current=step]:font-medium sm:flex-row sm:gap-2 sm:text-sm"
              >
                <span>{i + 1}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <fieldset disabled={locked || saving} className="min-w-0">
        {steps[step]}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => go(step - 1)}
          >
            Kembali
          </Button>
        )}
        {step < STEPS.length - 1 && (
          <Button type="button" className="h-11" onClick={() => go(step + 1)}>
            Lanjut
          </Button>
        )}
        {!locked && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={saving}
              onClick={() => save(false)}
            >
              {saving
                ? "Menyimpan..."
                : exam.status === "published"
                  ? "Jadikan draft"
                  : "Simpan draft"}
            </Button>
            {step === STEPS.length - 1 && (
              <ConfirmAction
                label={
                  exam.status === "published"
                    ? "Simpan & terbitkan"
                    : "Terbitkan"
                }
                title="Terbitkan ujian?"
                description={`${exam.questions.length} soal, total ${Math.round(totalPoints * 100) / 100} poin. Peserta mendapat notifikasi dan token ujian dibuat.`}
                confirmLabel="Terbitkan"
                onConfirm={() => save(true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
