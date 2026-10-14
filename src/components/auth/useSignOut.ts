import { useRouter } from "next/router";
import { createClient } from "@/lib/supabase/browser";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await createClient().auth.signOut();
    await router.replace("/login");
  };
}
