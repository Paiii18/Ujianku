import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ROLE_HOME, type UserRole } from "@/lib/auth";
import type { Database } from "@/types/database";

// Lapis keamanan 1 (architecture §2.2): sesi, akun aktif, langganan, peran per prefix URL.
// Bukan satu-satunya pengaman: getServerSideProps/API Route cek ulang, RLS pengaman terakhir.
export async function proxy(request: NextRequest) {
  // Pola @supabase/ssr: cookie sesi yang diperbarui ditulis ke request DAN response.
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([k, v]) =>
            response.headers.set(k, v),
          );
        },
      },
    },
  );

  // Redirect yang tetap membawa cookie sesi terbaru (refresh token / logout).
  const redirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const isExpired = pathname === "/subscription-expired";

  // Verifikasi JWT (bukan getSession: cookie bisa dipalsukan).
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return isLogin ? response : redirect("/login");

  const { data: access } = await supabase.rpc("my_access").maybeSingle();

  // Tanpa profil atau akun dinonaktifkan: keluarkan sesi.
  if (!access || !access.is_active) {
    await supabase.auth.signOut();
    return isLogin ? response : redirect("/login?error=nonaktif");
  }

  const { role } = access;
  if (role !== "super_admin" && !access.tenant_active) {
    // ponytail: belum ada masa tenggang ujian berjalan (PRD), ditambah saat F3.7
    return isExpired ? response : redirect("/subscription-expired");
  }

  if (isLogin || isExpired) return redirect(ROLE_HOME[role]);

  const areaRole = (Object.keys(ROLE_HOME) as UserRole[]).find(
    (r) => pathname === ROLE_HOME[r] || pathname.startsWith(`${ROLE_HOME[r]}/`),
  );
  if (areaRole && areaRole !== role) {
    return NextResponse.rewrite(new URL("/403", request.url), { status: 403 });
  }

  return response;
}

export const config = {
  // Hanya halaman yang perlu dijaga; API Route memeriksa sesi sendiri.
  matcher: [
    "/login",
    "/subscription-expired",
    "/admin/:path*",
    "/school/:path*",
    "/teacher/:path*",
    "/student/:path*",
  ],
};
