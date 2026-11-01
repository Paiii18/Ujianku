import { useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

export type PickedQuestion = {
  id: string;
  type: Database["public"]["Enums"]["question_type"];
  content: string;
  bankPoints: number;
  points: string; // poin override; "" = pakai poin bank soal
};

const LIMIT = 20;

// Cari soal induk di bank soal sekolah (semua guru, F2.12) untuk mapel ujian.
// ponytail: 20 hasil teratas tanpa halaman berikutnya; persempit dengan kata kunci
export default function ExamQuestionPicker({
  subjectId,
  selectedIds,
  onAdd,
}: {
  subjectId: string;
  selectedIds: Set<string>;
  onAdd: (q: PickedQuestion) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedQuestion[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    let request = createClient()
      .from("questions")
      .select("id, type, content, points")
      .is("parent_id", null)
      .eq("subject_id", subjectId);
    const text = q.trim();
    if (text)
      request = request.ilike(
        "content",
        `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      );
    const { data } = await request
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    setBusy(false);
    setResults(
      (data ?? []).map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        bankPoints: Number(r.points),
        points: "",
      })),
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <form role="search" onSubmit={search} className="flex gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari teks soal (kosongkan untuk soal terbaru)"
          aria-label="Cari soal di bank soal"
          className="h-11"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-11"
          disabled={busy}
        >
          <Search aria-hidden /> Cari
        </Button>
      </form>
      {results && (
        <ul className="flex flex-col divide-y" aria-live="polite">
          {results.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              Tidak ada soal untuk mapel ini.
            </li>
          )}
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.content}</p>
                <p className="text-xs text-muted-foreground">
                  {QUESTION_TYPE_LABEL[r.type]} · {r.bankPoints} poin
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={selectedIds.has(r.id)}
                onClick={() => onAdd(r)}
              >
                {selectedIds.has(r.id) ? (
                  "Dipilih"
                ) : (
                  <>
                    <Plus aria-hidden /> Tambah
                  </>
                )}
              </Button>
            </li>
          ))}
          {results.length === LIMIT && (
            <li className="py-2 text-xs text-muted-foreground">
              Menampilkan {LIMIT} soal teratas. Persempit dengan kata kunci.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
