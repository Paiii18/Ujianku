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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { callApi } from "@/lib/api";
import {
  createUserSchema,
  type CreateUserInput,
  type ManagedRole,
} from "@/lib/schoolUser";

const TEXT = {
  teacher: {
    noun: "guru",
    desc: "Guru login di tab Guru/Staf dengan email dan password ini.",
  },
  student: {
    noun: "murid",
    desc: "Murid login di tab Murid dengan kode sekolah, NIS, dan password ini.",
  },
};

export default function CreateUserDialog({ role }: { role: ManagedRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema(role)),
    defaultValues: { fullName: "", email: "", nisNip: "", password: "" },
  });
  const isStudent = role === "student";

  async function onSubmit(values: CreateUserInput) {
    setError(null);
    const body = await callApi("/api/school/users", "POST", {
      ...values,
      role,
    });
    if ("error" in body) {
      setError(body.error);
      return;
    }
    toast.success(`Akun ${values.fullName} dibuat`);
    setOpen(false);
    reset();
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
        <Button className="h-11">
          <Plus aria-hidden /> Tambah {TEXT[role].noun}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah {TEXT[role].noun}</DialogTitle>
          <DialogDescription>{TEXT[role].desc}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.fullName}>
              <FieldLabel htmlFor="user-name">Nama lengkap</FieldLabel>
              <Input
                id="user-name"
                className="h-11"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>
            {!isStudent && (
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="user-email">Email</FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  autoComplete="off"
                  className="h-11"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
            )}
            <Field data-invalid={!!errors.nisNip}>
              <FieldLabel htmlFor="user-nis-nip">
                {isStudent ? "NIS" : "NIP (opsional)"}
              </FieldLabel>
              <Input
                id="user-nis-nip"
                inputMode="numeric"
                autoComplete="off"
                className="h-11"
                aria-invalid={!!errors.nisNip}
                {...register("nisNip")}
              />
              {isStudent && (
                <FieldDescription>
                  Dipakai untuk login. Tidak bisa diubah setelah disimpan.
                </FieldDescription>
              )}
              <FieldError errors={[errors.nisNip]} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="user-password">Password awal</FieldLabel>
              <PasswordInput
                id="user-password"
                autoComplete="new-password"
                className="h-11"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <FieldDescription>Minimal 8 karakter.</FieldDescription>
              <FieldError errors={[errors.password]} />
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
