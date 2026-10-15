import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
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
import { callApi } from "@/lib/api";
import { passwordSchema, type PasswordInput as Values } from "@/lib/schoolUser";

export default function ResetPasswordDialog({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const body = await callApi(`/api/school/users/${userId}`, "PATCH", {
      action: "password",
      ...values,
    });
    if ("error" in body) {
      setError(body.error);
      return;
    }
    toast.success(`Password ${fullName} diganti`);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="size-11">
          <KeyRound aria-hidden />
          <span className="sr-only">Reset password {fullName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Password baru untuk {fullName}. Berikan secara langsung.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor={`reset-password-${userId}`}>
                Password baru
              </FieldLabel>
              <PasswordInput
                id={`reset-password-${userId}`}
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
              {isSubmitting ? "Menyimpan..." : "Simpan password"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
