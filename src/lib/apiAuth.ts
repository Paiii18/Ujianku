import type { NextApiRequest, NextApiResponse } from "next";
import type { UserRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Urutan cek API Route (AGENTS.md §7): method → sesi → peran (akun & sekolah aktif).
// Mengembalikan client sesi user, atau null bila respons error sudah dikirim.
export async function requireApiRole(
  req: NextApiRequest,
  res: NextApiResponse,
  method: string,
  role: UserRole,
) {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    res.status(405).json({ error: "Metode tidak diizinkan" });
    return null;
  }
  const supabase = createClient(req, res);
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    res.status(401).json({ error: "Sesi berakhir" });
    return null;
  }
  const { data: access } = await supabase.rpc("my_access").maybeSingle();
  const ok =
    access?.role === role &&
    access.is_active &&
    (role === "super_admin" || access.tenant_active);
  if (!ok) {
    res.status(403).json({ error: "Akses ditolak" });
    return null;
  }
  return supabase;
}
