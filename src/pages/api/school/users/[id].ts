import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiBody } from "@/lib/api";
import { requireApiRole } from "@/lib/apiAuth";
import { updateUserSchema } from "@/lib/schoolUser";
import { createAdminClient } from "@/lib/supabase/admin";

// ponytail: ±100 tahun = "selamanya" menurut Supabase Auth
const BAN_FOREVER = "876000h";

// PATCH: ubah data, aktif/nonaktif, atau reset password guru/murid sekolah sendiri.
// Kepemilikan dicek RPC (managed_user_role / update / set_active) SEBELUM service_role dipakai.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiBody<null>>,
) {
  const supabase = await requireApiRole(req, res, "PATCH", "school_admin");
  if (!supabase) return;

  const id = String(req.query.id);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Data tidak valid" });
  const input = parsed.data;

  const { error } =
    input.action === "edit"
      ? await supabase.rpc("update_school_user", {
          p_id: id,
          p_full_name: input.fullName,
          p_nip: input.nip,
        })
      : input.action === "active"
        ? await supabase.rpc("set_school_user_active", {
            p_id: id,
            p_active: input.isActive,
          })
        : await supabase.rpc("managed_user_role", { p_id: id });
  if (error) {
    // P0002 = bukan guru/murid sekolah ini; 22P02 = id bukan UUID
    if (error.code === "P0002" || error.code === "22P02") {
      return res.status(404).json({ error: "Akun tidak ditemukan" });
    }
    if (error.code === "23505") {
      return res.status(409).json({ error: "NIP sudah dipakai guru lain" });
    }
    console.error("update user", error);
    return res.status(500).json({ error: "Gagal menyimpan" });
  }

  if (input.action === "edit") return res.status(200).json({ data: null });

  // Akun nonaktif juga diblokir di Auth: tidak bisa login lagi.
  const { error: authError } =
    await createAdminClient().auth.admin.updateUserById(
      id,
      input.action === "password"
        ? { password: input.password }
        : { ban_duration: input.isActive ? "none" : BAN_FOREVER },
    );
  if (authError) {
    if (authError.code === "weak_password") {
      return res.status(400).json({ error: "Password terlalu lemah" });
    }
    console.error("updateUserById", authError);
    return res.status(500).json({ error: "Gagal menyimpan" });
  }
  return res.status(200).json({ data: null });
}
