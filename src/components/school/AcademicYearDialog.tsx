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
import { SEMESTER_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

const schema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran: 2026/2027")
    .refine((v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, {
      message: "Tahun kedua harus tahun pertama + 1",
    }),
  semester: z.coerce.number<string>().pipe(z.literal([1, 2])),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export type AcademicYear = { id: string; name: string; semester: number };

// Tambah (tanpa `year`) atau ubah tahun ajaran. Tulis langsung dari browser;
// RLS academic_years_write hanya mengizinkan Admin Sekolah tenant sendiri.
export default function AcademicYearDialog({ year }: { year?: AcademicYear }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: year?.name ?? "",
      semester: String(year?.semester ?? 1),
    },
  });

  async function onSubmit(values: Output) {
    setError(null);
    const supabase = createClient();
    const { error } = year
      ? await supabase.from("academic_years").update(values).eq("id", year.id)
      : await supabase.from("academic_years").insert(values);
    if (error) {
      setError(
        error.code === "23505"
          ? `${values.name} ${SEMESTER_LABEL[values.semester]} sudah ada.`
          : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    toast.success("Tahun ajaran disimpan");
    setOpen(false);
    if (!year) reset();
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
        {year ? (
          <Button variant="outline" size="icon" className="size-11">
            <Pencil aria-hidden />
            <span className="sr-only">
              Ubah {year.name} {SEMESTER_LABEL[year.semester]}
            </span>
          </Button>
        ) : (
          <Button className="h-11">
            <Plus aria-hidden /> Tambah tahun ajaran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {year ? "Ubah tahun ajaran" : "Tambah tahun ajaran"}
          </DialogTitle>
          <DialogDescription>
            Tahun ajaran baru berstatus tidak aktif. Aktifkan lewat tombol
            &ldquo;Jadikan aktif&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="year-name">Tahun ajaran</FieldLabel>
              <Input
                id="year-name"
                inputMode="numeric"
                placeholder="2026/2027"
                className="h-11"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.semester}>
              <FieldLabel htmlFor="year-semester">Semester</FieldLabel>
              {/* ponytail: <select> native, cukup untuk 2 opsi dan nyaman di HP */}
              <select
                id="year-semester"
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                {...register("semester")}
              >
                <option value="1">Ganjil</option>
                <option value="2">Genap</option>
              </select>
              <FieldDescription>
                Ganjil = semester 1, Genap = semester 2.
              </FieldDescription>
              <FieldError errors={[errors.semester]} />
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
