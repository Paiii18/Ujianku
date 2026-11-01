import { Input } from "@/components/ui/input";
import type { Answer, Answers, PaperQuestion } from "@/lib/examPaper";

const CONTROL =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm";
const LABELS = ["A", "B", "C", "D", "E"];

// Satu soal di halaman ujian murid (F3.8): 6 tipe, jawaban terkendali dari ExamRunner.
// images: path Storage → signed URL. Seluruh input nonaktif lewat <fieldset disabled> saat waktu habis.
export default function ExamQuestion({
  question: q,
  number,
  answers,
  images,
  disabled,
  onAnswer,
}: {
  question: PaperQuestion;
  number: number;
  answers: Answers;
  images: Record<string, string>;
  disabled: boolean;
  onAnswer: (id: string, answer: Answer) => void;
}) {
  const a = answers[q.id];
  const img = (path: string | null) => (path ? images[path] : undefined);

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
        <span className="text-lg font-semibold">Soal {number}</span>
        <span className="text-sm text-muted-foreground">{q.points} poin</span>
      </legend>
      <p className="whitespace-pre-wrap">{q.content}</p>
      {img(q.image_path) && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL Storage, bukan aset statis
        <img
          src={img(q.image_path)}
          alt={`Gambar soal ${number}`}
          className="max-h-80 w-fit max-w-full rounded-md border"
        />
      )}

      {(q.type === "multiple_choice" || q.type === "true_false") && (
        <div
          role="radiogroup"
          aria-label="Pilihan jawaban"
          className="flex flex-col gap-2"
        >
          {q.options.map((o, i) => (
            <label
              key={o.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name={q.id}
                checked={a?.selected_option_id === o.id}
                onChange={() => onAnswer(q.id, { selected_option_id: o.id })}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-col gap-2">
                <span className="break-words">
                  {q.type === "multiple_choice" && (
                    <span className="mr-2 font-medium">{LABELS[i]}.</span>
                  )}
                  {o.content}
                </span>
                {img(o.image_path) && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL Storage
                  <img
                    src={img(o.image_path)}
                    alt={`Gambar opsi ${LABELS[i]}`}
                    className="max-h-40 w-fit max-w-full rounded-md border"
                  />
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      {q.type === "short_answer" && (
        <Input
          aria-label="Jawaban"
          placeholder="Ketik jawaban"
          className="h-11"
          maxLength={500}
          autoComplete="off"
          value={a?.answer_text ?? ""}
          onChange={(e) => onAnswer(q.id, { answer_text: e.target.value })}
        />
      )}

      {q.type === "matching" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Pilih pasangan yang tepat untuk setiap pernyataan.
          </p>
          {q.lefts.map((left) => (
            <label
              key={left.id}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="font-medium break-words sm:w-1/2">
                {left.text}
              </span>
              <select
                className={`${CONTROL} h-11 sm:w-1/2`}
                value={a?.answer_json?.[left.id] ?? ""}
                onChange={(e) => {
                  const next = { ...a?.answer_json };
                  if (e.target.value) next[left.id] = e.target.value;
                  else delete next[left.id];
                  onAnswer(q.id, { answer_json: next });
                }}
              >
                <option value="">— Pilih pasangan —</option>
                {q.rights.map((right) => (
                  <option key={right.key} value={right.key}>
                    {right.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {q.type === "essay" && (
        <textarea
          aria-label="Jawaban"
          rows={6}
          maxLength={20000}
          className={CONTROL}
          placeholder="Tulis jawaban"
          value={a?.answer_text ?? ""}
          onChange={(e) => onAnswer(q.id, { answer_text: e.target.value })}
        />
      )}

      {q.type === "multi_essay" && (
        <ol className="flex flex-col gap-4">
          {q.subs.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap">
                <span className="font-medium">{i + 1}. </span>
                {s.content}{" "}
                <span className="text-sm text-muted-foreground">
                  ({s.points} poin)
                </span>
              </p>
              <textarea
                aria-label={`Jawaban bagian ${i + 1}`}
                rows={4}
                maxLength={20000}
                className={CONTROL}
                value={answers[s.id]?.answer_text ?? ""}
                onChange={(e) =>
                  onAnswer(s.id, { answer_text: e.target.value })
                }
              />
            </li>
          ))}
        </ol>
      )}
    </fieldset>
  );
}
