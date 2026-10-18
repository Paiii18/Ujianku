import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

// Pratinjau soal seperti yang dilihat murid: tanpa tanda kunci jawaban.
// Data dimuat saat dialog dibuka (guru boleh membaca soal sekolahnya, RLS F2.7).
// Sisi kanan menjodohkan diurutkan per right_key (acak), sama seperti nanti di ujian (F3.7).

type Preview = {
  type: Database["public"]["Enums"]["question_type"];
  content: string;
  image: string | null;
  points: number;
  options: { label: string; content: string; image: string | null }[];
  lefts: string[];
  rights: string[];
  subs: { content: string; points: number }[];
};

const CONTROL =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

async function loadPreview(id: string): Promise<Preview | null> {
  const supabase = createClient();
  const { data: q } = await supabase
    .from("questions")
    .select(
      "type, content, image_path, points, question_options(label, content, image_path), question_pairs(left_text, right_text, right_key, position)",
    )
    .eq("id", id)
    .order("label", { referencedTable: "question_options" })
    .maybeSingle();
  if (!q) return null;
  const { data: subs } =
    q.type === "multi_essay"
      ? await supabase
          .from("questions")
          .select("content, points")
          .eq("parent_id", id)
          .order("position")
      : { data: [] };

  const paths = [
    q.image_path,
    ...q.question_options.map((o) => o.image_path),
  ].filter((p): p is string => !!p);
  const { data: signed } = paths.length
    ? await supabase.storage
        .from("question-images")
        .createSignedUrls(paths, 60 * 10)
    : { data: [] };
  const url = (p: string | null) =>
    (p && signed?.find((s) => s.path === p)?.signedUrl) || null;

  const pairs = q.question_pairs;
  return {
    type: q.type,
    content: q.content,
    image: url(q.image_path),
    points: Number(q.points),
    options: q.question_options.map((o) => ({
      label: o.label,
      content: o.content,
      image: url(o.image_path),
    })),
    lefts: [...pairs]
      .sort((a, b) => a.position - b.position)
      .map((p) => p.left_text),
    rights: [...pairs]
      .sort((a, b) => a.right_key.localeCompare(b.right_key))
      .map((p) => p.right_text),
    subs: (subs ?? []).map((s) => ({
      content: s.content,
      points: Number(s.points),
    })),
  };
}

export default function QuestionPreview({
  questionId,
}: {
  questionId: string;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);

  async function onOpenChange(open: boolean) {
    if (!open || data) return;
    setFailed(false);
    const result = await loadPreview(questionId);
    if (result) setData(result);
    else setFailed(true);
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-11">
          <Eye aria-hidden />
          <span className="sr-only">Pratinjau</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pratinjau tampilan murid</DialogTitle>
          <DialogDescription>
            Kunci jawaban tidak ditampilkan. Jawaban di sini tidak disimpan.
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-sm text-destructive">Soal gagal dimuat.</p>
        ) : !data ? (
          <Loader2
            aria-label="Memuat"
            className="mx-auto size-6 animate-spin text-muted-foreground"
          />
        ) : (
          <PreviewBody data={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ data }: { data: Preview }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{data.points} poin</p>
      <p className="whitespace-pre-wrap">{data.content}</p>
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL Storage, bukan aset statis
        <img
          src={data.image}
          alt="Gambar soal"
          className="max-h-80 w-fit rounded-md border"
        />
      )}

      {(data.type === "multiple_choice" || data.type === "true_false") && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Pilihan jawaban</legend>
          {data.options.map((o) => (
            <label
              key={o.label}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="preview"
                className="mt-1 size-5 accent-primary"
              />
              <span className="flex flex-col gap-2">
                <span>
                  {data.type === "multiple_choice" && (
                    <span className="mr-2 font-medium">{o.label}.</span>
                  )}
                  {o.content}
                </span>
                {o.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL Storage
                  <img
                    src={o.image}
                    alt={`Gambar opsi ${o.label}`}
                    className="max-h-40 w-fit rounded-md border"
                  />
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {data.type === "short_answer" && (
        <Input
          aria-label="Jawaban"
          placeholder="Ketik jawaban"
          className="h-11"
        />
      )}

      {data.type === "matching" && (
        <div className="flex flex-col gap-3">
          {data.lefts.map((left, i) => (
            <label
              key={i}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="font-medium sm:w-1/2">{left}</span>
              <select className={`${CONTROL} h-11 sm:w-1/2`} defaultValue="">
                <option value="">— Pilih pasangan —</option>
                {data.rights.map((right) => (
                  <option key={right}>{right}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {data.type === "essay" && (
        <textarea
          aria-label="Jawaban"
          rows={5}
          className={CONTROL}
          placeholder="Tulis jawaban"
        />
      )}

      {data.type === "multi_essay" && (
        <ol className="flex flex-col gap-4">
          {data.subs.map((s, i) => (
            <li key={i} className="flex flex-col gap-2">
              <p className="whitespace-pre-wrap">
                <span className="font-medium">{i + 1}. </span>
                {s.content}{" "}
                <span className="text-sm text-muted-foreground">
                  ({s.points} poin)
                </span>
              </p>
              <textarea
                aria-label={`Jawaban sub-soal ${i + 1}`}
                rows={3}
                className={CONTROL}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
