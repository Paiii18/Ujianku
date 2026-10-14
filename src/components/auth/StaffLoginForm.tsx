import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import PasswordInput from "./PasswordInput";
import { useSignIn } from "./useSignIn";

const schema = z.object({
  email: z.email("Masukkan email yang valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

type Values = z.infer<typeof schema>;

export default function StaffLoginForm() {
  const { signIn, error } = useSignIn("Email atau password salah");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => signIn(v.email.trim(), v.password))}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="staff-email">Email</FieldLabel>
          <Input
            id="staff-email"
            type="email"
            autoComplete="username"
            placeholder="nama@sekolah.sch.id"
            className="h-11"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="staff-password">Password</FieldLabel>
          <PasswordInput
            id="staff-password"
            autoComplete="current-password"
            className="h-11"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Masuk"}
        </Button>
      </FieldGroup>
    </form>
  );
}
