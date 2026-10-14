import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { schoolName } from "@/lib/school";
import { createClient } from "@/lib/supabase/browser";

const schema = z.object({ name: schoolName() });
type Values = z.infer<typeof schema>;

// Update langsung dari browser: RLS hanya mengizinkan Super Admin, trigger mencatat audit.
export default function EditSchoolNameForm({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });

  async function onSubmit(values: Values) {
    const { error } = await createClient()
      .from("tenants")
      .update({ name: values.name })
      .eq("id", id);
    if (error) {
      toast.error("Gagal menyimpan nama sekolah");
      return;
    }
    toast.success("Nama sekolah disimpan");
    await router.replace(router.asPath);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <Field data-invalid={!!errors.name} className="flex-1">
        <FieldLabel htmlFor="edit-school-name" className="sr-only">
          Nama sekolah
        </FieldLabel>
        <Input
          id="edit-school-name"
          className="h-11"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        <FieldError errors={[errors.name]} />
      </Field>
      <Button
        type="submit"
        className="h-11"
        disabled={isSubmitting || !isDirty}
      >
        {isSubmitting ? "Menyimpan..." : "Simpan nama"}
      </Button>
    </form>
  );
}
