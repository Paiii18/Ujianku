import { useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export type PickedStudent = { id: string; name: string; nis: string | null };

// Cari murid aktif sekolah (nama atau awalan NIS) untuk ditambahkan perorangan.
export default function ExamStudentPicker({
  selectedIds,
  onAdd,
}: {
  selectedIds: Set<string>;
  onAdd: (s: PickedStudent) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedStudent[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    // Karakter khusus filter PostgREST (or=...) dibuang
    const text = q.replace(/[\\%_,()*."]/g, " ").trim();
    if (text.length < 2) return setResults([]);
    setBusy(true);
    const { data } = await createClient()
      .from("profiles")
      .select("id, full_name, nis_nip")
      .eq("role", "student")
      .eq("is_active", true)
      .or(`full_name.ilike.%${text}%,nis_nip.ilike.${text}%`)
      .order("full_name")
      .limit(20);
    setBusy(false);
    setResults(
      (data ?? []).map((s) => ({
        id: s.id,
        name: s.full_name,
        nis: s.nis_nip,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form role="search" onSubmit={search} className="flex gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nama atau NIS (min. 2 huruf)"
          aria-label="Cari murid"
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
              Murid tidak ditemukan.
            </li>
          )}
          {results.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm">
                {s.name} <span className="text-muted-foreground">{s.nis}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={selectedIds.has(s.id)}
                onClick={() => onAdd(s)}
              >
                {selectedIds.has(s.id) ? (
                  "Dipilih"
                ) : (
                  <>
                    <Plus aria-hidden /> Tambah
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
