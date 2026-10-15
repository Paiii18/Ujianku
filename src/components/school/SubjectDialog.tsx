import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Kode 2–10 karakter, hanya huruf dan angka"),
  name: z
    .string()
    .trim()
    .min(1, "Nama mapel wajib diisi")
    .max(100, "Maksimal 100 karakter"),
});
type Values = z.infer<typeof schema>;

export type Subject = Values & { id: string };

// Tambah (tanpa `subject`) atau ubah mapel. Tulis langsung dari browser (RLS subjects_write).
export default function SubjectDialog({ subject }: { subject?: Subject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: subject?.code ?? "", name: subject?.name ?? "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const supabase = createClient();
    const { error } = subject
      ? await supabase.from("subjects").update(values).eq("id", subject.id)
      : await supabase.from("subjects").insert(values);
    if (error) {
      setError(
        error.code === "23505"
          ? `Kode ${values.code} sudah dipakai mapel lain.`
          : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    toast.success("Mapel disimpan");
    setOpen(false);
    if (!subject) reset();
    await router.replace(router.asPath);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        {subject ? (
          <Button variant="outline" size="icon" className="size-11">
            <Pencil aria-hidden />
            <span className="sr-only">Ubah {subject.name}</span>
          </Button>
        ) : (
          <Button className="h-11">
            <Plus aria-hidden /> Tambah mapel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? "Ubah mapel" : "Tambah mapel"}</DialogTitle>
          <DialogDescription>
            Kode mapel dipakai di kolom <code>kode_mapel</code> saat import soal
            dari Excel.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="subject-code">Kode</FieldLabel>
              <Input
                id="subject-code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="MTK"
                className="h-11 uppercase placeholder:normal-case"
                aria-invalid={!!errors.code}
                {...register("code")}
              />
              <FieldDescription>
                Unik per sekolah, misal MTK, BIN, IPA.
              </FieldDescription>
              <FieldError errors={[errors.code]} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="subject-name">Nama mapel</FieldLabel>
              <Input
                id="subject-name"
                placeholder="Matematika"
                className="h-11"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
