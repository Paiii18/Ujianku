import { useState } from "react";
import { useRouter } from "next/router";
import { ROLE_HOME } from "@/lib/auth";
import { createClient } from "@/lib/supabase/browser";

// Login lalu arahkan ke halaman sesuai peran.
// Pesan gagal sengaja generik: tidak memberi tahu apakah akun ada atau password yang salah.
export function useSignIn(failMessage: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string, password: string) {
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      if (authError.status === 429) {
        setError("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
      } else if (!authError.status) {
        setError("Tidak dapat terhubung ke server. Periksa koneksi internet.");
      } else {
        setError(failMessage);
      }
      return;
    }

    // RPC, bukan select profiles: tetap terbaca walau sekolah nonaktif (RLS = 0 baris).
    const { data: role } = await supabase.rpc("my_role");
    if (!role) {
      // Akun Auth tanpa profil: anggap gagal login.
      await supabase.auth.signOut();
      setError(failMessage);
      return;
    }
    await router.replace(ROLE_HOME[role]);
  }

  return { signIn, error };
}
