import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import PasswordInput from "@/components/auth/PasswordInput";
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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSchoolSchema, type CreateSchoolInput } from "@/lib/school";

export default function CreateSchoolDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSchoolInput>({ resolver: zodResolver(createSchoolSchema) });

  async function onSubmit(values: CreateSchoolInput) {
    setError(null);
    try {
      const res = await fetch("/api/admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json()) as
        { data: { id: string } } | { error: string };
      if ("error" in body) {
        setError(body.error);
        return;
      }
      toast.success(`Sekolah ${values.code} berhasil didaftarkan`);
      setOpen(false);
      reset();
      await router.push(`/admin/schools/${body.data.id}`);
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi internet.");
    }
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
        <Button className="h-11">
          <Plus aria-hidden /> Tambah sekolah
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah sekolah</DialogTitle>
          <DialogDescription>
            Sekolah baru berstatus nonaktif sampai pembayaran pertama ditandai
            lunas.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="school-code">Kode sekolah</FieldLabel>
              <Input
                id="school-code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="SMAN1BDG"
                className="h-11 uppercase placeholder:normal-case"
                aria-invalid={!!errors.code}
                {...register("code")}
              />
              <FieldDescription>
                Dipakai murid saat login. Tidak bisa diubah setelah disimpan.
              </FieldDescription>
              <FieldError errors={[errors.code]} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="school-name">Nama sekolah</FieldLabel>
              <Input
                id="school-name"
                placeholder="SMA Negeri 1 Bandung"
                className="h-11"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <FieldSeparator>Admin Sekolah pertama</FieldSeparator>

            <Field data-invalid={!!errors.adminName}>
              <FieldLabel htmlFor="admin-name">Nama lengkap</FieldLabel>
              <Input
                id="admin-name"
                className="h-11"
                aria-invalid={!!errors.adminName}
                {...register("adminName")}
              />
              <FieldError errors={[errors.adminName]} />
            </Field>
            <Field data-invalid={!!errors.adminEmail}>
              <FieldLabel htmlFor="admin-email">Email</FieldLabel>
              <Input
                id="admin-email"
                type="email"
                autoComplete="off"
                placeholder="admin@sekolah.sch.id"
                className="h-11"
                aria-invalid={!!errors.adminEmail}
                {...register("adminEmail")}
              />
              <FieldError errors={[errors.adminEmail]} />
            </Field>
            <Field data-invalid={!!errors.adminPassword}>
              <FieldLabel htmlFor="admin-password">Password awal</FieldLabel>
              <PasswordInput
                id="admin-password"
                autoComplete="new-password"
                className="h-11"
                aria-invalid={!!errors.adminPassword}
                {...register("adminPassword")}
              />
              <FieldDescription>
                Minimal 8 karakter. Berikan ke admin sekolah secara langsung.
              </FieldDescription>
              <FieldError errors={[errors.adminPassword]} />
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
