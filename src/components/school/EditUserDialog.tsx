import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { callApi } from "@/lib/api";
import {
  editUserSchema,
  type EditUserInput,
  type ManagedRole,
} from "@/lib/schoolUser";

export type ManagedUser = {
  id: string;
  fullName: string;
  nisNip: string | null;
  isActive: boolean;
};

// Ubah nama (+ NIP guru). NIS murid & email guru tidak bisa diubah (dipakai login).
export default function EditUserDialog({
  role,
  user,
}: {
  role: ManagedRole;
  user: ManagedUser;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditUserInput>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { fullName: user.fullName, nip: user.nisNip ?? "" },
  });

  async function onSubmit(values: EditUserInput) {
    setError(null);
    const body = await callApi(`/api/school/users/${user.id}`, "PATCH", {
      action: "edit",
      ...values,
    });
    if ("error" in body) {
      setError(body.error);
      return;
    }
    toast.success("Perubahan disimpan");
    setOpen(false);
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
        <Button variant="outline" size="icon" className="size-11">
          <Pencil aria-hidden />
          <span className="sr-only">Ubah {user.fullName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Ubah {role === "student" ? "murid" : "guru"}
          </DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.fullName}>
              <FieldLabel htmlFor={`edit-name-${user.id}`}>
                Nama lengkap
              </FieldLabel>
              <Input
                id={`edit-name-${user.id}`}
                className="h-11"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>
            {role === "teacher" && (
              <Field data-invalid={!!errors.nip}>
                <FieldLabel htmlFor={`edit-nip-${user.id}`}>
                  NIP (opsional)
                </FieldLabel>
                <Input
                  id={`edit-nip-${user.id}`}
                  inputMode="numeric"
                  className="h-11"
                  aria-invalid={!!errors.nip}
                  {...register("nip")}
                />
                <FieldError errors={[errors.nip]} />
              </Field>
            )}

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
