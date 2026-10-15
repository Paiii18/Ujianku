import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import type { ApiBody } from "@/lib/api";
import { requireApiRole } from "@/lib/apiAuth";
import { studentEmail } from "@/lib/auth";
import { createUserSchema } from "@/lib/schoolUser";
import { createAdminClient } from "@/lib/supabase/admin";

const roleSchema = z.object({ role: z.enum(["teacher", "student"]) });

// POST: Admin Sekolah membuat akun guru / murid.
// 1) akun Auth (service_role) → 2) profil lewat RPC create_school_user (sesi admin, tenant dari sesi).
// Langkah 2 gagal → akun Auth dihapus lagi agar tidak ada akun yatim.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiBody<{ id: string }>>,
) {
  const supabase = await requireApiRole(req, res, "POST", "school_admin");
  if (!supabase) return;

  const role = roleSchema.safeParse(req.body);
  const parsed = role.success
    ? // murid tidak punya email: default "" agar bentuk data sama dengan form
      createUserSchema(role.data.role).safeParse({ email: "", ...req.body })
    : null;
  if (!role.success || !parsed?.success) {
    return res.status(400).json({ error: "Data tidak valid" });
  }
  const input = parsed.data;
  const isStudent = role.data.role === "student";

  let email = input.email;
  if (isStudent) {
    const { data: school } = await supabase.rpc("my_school").single();
    if (!school) return res.status(403).json({ error: "Akses ditolak" });
    email = studentEmail(school.code, input.nisNip);
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser(
    {
      email,
      password: input.password,
      email_confirm: true,
    },
  );
  if (authError || !created.user) {
    if (authError?.code === "email_exists") {
      return res.status(409).json({
        error: isStudent ? "NIS sudah terdaftar" : "Email sudah terdaftar",
      });
    }
    if (authError?.code === "weak_password") {
      return res.status(400).json({ error: "Password terlalu lemah" });
    }
    console.error("createUser", authError);
    return res.status(500).json({ error: "Gagal membuat akun" });
  }

  const { error: rpcError } = await supabase.rpc("create_school_user", {
    p_id: created.user.id,
    p_role: role.data.role,
    p_full_name: input.fullName,
    p_nis_nip: input.nisNip,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(created.user.id);
    if (rpcError.code === "23505") {
      return res.status(409).json({
        error: isStudent
          ? "NIS sudah terdaftar"
          : "NIP sudah dipakai guru lain",
      });
    }
    console.error("create_school_user", rpcError);
    return res.status(500).json({ error: "Gagal menyimpan akun" });
  }

  return res.status(201).json({ data: { id: created.user.id } });
}
