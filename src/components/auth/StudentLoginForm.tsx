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
import { studentEmail } from "@/lib/auth";
import PasswordInput from "./PasswordInput";
import { useSignIn } from "./useSignIn";

const schema = z.object({
  schoolCode: z.string().trim().min(1, "Kode sekolah wajib diisi"),
  nis: z
    .string()
    .trim()
    .min(1, "NIS wajib diisi")
    .regex(/^\d+$/, "NIS hanya berisi angka"),
  password: z.string().min(1, "Password wajib diisi"),
});

type Values = z.infer<typeof schema>;

export default function StudentLoginForm() {
  const { signIn, error } = useSignIn("Kode sekolah, NIS, atau password salah");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) =>
        signIn(studentEmail(v.schoolCode, v.nis), v.password),
      )}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.schoolCode}>
          <FieldLabel htmlFor="student-school">Kode sekolah</FieldLabel>
          <Input
            id="student-school"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="SMAN1BDG"
            className="h-11 uppercase placeholder:normal-case"
            aria-invalid={!!errors.schoolCode}
            {...register("schoolCode")}
          />
          <FieldError errors={[errors.schoolCode]} />
        </Field>
        <Field data-invalid={!!errors.nis}>
          <FieldLabel htmlFor="student-nis">NIS</FieldLabel>
          <Input
            id="student-nis"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="username"
            autoCorrect="off"
            spellCheck={false}
            className="h-11"
            aria-invalid={!!errors.nis}
            {...register("nis")}
          />
          <FieldError errors={[errors.nis]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="student-password">Password</FieldLabel>
          <PasswordInput
            id="student-password"
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
