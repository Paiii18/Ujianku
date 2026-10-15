import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IMAGE_TYPES, uploadQuestionImage } from "@/lib/questionImage";

// Slot satu gambar (soal atau opsi): pilih → kompres → unggah langsung ke Storage.
// ponytail: gambar yang dilepas/diganti tidak dihapus dari Storage (DEC-030).
export default function ImageField({
  folder,
  path,
  previewUrl,
  label,
  onChange,
}: {
  folder: string;
  path: string | null;
  previewUrl: string | null;
  label: string;
  onChange: (path: string | null, previewUrl: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadQuestionImage(folder, file);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else onChange(result.path, result.previewUrl);
  }

  if (path) {
    return (
      <div className="relative w-fit">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL / blob, next/image tidak perlu
          <img
            src={previewUrl}
            alt={label}
            className="max-h-48 max-w-full rounded-md border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Gambar tersimpan</p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-1 right-1 size-9"
          aria-label={`Hapus ${label}`}
          onClick={() => onChange(null, null)}
        >
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-fit"
      asChild
      disabled={busy}
    >
      <label className="cursor-pointer">
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <ImagePlus aria-hidden />
        )}
        {busy ? "Mengunggah..." : label}
        <input
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </Button>
  );
}
