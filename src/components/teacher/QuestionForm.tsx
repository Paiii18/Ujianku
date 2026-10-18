import { useState } from "react";
import { useRouter } from "next/router";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowLeftRight, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ImageField from "@/components/teacher/ImageField";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

// Editor soal PG & Benar/Salah (F2.9), Isian & Menjodohkan (F2.10), Essay & Multi essay (F2.11).
// Disimpan lewat RPC save_question (satu transaksi); validasi akhir tetap di RPC.

export const EDITABLE_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "matching",
  "essay",
  "multi_essay",
] as const;
export type EditableType = (typeof EDITABLE_TYPES)[number];
export type EditorQuestion = {
  id: string;
  type: EditableType;
  subjectId: string;
  content: string;
  imagePath: string | null;
  points: number;
  explanation: string;
  options: { content: string; imagePath: string | null; isCorrect: boolean }[];
  answers: string[]; // isian
  pairs: { left: string; right: string }[]; // menjodohkan
  answerKey: string; // essay: jawaban acuan
  keywords: string[]; // essay: kata kunci
  subs: EditorSub[]; // multi essay
};
export type EditorSub = {
  id: string | null; // null = sub-soal baru (id dibuat RPC)
  content: string;
  answerKey: string;
  keywords: string[];
  points: number;
};

const LABELS = ["A", "B", "C", "D", "E"];
const TF_OPTIONS = ["Benar", "Salah"];
const MAX_ANSWERS = 10;
const MAX_PAIRS = 10;
const MAX_SUBS = 20;
const MAX_KEYWORDS = 20;

// Kata kunci diketik dipisah koma (sama dengan kolom kata_kunci template Excel)
const splitKeywords = (s: string) =>
  s
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

// Sama dengan pembanding duplikat di RPC: huruf kecil, trim, spasi tunggal
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Tandai teks kosong & kembar (setelah normalisasi) di satu daftar
function checkList(
  ctx: z.RefinementCtx,
  values: string[],
  path: (i: number) => (string | number)[],
  emptyMsg: string,
) {
  const seen = new Set<string>();
  values.forEach((v, i) => {
    const key = norm(v);
    if (!key)
      ctx.addIssue({ code: "custom", message: emptyMsg, path: path(i) });
    else if (seen.has(key))
      ctx.addIssue({
        code: "custom",
        message: "Tidak boleh sama",
        path: path(i),
      });
    seen.add(key);
  });
}

// Jawaban acuan wajib + batas kata kunci (essay & tiap sub-soal)
function checkEssay(
  ctx: z.RefinementCtx,
  answerKey: string,
  keywords: string,
  path: (string | number)[],
) {
  if (!answerKey.trim())
    ctx.addIssue({
      code: "custom",
      message: "Jawaban acuan wajib diisi",
      path: [...path, "answerKey"],
    });
  const words = splitKeywords(keywords);
  if (words.length > MAX_KEYWORDS || words.some((k) => k.length > 50))
    ctx.addIssue({
      code: "custom",
      message: `Maksimal ${MAX_KEYWORDS} kata kunci, masing-masing 50 karakter`,
      path: [...path, "keywords"],
    });
}

const pointsField = z.coerce
  .number<string>({ error: "Poin harus angka" })
  .gt(0, "Poin harus lebih dari 0")
  .max(1000, "Maksimal 1.000");

const makeSchema = (type: EditableType) =>
  z
    .object({
      subjectId: z.string().min(1, "Pilih mapel"),
      content: z
        .string()
        .trim()
        .min(1, "Teks soal wajib diisi")
        .max(10000, "Maksimal 10.000 karakter"),
      imagePath: z.string().nullable(),
      points: pointsField,
      explanation: z.string().max(10000, "Maksimal 10.000 karakter"),
      correct: z.string(),
      options: z.array(
        z.object({
          content: z.string().max(2000, "Maksimal 2.000 karakter"),
          imagePath: z.string().nullable(),
        }),
      ),
      answers: z.array(
        z.object({ value: z.string().max(200, "Maksimal 200 karakter") }),
      ),
      pairs: z.array(
        z.object({
          left: z.string().max(500, "Maksimal 500 karakter"),
          right: z.string().max(500, "Maksimal 500 karakter"),
        }),
      ),
      answerKey: z.string().max(10000, "Maksimal 10.000 karakter"),
      keywords: z.string(),
      subs: z.array(
        z.object({
          qid: z.string().nullable(), // bukan `id`: nama itu dipakai useFieldArray
          content: z.string().max(10000, "Maksimal 10.000 karakter"),
          answerKey: z.string().max(10000, "Maksimal 10.000 karakter"),
          keywords: z.string(),
          points: pointsField,
        }),
      ),
    })
    .superRefine((v, ctx) => {
      if (type === "multiple_choice" || type === "true_false") {
        v.options.forEach((o, i) => {
          if (!o.content.trim() && !o.imagePath)
            ctx.addIssue({
              code: "custom",
              message: "Isi teks atau gambar",
              path: ["options", i, "content"],
            });
        });
        const key = LABELS.indexOf(v.correct);
        if (key < 0 || key >= v.options.length)
          ctx.addIssue({
            code: "custom",
            message: "Pilih kunci jawaban",
            path: ["correct"],
          });
      } else if (type === "short_answer") {
        checkList(
          ctx,
          v.answers.map((a) => a.value),
          (i) => ["answers", i, "value"],
          "Jawaban wajib diisi",
        );
      } else if (type === "essay") {
        checkEssay(ctx, v.answerKey, v.keywords, []);
      } else if (type === "multi_essay") {
        v.subs.forEach((sub, i) => {
          if (!sub.content.trim())
            ctx.addIssue({
              code: "custom",
              message: "Teks sub-soal wajib diisi",
              path: ["subs", i, "content"],
            });
          checkEssay(ctx, sub.answerKey, sub.keywords, ["subs", i]);
        });
      } else {
        checkList(
          ctx,
          v.pairs.map((p) => p.left),
          (i) => ["pairs", i, "left"],
          "Sisi kiri wajib diisi",
        );
        checkList(
          ctx,
          v.pairs.map((p) => p.right),
          (i) => ["pairs", i, "right"],
          "Sisi kanan wajib diisi",
        );
      }
    });
type Schema = ReturnType<typeof makeSchema>;
type Values = z.input<Schema>;
type Output = z.output<Schema>;

// ponytail: <select>/<textarea> native, gaya disamakan dengan Input
const CONTROL =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export default function QuestionForm({
  question,
  subjects,
  folder,
  previews: initialPreviews,
}: {
  question: EditorQuestion;
  subjects: { id: string; code: string; name: string }[];
  folder: string; // `${tenantId}/${question.id}` — folder gambar (DEC-030)
  previews: Record<string, string>; // path → signed URL gambar yang sudah tersimpan
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState(initialPreviews);
  const isTF = question.type === "true_false";
  const isChoice = isTF || question.type === "multiple_choice";
  const isMulti = question.type === "multi_essay";

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(makeSchema(question.type)),
    defaultValues: {
      subjectId: question.subjectId,
      content: question.content,
      imagePath: question.imagePath,
      // Multi essay: poin induk dihitung RPC dari sub-soal; field poin disembunyikan
      points: isMulti ? "1" : String(question.points),
      explanation: question.explanation,
      correct: LABELS[question.options.findIndex((o) => o.isCorrect)] ?? "",
      options: question.options.map((o) => ({
        content: o.content,
        imagePath: o.imagePath,
      })),
      answers: question.answers.map((value) => ({ value })),
      pairs: question.pairs,
      answerKey: question.answerKey,
      keywords: question.keywords.join(", "),
      subs: question.subs.map((sub) => ({
        qid: sub.id,
        content: sub.content,
        answerKey: sub.answerKey,
        keywords: sub.keywords.join(", "),
        points: String(sub.points),
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "options",
  });
  const answerFields = useFieldArray({ control, name: "answers" });
  const pairFields = useFieldArray({ control, name: "pairs" });
  const subFields = useFieldArray({ control, name: "subs" });
  const subs = useWatch({ control, name: "subs" });
  const totalPoints = subs.reduce(
    (sum, sub) => sum + (Number(sub.points) || 0),
    0,
  );
  const imagePath = useWatch({ control, name: "imagePath" });
  const options = useWatch({ control, name: "options" });
  const correct = useWatch({ control, name: "correct" });

  function setImage(
    name: "imagePath" | `options.${number}.imagePath`,
    path: string | null,
    url: string | null,
  ) {
    setValue(name, path, { shouldDirty: true });
    if (path && url) setPreviews((p) => ({ ...p, [path]: url }));
  }

  function removeOption(index: number) {
    // Kunci ikut bergeser bila opsi di atasnya dihapus; kunci yang dihapus dikosongkan
    const key = LABELS.indexOf(correct);
    remove(index);
    if (key === index) setValue("correct", "");
    else if (key > index) setValue("correct", LABELS[key - 1]);
  }

  async function onSubmit(values: Output) {
    setError(null);
    const { error } = await createClient().rpc("save_question", {
      p_id: question.id,
      p_subject_id: values.subjectId,
      p_type: question.type,
      p_content: values.content,
      p_image_path: values.imagePath ?? "", // RPC: "" → null
      p_points: values.points,
      p_explanation: values.explanation,
      p_options: isChoice
        ? values.options.map((o, i) => ({
            label: LABELS[i],
            content: o.content,
            image_path: o.imagePath,
            is_correct: LABELS[i] === values.correct,
          }))
        : [],
      p_answers:
        question.type === "short_answer"
          ? values.answers.map((a) => a.value)
          : [],
      p_pairs: question.type === "matching" ? values.pairs : [],
      p_answer_key: question.type === "essay" ? values.answerKey : "",
      p_keywords:
        question.type === "essay" ? splitKeywords(values.keywords) : [],
      p_subs: isMulti
        ? values.subs.map((sub) => ({
            id: sub.qid,
            content: sub.content,
            answer_key: sub.answerKey,
            keywords: splitKeywords(sub.keywords),
            points: sub.points,
          }))
        : [],
    });
    if (error) {
      // 22023 = pesan validasi dari RPC, aman ditampilkan
      setError(
        error.code === "22023" ? error.message : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    toast.success("Soal disimpan");
    await router.push("/teacher/questions");
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-3xl flex-col gap-6"
    >
      <FieldGroup>
        <Field data-invalid={!!errors.subjectId}>
          <FieldLabel htmlFor="q-subject">Mapel</FieldLabel>
          <select
            id="q-subject"
            className={`${CONTROL} h-11`}
            aria-invalid={!!errors.subjectId}
            {...register("subjectId")}
          >
            <option value="">— Pilih mapel —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <FieldError errors={[errors.subjectId]} />
        </Field>

        <Field data-invalid={!!errors.content}>
          <FieldLabel htmlFor="q-content">
            {isTF ? "Pernyataan" : isMulti ? "Teks pengantar" : "Teks soal"}
          </FieldLabel>
          <textarea
            id="q-content"
            rows={4}
            className={CONTROL}
            aria-invalid={!!errors.content}
            {...register("content")}
          />
          {isMulti && (
            <FieldDescription>
              Bacaan atau stimulus yang menjadi dasar semua sub-soal.
            </FieldDescription>
          )}
          <FieldError errors={[errors.content]} />
          <ImageField
            folder={folder}
            path={imagePath}
            previewUrl={imagePath ? (previews[imagePath] ?? null) : null}
            label="Gambar soal"
            onChange={(p, u) => setImage("imagePath", p, u)}
          />
        </Field>

        {isChoice && (
          <FieldSet data-invalid={!!errors.correct}>
            <FieldLegend variant="label">
              {isTF ? "Kunci jawaban" : "Opsi jawaban & kunci"}
            </FieldLegend>
            <FieldDescription>
              {isTF
                ? "Pilih apakah pernyataan di atas benar atau salah."
                : "2–5 opsi. Pilih tepat satu opsi sebagai kunci."}
            </FieldDescription>
            <div className="flex flex-col gap-3">
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 has-[:checked]:border-success has-[:checked]:bg-success/5"
                >
                  <div className="flex items-center gap-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
                      <input
                        type="radio"
                        value={LABELS[i]}
                        className="size-5 accent-success"
                        aria-label={`Kunci: ${isTF ? TF_OPTIONS[i] : `opsi ${LABELS[i]}`}`}
                        // Terkontrol: label opsi bergeser saat opsi dihapus, radio ter-register tidak ikut
                        name="correct"
                        checked={correct === LABELS[i]}
                        onChange={() =>
                          setValue("correct", LABELS[i], {
                            shouldValidate: true,
                          })
                        }
                      />
                      {isTF ? TF_OPTIONS[i] : LABELS[i]}
                    </label>
                    {correct === LABELS[i] && (
                      <span className="text-xs font-medium text-success">
                        Kunci
                      </span>
                    )}
                    {!isTF && fields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-11"
                        aria-label={`Hapus opsi ${LABELS[i]}`}
                        onClick={() => removeOption(i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  {!isTF && (
                    <>
                      <Input
                        aria-label={`Teks opsi ${LABELS[i]}`}
                        placeholder={`Teks opsi ${LABELS[i]}`}
                        className="h-11"
                        aria-invalid={!!errors.options?.[i]?.content}
                        {...register(`options.${i}.content`)}
                      />
                      <FieldError errors={[errors.options?.[i]?.content]} />
                      <ImageField
                        folder={folder}
                        path={options[i]?.imagePath ?? null}
                        previewUrl={
                          options[i]?.imagePath
                            ? (previews[options[i].imagePath] ?? null)
                            : null
                        }
                        label={`Gambar opsi ${LABELS[i]}`}
                        onChange={(p, u) =>
                          setImage(`options.${i}.imagePath`, p, u)
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            {!isTF && fields.length < 5 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() => append({ content: "", imagePath: null })}
              >
                <Plus aria-hidden /> Tambah opsi
              </Button>
            )}
            <FieldError errors={[errors.correct]} />
          </FieldSet>
        )}

        {question.type === "short_answer" && (
          <FieldSet>
            <FieldLegend variant="label">Jawaban yang diterima</FieldLegend>
            <FieldDescription>
              Jawaban murid benar bila cocok dengan salah satu jawaban ini.
              Huruf besar/kecil dan spasi berlebih diabaikan. Maksimal{" "}
              {MAX_ANSWERS}.
            </FieldDescription>
            <div className="flex flex-col gap-2">
              {answerFields.fields.map((f, i) => (
                <div key={f.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Jawaban diterima ${i + 1}`}
                      placeholder={`Jawaban ${i + 1}`}
                      className="h-11"
                      aria-invalid={!!errors.answers?.[i]?.value}
                      {...register(`answers.${i}.value`)}
                    />
                    {answerFields.fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label={`Hapus jawaban ${i + 1}`}
                        onClick={() => answerFields.remove(i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <FieldError errors={[errors.answers?.[i]?.value]} />
                </div>
              ))}
            </div>
            {answerFields.fields.length < MAX_ANSWERS && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() => answerFields.append({ value: "" })}
              >
                <Plus aria-hidden /> Tambah jawaban
              </Button>
            )}
          </FieldSet>
        )}

        {question.type === "matching" && (
          <FieldSet>
            <FieldLegend variant="label">Pasangan</FieldLegend>
            <FieldDescription>
              2–{MAX_PAIRS} pasangan kiri ↔ kanan. Saat ujian, urutan sisi kanan
              diacak.
            </FieldDescription>
            <div className="flex flex-col gap-3">
              {pairFields.fields.map((f, i) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Pasangan {i + 1}</span>
                    {pairFields.fields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-11"
                        aria-label={`Hapus pasangan ${i + 1}`}
                        onClick={() => pairFields.remove(i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex flex-1 flex-col gap-1">
                      <Input
                        aria-label={`Kiri pasangan ${i + 1}`}
                        placeholder="Kiri (mis. Jakarta)"
                        className="h-11"
                        aria-invalid={!!errors.pairs?.[i]?.left}
                        {...register(`pairs.${i}.left`)}
                      />
                      <FieldError errors={[errors.pairs?.[i]?.left]} />
                    </div>
                    <ArrowLeftRight
                      aria-hidden
                      className="mx-auto size-5 shrink-0 text-muted-foreground sm:mt-3"
                    />
                    <div className="flex flex-1 flex-col gap-1">
                      <Input
                        aria-label={`Kanan pasangan ${i + 1}`}
                        placeholder="Kanan (mis. Indonesia)"
                        className="h-11"
                        aria-invalid={!!errors.pairs?.[i]?.right}
                        {...register(`pairs.${i}.right`)}
                      />
                      <FieldError errors={[errors.pairs?.[i]?.right]} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pairFields.fields.length < MAX_PAIRS && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() => pairFields.append({ left: "", right: "" })}
              >
                <Plus aria-hidden /> Tambah pasangan
              </Button>
            )}
          </FieldSet>
        )}

        {question.type === "essay" && (
          <>
            <Field data-invalid={!!errors.answerKey}>
              <FieldLabel htmlFor="q-answer-key">Jawaban acuan</FieldLabel>
              <textarea
                id="q-answer-key"
                rows={4}
                className={CONTROL}
                aria-invalid={!!errors.answerKey}
                {...register("answerKey")}
              />
              <FieldDescription>
                Jawaban murid dinilai dari kemiripannya dengan teks ini; yang
                kurang mirip masuk antrean koreksi.
              </FieldDescription>
              <FieldError errors={[errors.answerKey]} />
            </Field>
            <Field data-invalid={!!errors.keywords}>
              <FieldLabel htmlFor="q-keywords">
                Kata kunci (opsional)
              </FieldLabel>
              <Input
                id="q-keywords"
                placeholder="klorofil, cahaya matahari"
                className="h-11"
                aria-invalid={!!errors.keywords}
                {...register("keywords")}
              />
              <FieldDescription>Pisahkan dengan koma.</FieldDescription>
              <FieldError errors={[errors.keywords]} />
            </Field>
          </>
        )}

        {isMulti && (
          <FieldSet>
            <FieldLegend variant="label">Sub-soal</FieldLegend>
            <FieldDescription>
              2–{MAX_SUBS} sub-soal uraian. Total poin:{" "}
              <strong className="text-foreground">{totalPoints}</strong>
            </FieldDescription>
            <div className="flex flex-col gap-3">
              {subFields.fields.map((f, i) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-1">
                    <span className="mr-auto font-medium">
                      Sub-soal {i + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Naikkan sub-soal ${i + 1}`}
                      disabled={i === 0}
                      onClick={() => subFields.move(i, i - 1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Turunkan sub-soal ${i + 1}`}
                      disabled={i === subFields.fields.length - 1}
                      onClick={() => subFields.move(i, i + 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    {subFields.fields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={`Hapus sub-soal ${i + 1}`}
                        onClick={() => subFields.remove(i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <Field data-invalid={!!errors.subs?.[i]?.content}>
                    <FieldLabel htmlFor={`sub-${i}-content`}>
                      Pertanyaan
                    </FieldLabel>
                    <textarea
                      id={`sub-${i}-content`}
                      rows={2}
                      className={CONTROL}
                      aria-invalid={!!errors.subs?.[i]?.content}
                      {...register(`subs.${i}.content`)}
                    />
                    <FieldError errors={[errors.subs?.[i]?.content]} />
                  </Field>
                  <Field data-invalid={!!errors.subs?.[i]?.answerKey}>
                    <FieldLabel htmlFor={`sub-${i}-answer`}>
                      Jawaban acuan
                    </FieldLabel>
                    <textarea
                      id={`sub-${i}-answer`}
                      rows={3}
                      className={CONTROL}
                      aria-invalid={!!errors.subs?.[i]?.answerKey}
                      {...register(`subs.${i}.answerKey`)}
                    />
                    <FieldError errors={[errors.subs?.[i]?.answerKey]} />
                  </Field>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Field
                      data-invalid={!!errors.subs?.[i]?.keywords}
                      className="flex-1"
                    >
                      <FieldLabel htmlFor={`sub-${i}-keywords`}>
                        Kata kunci (opsional, pisah koma)
                      </FieldLabel>
                      <Input
                        id={`sub-${i}-keywords`}
                        className="h-11"
                        aria-invalid={!!errors.subs?.[i]?.keywords}
                        {...register(`subs.${i}.keywords`)}
                      />
                      <FieldError errors={[errors.subs?.[i]?.keywords]} />
                    </Field>
                    <Field
                      data-invalid={!!errors.subs?.[i]?.points}
                      className="sm:max-w-32"
                    >
                      <FieldLabel htmlFor={`sub-${i}-points`}>Poin</FieldLabel>
                      <Input
                        id={`sub-${i}-points`}
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0.5"
                        className="h-11"
                        aria-invalid={!!errors.subs?.[i]?.points}
                        {...register(`subs.${i}.points`)}
                      />
                      <FieldError errors={[errors.subs?.[i]?.points]} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            {subFields.fields.length < MAX_SUBS && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit"
                onClick={() =>
                  subFields.append({
                    qid: null,
                    content: "",
                    answerKey: "",
                    keywords: "",
                    points: "1",
                  })
                }
              >
                <Plus aria-hidden /> Tambah sub-soal
              </Button>
            )}
          </FieldSet>
        )}

        {!isMulti && (
          <Field data-invalid={!!errors.points} className="sm:max-w-40">
            <FieldLabel htmlFor="q-points">Poin</FieldLabel>
            <Input
              id="q-points"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              className="h-11"
              aria-invalid={!!errors.points}
              {...register("points")}
            />
            <FieldError errors={[errors.points]} />
          </Field>
        )}

        <Field data-invalid={!!errors.explanation}>
          <FieldLabel htmlFor="q-explanation">Pembahasan (opsional)</FieldLabel>
          <textarea
            id="q-explanation"
            rows={3}
            className={CONTROL}
            {...register("explanation")}
          />
          <FieldDescription>
            Tampil ke murid setelah nilai dipublikasikan.
          </FieldDescription>
          <FieldError errors={[errors.explanation]} />
        </Field>
      </FieldGroup>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11 min-w-32" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Simpan soal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => router.back()}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
