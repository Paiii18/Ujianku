import { useState } from "react";
import { useRouter } from "next/router";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
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

type Candidate = { id: string; full_name: string; nis_nip: string | null };

// Pilih murid yang belum punya kelas di tahun ajaran ini (RPC students_without_class),
// lalu masukkan sekaligus. tenant_id & academic_year_id diisi trigger dari kelas.
export default function AddStudentsDialog({
  classId,
  className,
  academicYearId,
}: {
  classId: string;
  className: string;
  academicYearId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function search(query: string) {
    const { data, error } = await createClient().rpc("students_without_class", {
      p_academic_year_id: academicYearId,
      p_q: query,
    });
    if (error) toast.error("Gagal memuat daftar murid");
    setCandidates(data ?? []);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const { error } = await createClient()
      .from("class_students")
      .insert(
        [...selected].map((student_id) => ({
          class_id: classId,
          student_id,
          academic_year_id: academicYearId,
        })),
      );
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Sebagian murid sudah punya kelas di tahun ajaran ini. Muat ulang daftar lalu coba lagi."
          : "Gagal menambahkan murid",
      );
      return;
    }
    toast.success(`${selected.size} murid masuk ${className}`);
    setOpen(false);
    await router.replace(router.asPath);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void search("");
        else {
          setQ("");
          setCandidates(null);
          setSelected(new Set());
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11">
          <UserPlus aria-hidden /> Tambah murid
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah murid ke {className}</DialogTitle>
          <DialogDescription>
            Hanya murid aktif yang belum punya kelas di tahun ajaran ini.
          </DialogDescription>
        </DialogHeader>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(q);
          }}
        >
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau NIS"
            aria-label="Cari nama atau NIS"
            className="h-11"
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
          >
            <Search aria-hidden />
            <span className="sr-only">Cari</span>
          </Button>
        </form>

        <div className="min-h-32 flex-1 overflow-y-auto rounded-lg border">
          {candidates === null ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat...</p>
          ) : candidates.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Tidak ada murid tanpa kelas{q && " yang cocok"}.
            </p>
          ) : (
            <ul className="divide-y">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {c.nis_nip}
                    </span>
                    <span>{c.full_name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {candidates?.length === 50 && (
          <p className="text-xs text-muted-foreground">
            Menampilkan 50 murid pertama. Persempit dengan pencarian.
          </p>
        )}

        <Button
          className="h-11 w-full"
          disabled={selected.size === 0 || saving}
          onClick={save}
        >
          {saving ? "Menyimpan..." : `Tambahkan ${selected.size} murid`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
