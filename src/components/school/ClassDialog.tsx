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
  name: z
    .string()
    .trim()
    .min(1, "Nama kelas wajib diisi")
    .max(50, "Maksimal 50 karakter"),
  grade_level: z.coerce.number<string>().int().min(1).max(12),
  // "" = belum ada wali kelas
  homeroom_teacher_id: z.string().transform((v) => v || null),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export type ClassInfo = {
  id: string;
  name: string;
  gradeLevel: number;
  homeroomTeacherId: string | null;
};
export type TeacherOption = { id: string; fullName: string };

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
// ponytail: <select> native, sama dengan semester di AcademicYearDialog
const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

// Tambah kelas di tahun ajaran `academicYearId` (tanpa `cls`) atau ubah kelas.
// Tulis langsung dari browser; RLS + FK komposit + trigger memastikan wali kelas = guru sekolah ini.
export default function ClassDialog({
  academicYearId,
  teachers,
  cls,
}: {
  academicYearId: string;
  teachers: TeacherOption[];
  cls?: ClassInfo;
}) {
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
      name: cls?.name ?? "",
      grade_level: String(cls?.gradeLevel ?? 10),
      homeroom_teacher_id: cls?.homeroomTeacherId ?? "",
    },
  });

  async function onSubmit(values: Output) {
    setError(null);
    const supabase = createClient();
    const { error } = cls
      ? await supabase.from("classes").update(values).eq("id", cls.id)
      : await supabase
          .from("classes")
          .insert({ ...values, academic_year_id: academicYearId });
    if (error) {
      setError(
        error.code === "23505"
          ? `Kelas ${values.name} sudah ada di tahun ajaran ini.`
          : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    toast.success(`Kelas ${values.name} disimpan`);
    setOpen(false);
    if (!cls) reset();
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
        {cls ? (
          <Button variant="outline" className="h-11">
            <Pencil aria-hidden /> Ubah kelas
          </Button>
        ) : (
          <Button className="h-11">
            <Plus aria-hidden /> Tambah kelas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cls ? "Ubah kelas" : "Tambah kelas"}</DialogTitle>
          <DialogDescription>
            Nama kelas unik per tahun ajaran, misal X IPA 1 atau VII A.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="class-name">Nama kelas</FieldLabel>
              <Input
                id="class-name"
                placeholder="X IPA 1"
                className="h-11"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.grade_level}>
              <FieldLabel htmlFor="class-grade">Tingkat</FieldLabel>
              <select
                id="class-grade"
                className={SELECT_CLASS}
                {...register("grade_level")}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Kelas {g}
                  </option>
                ))}
              </select>
              <FieldError errors={[errors.grade_level]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="class-homeroom">Wali kelas</FieldLabel>
              <select
                id="class-homeroom"
                className={SELECT_CLASS}
                {...register("homeroom_teacher_id")}
              >
                <option value="">— Belum ditentukan —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              <FieldDescription>
                Hanya guru aktif sekolah ini. Tambah guru di menu Guru.
              </FieldDescription>
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
