import { useState } from "react";
import { useRouter } from "next/router";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
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

// Editor soal Pilihan ganda & Benar/Salah (F2.9). Disimpan lewat RPC save_question (satu transaksi).

export type ChoiceType = "multiple_choice" | "true_false";
export type ChoiceQuestion = {
  id: string;
  type: ChoiceType;
  subjectId: string;
  content: string;
  imagePath: string | null;
  points: number;
  explanation: string;
  options: { content: string; imagePath: string | null; isCorrect: boolean }[];
};

const LABELS = ["A", "B", "C", "D", "E"];
const TF_OPTIONS = ["Benar", "Salah"];

const schema = z
  .object({
    subjectId: z.string().min(1, "Pilih mapel"),
    content: z
      .string()
      .trim()
      .min(1, "Teks soal wajib diisi")
      .max(10000, "Maksimal 10.000 karakter"),
    imagePath: z.string().nullable(),
    points: z.coerce
      .number<string>({ error: "Poin harus angka" })
      .gt(0, "Poin harus lebih dari 0")
      .max(1000, "Maksimal 1.000"),
    explanation: z.string().max(10000, "Maksimal 10.000 karakter"),
    correct: z.string().min(1, "Pilih kunci jawaban"),
    options: z
      .array(
        z
          .object({
            content: z.string().max(2000, "Maksimal 2.000 karakter"),
            imagePath: z.string().nullable(),
          })
          .refine((o) => o.content.trim() || o.imagePath, {
            message: "Isi teks atau gambar",
            path: ["content"],
          }),
      )
      .min(2)
      .max(5),
  })
  .refine((v) => LABELS.indexOf(v.correct) < v.options.length, {
    message: "Pilih kunci jawaban",
    path: ["correct"],
  });
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

// ponytail: <select>/<textarea> native, gaya disamakan dengan Input
const CONTROL =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export default function QuestionForm({
  question,
  subjects,
  folder,
  previews: initialPreviews,
}: {
  question: ChoiceQuestion;
  subjects: { id: string; code: string; name: string }[];
  folder: string; // `${tenantId}/${question.id}` — folder gambar (DEC-030)
  previews: Record<string, string>; // path → signed URL gambar yang sudah tersimpan
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState(initialPreviews);
  const isTF = question.type === "true_false";

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjectId: question.subjectId,
      content: question.content,
      imagePath: question.imagePath,
      points: String(question.points),
      explanation: question.explanation,
      correct: LABELS[question.options.findIndex((o) => o.isCorrect)] ?? "",
      options: question.options.map((o) => ({
        content: o.content,
        imagePath: o.imagePath,
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "options",
  });
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
      p_options: values.options.map((o, i) => ({
        label: LABELS[i],
        content: o.content,
        image_path: o.imagePath,
        is_correct: LABELS[i] === values.correct,
      })),
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
            {isTF ? "Pernyataan" : "Teks soal"}
          </FieldLabel>
          <textarea
            id="q-content"
            rows={4}
            className={CONTROL}
            aria-invalid={!!errors.content}
            {...register("content")}
          />
          <FieldError errors={[errors.content]} />
          <ImageField
            folder={folder}
            path={imagePath}
            previewUrl={imagePath ? (previews[imagePath] ?? null) : null}
            label="Gambar soal"
            onChange={(p, u) => setImage("imagePath", p, u)}
          />
        </Field>

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
                        setValue("correct", LABELS[i], { shouldValidate: true })
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
