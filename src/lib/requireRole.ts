import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_HOME, type UserRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SessionUser = {
  fullName: string;
  role: UserRole;
  schoolName: string | null;
};
export type ShellProps = { user: SessionUser };

const to = (destination: string) => ({
  redirect: { destination, permanent: false },
});

// Lapis 2 (architecture §2.2): cek ulang sesi & peran di server, tidak hanya mengandalkan proxy.
// Pakai: `export const getServerSideProps = requireRole("teacher");`
// Data tambahan halaman: `requireRole("super_admin", async (ctx, supabase) => ({ ... }))`.
// Loader mengembalikan null → 404.
export function requireRole<P extends object = object>(
  role: UserRole,
  load?: (
    ctx: GetServerSidePropsContext,
    supabase: SupabaseClient<Database>,
  ) => Promise<P | null>,
): GetServerSideProps<ShellProps & P> {
  return async (ctx) => {
    const { req, res } = ctx;
    const supabase = createClient(req, res);
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return to("/login");

    const { data: access } = await supabase.rpc("my_access").maybeSingle();
    if (!access?.is_active) return to("/login?error=nonaktif");
    if (access.role !== "super_admin" && !access.tenant_active) {
      return to("/subscription-expired");
    }
    if (access.role !== role) return to(ROLE_HOME[access.role]);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, tenants(name)")
      .eq("id", data.claims.sub)
      .single();
    if (!profile) return to("/login");

    const extra = load ? await load(ctx, supabase) : ({} as P);
    if (!extra) return { notFound: true };

    return {
      props: {
        ...extra,
        user: {
          fullName: profile.full_name,
          role,
          schoolName: profile.tenants?.name ?? null,
        },
      },
    };
  };
}
