import { z } from "zod";

// Aturan validasi akun guru & murid: dipakai form (browser) dan API Route /api/school/users.
export type ManagedRole = "teacher" | "student";

const fullName = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi")
  .max(100, "Maksimal 100 karakter");
// 72 = batas bcrypt di Supabase Auth
const password = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Maksimal 72 karakter");
const nip = z.string().trim().max(30, "Maksimal 30 karakter");

// Satu bentuk data untuk kedua peran (form yang sama), aturan per peran di superRefine:
// guru wajib email, NIP opsional; murid wajib NIS (angka, membentuk email login), tanpa email.
export function createUserSchema(role: ManagedRole) {
  return z
    .object({
      fullName,
      email: z.string().trim().toLowerCase(),
      nisNip: z.string().trim(),
      password,
    })
    .superRefine((v, ctx) => {
      if (role === "teacher") {
        if (!z.email().safeParse(v.email).success) {
          ctx.addIssue({
            code: "custom",
            path: ["email"],
            message: "Masukkan email yang valid",
          });
        }
        if (v.nisNip.length > 30) {
          ctx.addIssue({
            code: "custom",
            path: ["nisNip"],
            message: "Maksimal 30 karakter",
          });
        }
      } else if (!/^\d{1,20}$/.test(v.nisNip)) {
        ctx.addIssue({
          code: "custom",
          path: ["nisNip"],
          message: "NIS hanya berisi angka (maks. 20 digit)",
        });
      }
    });
}
export type CreateUserInput = z.infer<ReturnType<typeof createUserSchema>>;

export const editUserSchema = z.object({ fullName, nip });
export type EditUserInput = z.infer<typeof editUserSchema>;

export const passwordSchema = z.object({ password });
export type PasswordInput = z.infer<typeof passwordSchema>;

// PATCH /api/school/users/[id]
export const updateUserSchema = z.discriminatedUnion("action", [
  editUserSchema.extend({ action: z.literal("edit") }),
  z.object({ action: z.literal("active"), isActive: z.boolean() }),
  passwordSchema.extend({ action: z.literal("password") }),
]);
