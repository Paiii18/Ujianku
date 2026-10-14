import { z } from "zod";

// Dipakai form (browser) dan API Route POST /api/admin/schools: satu sumber aturan validasi.
export const createSchoolSchema = z.object({
  // Kode tidak bisa diubah setelah dibuat: ikut membentuk email login murid (nis@kode.siswa.local).
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, "Kode 3–20 karakter, hanya huruf dan angka"),
  name: schoolName(),
  adminName: z
    .string()
    .trim()
    .min(1, "Nama admin wajib diisi")
    .max(100, "Maksimal 100 karakter"),
  adminEmail: z.email("Masukkan email yang valid").trim().toLowerCase(),
  adminPassword: z.string().min(8, "Password minimal 8 karakter"),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export function schoolName() {
  return z
    .string()
    .trim()
    .min(1, "Nama sekolah wajib diisi")
    .max(150, "Maksimal 150 karakter");
}
