import { useState } from "react";
import { useRouter } from "next/router";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

// Duplikat soal (milik sendiri atau guru lain) menjadi soal baru milik sendiri, lalu buka editornya.
// Urutan: id baru → salin file gambar ke folder baru (Storage copy) → RPC duplicate_question.
// ponytail: RPC gagal setelah file tersalin = file tertinggal di folder baru (sama seperti DEC-030).
export default function DuplicateQuestionButton({
  questionId,
}: {
  questionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const { data: src } = await supabase
      .from("questions")
      .select("tenant_id, image_path, question_options(image_path)")
      .eq("id", questionId)
      .maybeSingle();
    if (!src) {
      setBusy(false);
      toast.error("Soal tidak ditemukan");
      return;
    }
    const from = `${src.tenant_id}/${questionId}/`;
    const paths = new Set(
      [src.image_path, ...src.question_options.map((o) => o.image_path)].filter(
        (p): p is string => !!p?.startsWith(from),
      ),
    );
    for (const path of paths) {
      const { error } = await supabase.storage
        .from("question-images")
        .copy(path, `${src.tenant_id}/${newId}/${path.slice(from.length)}`);
      if (error) {
        setBusy(false);
        toast.error("Gagal menyalin gambar soal. Coba lagi.");
        return;
      }
    }
    const { error } = await supabase.rpc("duplicate_question", {
      p_source: questionId,
      p_new_id: newId,
    });
    if (error) {
      setBusy(false);
      toast.error("Gagal menduplikat soal. Coba lagi.");
      return;
    }
    toast.success("Soal diduplikat. Silakan ubah salinannya.");
    await router.push(`/teacher/questions/${newId}`);
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-11"
      disabled={busy}
      onClick={duplicate}
    >
      {busy ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : (
        <Copy aria-hidden />
      )}
      <span className="sr-only">Duplikat</span>
    </Button>
  );
}
