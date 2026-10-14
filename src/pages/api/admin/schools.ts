import type { NextApiRequest, NextApiResponse } from "next";
import { createSchoolSchema } from "@/lib/school";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Body = { data: { id: string } } | { error: string };

// POST: Super Admin mendaftarkan sekolah baru + akun Admin Sekolah pertama.
// Akun Auth butuh Auth Admin API (service_role), jadi lewat API Route, bukan langsung dari browser.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Body>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metode tidak diizinkan" });
  }

  const supabase = createClient(req, res);
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return res.status(401).json({ error: "Sesi berakhir" });

  const { data: access } = await supabase.rpc("my_access").maybeSingle();
  if (access?.role !== "super_admin" || !access.is_active) {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  const parsed = createSchoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Data tidak valid" });
  }
  const input = parsed.data;

  // 1) Akun Auth admin. Email langsung dikonfirmasi: admin login dengan password dari Super Admin.
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser(
    {
      email: input.adminEmail,
      password: input.adminPassword,
      email_confirm: true,
    },
  );
  if (authError || !created.user) {
    if (authError?.code === "email_exists") {
      return res.status(409).json({ error: "Email admin sudah terdaftar" });
    }
    if (authError?.code === "weak_password") {
      return res.status(400).json({ error: "Password admin terlalu lemah" });
    }
    console.error("createUser", authError);
    return res.status(500).json({ error: "Gagal membuat akun admin" });
  }

  // 2) Tenant + profil admin dalam satu transaksi, sebagai Super Admin (RLS + trigger audit berlaku).
  const { data: tenantId, error: rpcError } = await supabase.rpc(
    "create_school",
    {
      p_code: input.code,
      p_name: input.name,
      p_admin_id: created.user.id,
      p_admin_name: input.adminName,
    },
  );
  if (rpcError || !tenantId) {
    // Rollback manual: akun Auth tanpa profil tidak boleh tertinggal (belum punya data apa pun).
    await admin.auth.admin.deleteUser(created.user.id);
    if (rpcError?.code === "23505") {
      return res.status(409).json({ error: "Kode sekolah sudah dipakai" });
    }
    console.error("create_school", rpcError);
    return res.status(500).json({ error: "Gagal menyimpan sekolah" });
  }

  return res.status(201).json({ data: { id: tenantId } });
}
