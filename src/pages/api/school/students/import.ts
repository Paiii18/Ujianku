import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { activeYearClasses } from "@/lib/activeYearClasses";
import type { ApiBody } from "@/lib/api";
import { requireApiRole } from "@/lib/apiAuth";
import { studentEmail } from "@/lib/auth";
import {
  readStudentRows,
  validateStudentRows,
  type StudentRow,
} from "@/lib/studentImport";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel: 300+ akun Auth dibuat berurutan per batch, butuh lebih dari batas default
export const config = { maxDuration: 60 };

const BATCH = 10; // ponytail: 10 createUser paralel; naikkan bila import terasa lambat

const bodySchema = z.object({
  path: z.string().min(1).max(300),
  commit: z.boolean(),
});

export type PreviewRow = Pick<
  StudentRow,
  "row" | "nis" | "fullName" | "className" | "errors"
>;
export type ImportResult = { preview: PreviewRow[] } | { imported: number };

// POST { path, commit }: baca file di bucket imports (diunggah browser, DEC-001).
// commit=false → preview + error per baris. commit=true → validasi ulang, buat semua akun Auth,
// lalu import_students() satu transaksi. Gagal di tengah = semua akun Auth yang sudah dibuat dihapus.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiBody<ImportResult>>,
) {
  const supabase = await requireApiRole(req, res, "POST", "school_admin");
  if (!supabase) return;

  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Data tidak valid" });

  // Diunduh dengan sesi user: policy storage hanya mengizinkan folder {tenant}/{user} sendiri
  const { data: blob } = await supabase.storage
    .from("imports")
    .download(body.data.path);
  if (!blob) return res.status(404).json({ error: "File tidak ditemukan" });

  const read = readStudentRows(await blob.arrayBuffer());
  if ("error" in read) return res.status(400).json({ error: read.error });

  const [classes, { data: school }, { data: taken }] = await Promise.all([
    activeYearClasses(supabase),
    supabase.rpc("my_school").single(),
    // NIS/NIP unik per sekolah untuk semua peran (unique (tenant_id, nis_nip))
    supabase
      .from("profiles")
      .select("nis_nip")
      .in("nis_nip", [...new Set(read.rows.map((r) => r.nis).filter(Boolean))]),
  ]);
  if (!school) return res.status(403).json({ error: "Akses ditolak" });

  const rows = validateStudentRows(read.rows, {
    classes: new Map([...classes].map(([k, c]) => [k, c.id])),
    takenNis: new Set((taken ?? []).map((p) => p.nis_nip ?? "")),
  });

  if (!body.data.commit || rows.some((r) => r.errors.length)) {
    const preview = rows.map(({ row, nis, fullName, className, errors }) => ({
      row,
      nis,
      fullName,
      className,
      errors,
    }));
    return res
      .status(body.data.commit ? 400 : 200)
      .json(
        body.data.commit
          ? {
              error:
                "Masih ada baris yang error. Perbaiki file lalu unggah ulang.",
            }
          : { data: { preview } },
      );
  }

  const admin = createAdminClient();
  const created: { id: string; row: StudentRow }[] = [];
  const rollback = () =>
    Promise.all(created.map((c) => admin.auth.admin.deleteUser(c.id)));

  for (let i = 0; i < rows.length; i += BATCH) {
    const results = await Promise.all(
      rows.slice(i, i + BATCH).map(async (row) => {
        const { data, error } = await admin.auth.admin.createUser({
          email: studentEmail(school.code, row.nis),
          password: row.password,
          email_confirm: true,
        });
        if (data.user) created.push({ id: data.user.id, row });
        return error ? { row, error } : null;
      }),
    );
    const failed = results.find(Boolean);
    if (failed) {
      await rollback();
      if (failed.error.code === "email_exists") {
        return res.status(409).json({
          error: `Baris ${failed.row.row}: NIS ${failed.row.nis} sudah terdaftar. Tidak ada murid yang disimpan.`,
        });
      }
      console.error("import createUser", failed.error);
      return res.status(500).json({
        error: "Gagal membuat akun. Tidak ada murid yang disimpan.",
      });
    }
  }

  const { data: imported, error } = await supabase.rpc("import_students", {
    p_rows: created.map(({ id, row }) => ({
      id,
      full_name: row.fullName,
      nis: row.nis,
      class_id: row.classId,
    })),
  });
  if (error) {
    await rollback();
    console.error("import_students", error);
    return res.status(error.code === "23505" ? 409 : 500).json({
      error:
        error.code === "23505"
          ? "Sebagian NIS sudah terdaftar atau murid sudah punya kelas. Tidak ada murid yang disimpan."
          : "Gagal menyimpan murid. Tidak ada murid yang disimpan.",
    });
  }

  await supabase.storage.from("imports").remove([body.data.path]);
  return res.status(201).json({ data: { imported: imported ?? 0 } });
}
